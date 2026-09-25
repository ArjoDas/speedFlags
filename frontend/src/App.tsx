import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { api, ApiError, preload, type Country, type Game, type Settings } from './api/client'
import { loadSettings, recordBest, read, write, dailyKey, storedDaily } from './storage/preferences'
import { AnswerInput } from './ui/AnswerInput'
import { Results } from './ui/Results'
import { Setup } from './ui/Setup'
import { SettingsDialog } from './ui/SettingsDialog'
import { Theme } from './ui/Theme'
import { formatTime } from './game/daily'
import { normalize } from './game/search'
import { preloadFlags, type FlagProgress } from './game/flags'

async function prepareGame(
  settings: Settings,
  signal: AbortSignal,
  onProgress: (progress: FlagProgress | null) => void,
): Promise<Game> {
  await preloadFlags(signal, onProgress)
  const prepared = await api.create(settings, signal)
  const saved = prepared.challenge_date ? storedDaily(prepared) : null
  if (saved?.status === 'finished') return saved
  if (saved) {
    try {
      return await api.sync(saved, signal)
    } catch (cause) {
      if (!(cause instanceof ApiError) || ![401, 409, 410].includes(cause.status)) throw cause
      if (saved.status !== 'ready')
        throw new ApiError(
          'Today’s Daily Challenge attempt has ended. Come back tomorrow, or choose Timed or Practice.',
        )
    }
  }
  await preload(prepared.question!.asset_url, signal)
  return prepared
}

type State = { game: Game | null; busy: boolean; error: string; best: number; saved: boolean }
type Action =
  | { type: 'busy' }
  | { type: 'game'; game: Game }
  | { type: 'error'; message: string }
  | { type: 'reset' }
  | { type: 'saved'; best: number; saved: boolean }
const initial: State = { game: null, busy: false, error: '', best: 0, saved: true }
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'busy':
      return { ...state, busy: true, error: '' }
    case 'game':
      return { ...state, busy: false, error: '', game: action.game }
    case 'error':
      return { ...state, busy: false, error: action.message }
    case 'reset':
      return initial
    case 'saved':
      return { ...state, best: action.best, saved: action.saved }
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initial)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(() => read('settings-seen.v1') !== true)
  const [settingsVisible, setSettingsVisible] = useState(settingsOpen)
  const [countries, setCountries] = useState<Country[]>([])
  const [flagProgress, setFlagProgress] = useState<FlagProgress | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const dailyClock = useRef({ received: 0, elapsed: 0 })
  const [warmupError, setWarmupError] = useState('')
  const [flash, setFlash] = useState(false)
  const [imageStatus, setImageStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [imageRetry, setImageRetry] = useState(0)
  const currentQuestion = useRef('')
  const currentFlag = useRef<HTMLImageElement>(null)
  const previousFlag = useRef<HTMLImageElement>(null)
  const outgoingFlag = useRef<{ id: string; bounds: DOMRect } | null>(null)
  const lock = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const retry = useRef<(() => void) | null>(null)
  const epoch = useRef(0)
  const sync = useRef({ received: 0, remaining: 0 })
  const { game, busy, error } = state

  useEffect(() => {
    const abort = new AbortController()
    api
      .countries(abort.signal)
      .then(setCountries)
      .catch(() => {
        /* free typing still works if suggestions are unavailable */
      })
    return () => {
      abort.abort()
      controller.current?.abort()
    }
  }, [])

  const run = useCallback(
    (operation: (signal: AbortSignal) => Promise<Game>, keepSettingsOpen = false) => {
      if (lock.current) return
      lock.current = true
      controller.current = new AbortController()
      const abort = controller.current
      const currentEpoch = epoch.current
      dispatch({ type: 'busy' })
      retry.current = () => run(operation, keepSettingsOpen)
      operation(abort.signal)
        .then((result) => {
          if (abort.signal.aborted || currentEpoch !== epoch.current) return
          if (result.challenge_date) {
            const existing = storedDaily(result)
            if (
              existing &&
              ((existing.status !== 'ready' && result.status === 'ready') ||
                existing.attempts > result.attempts ||
                (existing.status === 'finished' && result.status !== 'finished'))
            )
              result = existing
          }
          sync.current = {
            received: performance.now(),
            remaining:
              result.deadline === null
                ? Infinity
                : Math.max(0, (result.deadline - result.server_time) * 1000),
          }
          dailyClock.current = {
            received: performance.now(),
            elapsed:
              result.status === 'playing' && result.started_at != null
                ? Math.max(0, result.server_time - result.started_at)
                : (result.elapsed_seconds ?? 0),
          }
          setElapsed(dailyClock.current.elapsed)
          if (result.challenge_date) {
            const saved = write(dailyKey(result), result)
            dispatch({ type: 'saved', best: 0, saved })
          }
          setRemaining(sync.current.remaining)
          if (result.last_attempt?.question_id === currentQuestion.current && currentFlag.current) {
            outgoingFlag.current = {
              id: currentQuestion.current,
              bounds: currentFlag.current.getBoundingClientRect(),
            }
          }
          if (result.question?.id !== currentQuestion.current) setImageStatus('loading')
          currentQuestion.current = result.question?.id ?? ''
          dispatch({ type: 'game', game: result })
          if (!keepSettingsOpen) setSettingsOpen(false)
          retry.current = null
          if (result.status === 'finished' && !result.challenge_date)
            dispatch({ type: 'saved', ...recordBest(result) })
        })
        .catch((cause: unknown) => {
          if (abort.signal.aborted || currentEpoch !== epoch.current) return
          if (cause instanceof ApiError && [401, 409, 410, 422].includes(cause.status))
            retry.current = null
          dispatch({
            type: 'error',
            message:
              cause instanceof Error ? cause.message : 'Something went wrong. Please try again.',
          })
        })
        .finally(() => {
          if (currentEpoch === epoch.current) lock.current = false
        })
    },
    [],
  )

  useEffect(() => {
    write('settings-seen.v1', true)
  }, [])

  const initialSettings = useRef(settings)
  useEffect(() => {
    run((signal) => prepareGame(initialSettings.current, signal, setFlagProgress), true)
    return () => {
      epoch.current += 1
      controller.current?.abort()
      lock.current = false
    }
  }, [run])

  function begin(next = settings) {
    write('settings.v2', { ...next, country_ids: [] })
    run((signal) => prepareGame(next, signal, setFlagProgress))
  }
  function reset() {
    setSettingsOpen(true)
    setWarmupError('')
    epoch.current += 1
    controller.current?.abort()
    lock.current = false
    retry.current = null
    currentQuestion.current = ''
    dispatch({ type: 'reset' })
  }
  function finish() {
    if (game) run((signal) => api.finish(game, signal))
  }
  function answer(text: string, skip = false) {
    if (!game?.question || busy || error || imageStatus !== 'ready') return
    if (game.status === 'ready') {
      const expected = countries.find((country) => country.name === game.warmup_answer)
      const accepted = [game.warmup_answer!, ...(expected?.aliases ?? [])]
      if (!accepted.some((name) => normalize(name) === normalize(text))) {
        setWarmupError(`Type ${game.warmup_answer} to start.`)
        return
      }
      setWarmupError('')
      run(async (signal) => {
        const start = async () => {
          const saved = game.challenge_date ? storedDaily(game) : null
          if (saved && saved.status !== 'ready')
            return saved.status === 'finished' ? saved : api.sync(saved, signal)
          if (game.challenge_date && !write(dailyKey(game), game))
            throw new ApiError(
              'Daily Challenge needs browser storage to save your one daily attempt. Enable storage, or choose Timed or Practice.',
            )
          const result = await api.start(game, text, signal)
          if (game.challenge_date) write(dailyKey(result), result)
          return result
        }
        return game.challenge_date && navigator.locks
          ? navigator.locks.request(`speedflags-daily-${game.challenge_date}`, start)
          : start()
      })
      return
    }
    const body = {
      token: game.token,
      question_id: game.question.id,
      sequence: game.question.sequence,
      submission_id: crypto.randomUUID(),
      answer: text,
      skip,
    }
    run((signal) => api.answer(game, body, signal))
  }
  useEffect(() => {
    if (game?.status !== 'playing' || (game.deadline === null && !game.challenge_date)) return
    const update = () => {
      if (game.challenge_date)
        setElapsed(
          dailyClock.current.elapsed + (performance.now() - dailyClock.current.received) / 1000,
        )
      setRemaining(
        Math.max(0, sync.current.remaining - (performance.now() - sync.current.received)),
      )
    }
    const id = setInterval(update, 100)
    const resume = () => {
      update()
      if (document.visibilityState === 'visible' && !lock.current && !error)
        run((signal) => api.sync(game, signal))
    }
    document.addEventListener('visibilitychange', resume)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [game, error, run])
  useEffect(() => {
    if (
      game?.status === 'playing' &&
      ((game.deadline !== null && remaining <= 0) || (game.challenge_date && elapsed >= 900)) &&
      !busy &&
      !error &&
      !lock.current
    )
      run((signal) => api.finish(game, signal))
  }, [game, remaining, elapsed, busy, error, run])

  useEffect(() => {
    setFlash(!!game?.last_attempt && game.last_attempt.result !== 'correct')
    const timer = setTimeout(() => setFlash(false), 3000)
    return () => clearTimeout(timer)
  }, [game?.last_attempt?.question_id, game?.last_attempt?.result])

  useLayoutEffect(() => {
    const source = outgoingFlag.current
    outgoingFlag.current = null
    const target = previousFlag.current
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!source || !target || source.id !== game?.last_attempt?.question_id || media.matches) return
    const destination = target.getBoundingClientRect()
    if (!destination.width || !destination.height) return
    const animation = target.animate(
      [
        {
          transform: `translate(${source.bounds.x - destination.x}px, ${source.bounds.y - destination.y}px) scale(${source.bounds.width / destination.width}, ${source.bounds.height / destination.height})`,
        },
        { transform: 'none' },
      ],
      { duration: 420, easing: 'cubic-bezier(.22,.68,0,1)' },
    )
    const cancel = () => animation.cancel()
    window.addEventListener('resize', cancel)
    window.addEventListener('scroll', cancel, true)
    media.addEventListener('change', cancel)
    return () => {
      cancel()
      window.removeEventListener('resize', cancel)
      window.removeEventListener('scroll', cancel, true)
      media.removeEventListener('change', cancel)
    }
  }, [game?.last_attempt?.question_id, game?.status])

  const progress = game
    ? Math.min(100, Math.max(0, remaining / (game.settings.duration * 10)))
    : 100
  const feedback = game?.last_attempt
  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            reset()
          }}
          aria-label="speedFlags home"
        >
          <img src="/logo.png" alt="" />
          <span>
            <strong>
              <em>speed</em>
            </strong>
            <span>Flags</span>
          </span>
        </a>
        <div className="header-right">
          <button
            className="secondary settings-button"
            onClick={() => setSettingsOpen(true)}
            disabled={busy}
          >
            Change settings
          </button>
          <Theme />
        </div>
      </header>
      <main id="main">
        {!settingsOpen && busy && flagProgress && (
          <p role="status">
            Loading flags… {flagProgress.loaded}/{flagProgress.total}
          </p>
        )}
        {error && !settingsOpen && (
          <div className="error-banner" role="alert">
            <div>
              <p>{error}</p>
            </div>
            <div>
              {retry.current && (
                <button className="secondary" onClick={() => retry.current?.()}>
                  Retry
                </button>
              )}
              <button className="text-button" onClick={reset}>
                Back to setup
              </button>
            </div>
          </div>
        )}
        {!game && (
          <section className="board-preview" aria-label="Game preview">
            <h1 className="sr-only">speedFlags</h1>
            <div className="play-top">
              <span className="timer">
                {settings.mode === 'practice'
                  ? 'Untimed'
                  : settings.mode === 'challenge'
                    ? '0:00'
                    : `${settings.duration}s`}
              </span>
            </div>
            <div className="time-track" aria-hidden="true">
              <div style={{ width: '100%' }} />
            </div>
            <div className="preview-flag flag-stage">
              <img src="/logo.png" alt="" />
            </div>
          </section>
        )}
        {(settingsOpen || settingsVisible) && (
          <SettingsDialog
            onVisibilityChange={setSettingsVisible}
            open={settingsOpen}
            busy={busy}
            onDismiss={() => {
              setSettingsOpen(false)
              if (!game || JSON.stringify(game.settings) !== JSON.stringify(settings)) begin()
            }}
          >
            {error && (
              <div className="error-banner" role="alert">
                <div>
                  <p>{error}</p>
                </div>
                <div>
                  {retry.current && (
                    <button className="secondary" onClick={() => retry.current?.()}>
                      Retry
                    </button>
                  )}
                  <button className="text-button" onClick={reset}>
                    Back to setup
                  </button>
                </div>
              </div>
            )}
            <Setup
              settings={settings}
              disabled={busy}
              onChange={setSettings}
              onStart={() => begin()}
            />
            {busy && flagProgress && (
              <p role="status">
                Loading flags… {flagProgress.loaded}/{flagProgress.total}
              </p>
            )}
          </SettingsDialog>
        )}
        {game && game.status !== 'finished' && (
          <section className="play-layout" aria-label="Flag game">
            <h1 className="sr-only">Flag game</h1>
            <div className="play-top">
              <span
                className={`timer ${remaining < 10000 ? 'urgent' : ''}`}
                aria-label={
                  game.challenge_date
                    ? `${formatTime(elapsed + (game.penalty_seconds ?? 0))} adjusted time`
                    : game.settings.mode !== 'practice'
                      ? `${game.status === 'ready' ? game.settings.duration : Math.ceil(remaining / 1000)} seconds remaining`
                      : 'Untimed practice'
                }
              >
                {game.challenge_date
                  ? formatTime(elapsed + (game.penalty_seconds ?? 0))
                  : game.settings.mode !== 'practice'
                    ? `${game.status === 'ready' ? game.settings.duration : (remaining / 1000).toFixed(1)}s`
                    : 'Untimed'}
              </span>
              {game.status === 'playing' && (
                <button className="text-button" onClick={finish} disabled={busy}>
                  Finish round
                </button>
              )}
            </div>
            {game.settings.mode !== 'practice' && (
              <div
                className="time-track"
                role="progressbar"
                aria-label={game.challenge_date ? 'Flags completed' : 'Time remaining'}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  game.challenge_date
                    ? Math.round((game.attempts / 30) * 100)
                    : game.status === 'ready'
                      ? 100
                      : Math.round(progress)
                }
              >
                <div
                  style={{
                    width: `${game.challenge_date ? (game.attempts / 30) * 100 : game.status === 'ready' ? 100 : progress}%`,
                  }}
                />
              </div>
            )}
            {game.challenge_date && (
              <p className="daily-status">
                {game.challenge_date} · One daily attempt · {game.attempts}/30 · +
                {game.penalty_seconds}s penalties
              </p>
            )}
            <div className="game-workspace">
              <aside className="previous-panel" aria-label="Previous answer">
                {feedback && (
                  <>
                    <h2>Previous flag</h2>
                    <img
                      ref={previousFlag}
                      key={feedback.question_id}
                      src={feedback.asset_url}
                      alt={`${feedback.accepted_names.join(' / ')} flag`}
                    />
                    <strong>{feedback.accepted_names.join(' / ')}</strong>
                    <p className={feedback.result}>
                      {feedback.result === 'correct'
                        ? '✓ Correct'
                        : feedback.result === 'skipped'
                          ? 'Skipped'
                          : '× Incorrect'}
                    </p>
                    {feedback.result === 'incorrect' && <p>Your answer: {feedback.answer}</p>}
                  </>
                )}
              </aside>
              <div className="game-card">
                <div className="flag-stage">
                  {game.question && (
                    <img
                      ref={currentFlag}
                      key={`${game.question.id}:${imageRetry}`}
                      src={`${game.question.asset_url}${imageRetry ? `?retry=${imageRetry}` : ''}`}
                      alt="Flag to identify"
                      className={imageStatus === 'ready' ? '' : 'flag-loading'}
                      onLoad={() => setImageStatus('ready')}
                      onError={() => setImageStatus('error')}
                    />
                  )}
                  {imageStatus === 'loading' && (
                    <p className="asset-status" role="status">
                      Loading flag…
                    </p>
                  )}
                  {imageStatus === 'error' && (
                    <div className="asset-status" role="alert">
                      <p>
                        This flag could not load.
                        {game.status === 'playing' && game.settings.mode !== 'practice'
                          ? ' The clock keeps running.'
                          : ''}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => {
                          setImageStatus('loading')
                          setImageRetry((i) => i + 1)
                        }}
                      >
                        Retry flag
                      </button>
                    </div>
                  )}
                </div>
                <div
                  className="feedback"
                  role="status"
                  aria-label="Answer feedback"
                  aria-live="polite"
                >
                  {game.status === 'ready' ? (
                    <div className="warmup">
                      <strong data-testid="warmup-answer">{game.warmup_answer}</strong>
                      <p>
                        Enter this country to{' '}
                        {game.settings.mode !== 'practice' ? 'start the timer' : 'start playing'}.
                      </p>
                      {warmupError && <p className="incorrect">{warmupError}</p>}
                    </div>
                  ) : flash && feedback ? (
                    <div className="answer-flash">
                      {feedback.result === 'skipped' ? 'Skipped.' : 'Incorrect.'} Correct answer:{' '}
                      <strong>{feedback.accepted_names.join(' / ')}</strong>
                    </div>
                  ) : feedback?.result === 'correct' ? (
                    <span className="correct">✓ Correct</span>
                  ) : null}
                </div>
                <AnswerInput
                  countries={countries}
                  questionId={game.question!.id}
                  disabled={
                    settingsOpen ||
                    settingsVisible ||
                    busy ||
                    !!error ||
                    imageStatus !== 'ready' ||
                    remaining <= 0
                  }
                  onAnswer={(text) => answer(text)}
                  onSkip={game.status === 'playing' ? () => answer('', true) : undefined}
                />
              </div>
              <aside className="score-panel" aria-label="Round statistics">
                <dl>
                  <div className="correct">
                    <dt>Correct</dt>
                    <dd>{game.score}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{game.attempts}</dd>
                  </div>
                </dl>
              </aside>
            </div>
          </section>
        )}
        {game?.status === 'finished' && (
          <Results
            game={game}
            best={state.best}
            saved={state.saved}
            replay={() => {
              reset()
              setSettingsOpen(false)
              begin(game.settings)
            }}
            practice={() => {
              const missed = [
                ...new Set(
                  (game.history ?? [])
                    .filter((a) => a.result !== 'correct')
                    .flatMap((a) => a.country_ids),
                ),
              ]
              const next: Settings = {
                ...game.settings,
                mode: 'practice',
                scope: 'all',
                country_ids: missed,
              }
              reset()
              setSettingsOpen(false)
              setSettings(next)
              begin(next)
            }}
          />
        )}
      </main>
    </div>
  )
}
