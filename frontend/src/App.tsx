import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { api, ApiError, preload, type Country, type Game, type Settings } from './api/client'
import { loadSettings, recordBest, write } from './storage/preferences'
import { AnswerInput } from './ui/AnswerInput'
import { Results } from './ui/Results'
import { Setup } from './ui/Setup'
import { Theme } from './ui/Theme'

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
  const [countries, setCountries] = useState<Country[]>([])
  const [remaining, setRemaining] = useState(0)
  const [imageStatus, setImageStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [imageRetry, setImageRetry] = useState(0)
  const currentQuestion = useRef('')
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

  const run = useCallback((operation: (signal: AbortSignal) => Promise<Game>) => {
    if (lock.current) return
    lock.current = true
    controller.current = new AbortController()
    const abort = controller.current
    const currentEpoch = epoch.current
    dispatch({ type: 'busy' })
    retry.current = () => run(operation)
    operation(abort.signal)
      .then((result) => {
        if (abort.signal.aborted || currentEpoch !== epoch.current) return
        sync.current = {
          received: performance.now(),
          remaining:
            result.deadline === null
              ? Infinity
              : Math.max(0, (result.deadline - result.server_time) * 1000),
        }
        setRemaining(sync.current.remaining)
        if (result.question?.id !== currentQuestion.current) setImageStatus('loading')
        currentQuestion.current = result.question?.id ?? ''
        dispatch({ type: 'game', game: result })
        retry.current = null
        if (result.status === 'finished') dispatch({ type: 'saved', ...recordBest(result) })
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
  }, [])

  function begin(next = settings) {
    write('settings.v1', { ...next, country_ids: [] })
    // A retry reuses a prepared game after creation, rather than allocating another one.
    let prepared: Game | null = null
    run(async (signal) => {
      prepared ??= await api.create(next, signal)
      await preload(prepared.question!.asset_url, signal)
      return api.start(prepared, signal)
    })
  }
  function reset() {
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
    if (game?.status !== 'playing' || game.deadline === null) return
    const update = () =>
      setRemaining(
        Math.max(0, sync.current.remaining - (performance.now() - sync.current.received)),
      )
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
      game.deadline !== null &&
      remaining <= 0 &&
      !busy &&
      !error &&
      !lock.current
    )
      run((signal) => api.finish(game, signal))
  }, [game, remaining, busy, error, run])

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
          <svg aria-hidden="true" viewBox="0 0 32 32">
            <path d="M7 27V5h19l-5 7 5 7H7" />
          </svg>
          <span>
            speed<span>Flags</span>
            <i>.</i>
          </span>
        </a>
        <div className="header-right">
          <span className="header-tag">KNOW YOUR WORLD</span>
          <Theme />
        </div>
      </header>
      <main id="main">
        {error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>A small detour.</strong>
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
          <Setup
            settings={settings}
            disabled={busy}
            onChange={setSettings}
            onStart={() => begin()}
          />
        )}
        {game?.status === 'playing' && (
          <section className="play-layout" aria-label="Flag game">
            <div className="play-top">
              <div>
                <span className="eyebrow">
                  {game.settings.mode === 'timed' ? 'AGAINST THE CLOCK' : 'ROOM TO EXPLORE'}
                </span>
                <h1>
                  {game.settings.mode === 'timed' ? 'Trust your instincts.' : 'One flag at a time.'}
                </h1>
              </div>
              <button className="text-button" onClick={finish} disabled={busy}>
                Finish round <span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="game-workspace">
              <div className="game-card">
                <div className="flag-card-heading">
                  <span className="eyebrow">FLAG {String(game.attempts + 1).padStart(2, '0')}</span>
                  <span className="collection-label">
                    {game.settings.scope === 'starter' ? 'The starting fifty' : 'The whole world'}
                  </span>
                </div>
                <div className="flag-stage">
                  {game.question && (
                    <img
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
                      Loading your flag…
                    </p>
                  )}
                  {imageStatus === 'error' && (
                    <div className="asset-status" role="alert">
                      <p>This flag could not load. The clock keeps running.</p>
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
                  {feedback ? (
                    <>
                      <span className={`feedback-dot ${feedback.result}`}>
                        {feedback.result === 'correct'
                          ? '✓'
                          : feedback.result === 'skipped'
                            ? '→'
                            : '×'}
                      </span>
                      <span>
                        {feedback.result === 'correct'
                          ? 'Nicely spotted.'
                          : feedback.result === 'skipped'
                            ? 'Keep exploring.'
                            : 'A new one to remember.'}{' '}
                        <strong>{feedback.accepted_names.join(' / ')}</strong>
                      </span>
                    </>
                  ) : (
                    <span>A fresh flag. A fresh start.</span>
                  )}
                </div>
                <AnswerInput
                  countries={countries}
                  questionId={game.question!.id}
                  disabled={busy || !!error || imageStatus !== 'ready' || remaining <= 0}
                  onAnswer={(text) => answer(text)}
                  onSkip={() => answer('', true)}
                />
              </div>
              <aside className="score-panel" aria-label="Round statistics">
                <div className="timer-block">
                  <span className="eyebrow">
                    {game.settings.mode === 'timed' ? 'TIME REMAINING' : 'YOUR PACE'}
                  </span>
                  <div
                    className={`timer ${remaining < 10000 ? 'urgent' : ''}`}
                    aria-label={
                      game.settings.mode === 'timed'
                        ? `${Math.ceil(remaining / 1000)} seconds remaining`
                        : 'Untimed practice'
                    }
                  >
                    {game.settings.mode === 'timed' ? (
                      <>
                        {(remaining / 1000).toFixed(1)}
                        <small>s</small>
                      </>
                    ) : (
                      '∞'
                    )}
                  </div>
                  {game.settings.mode === 'timed' && (
                    <div
                      className="time-track"
                      role="progressbar"
                      aria-label="Time remaining"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress)}
                    >
                      <div style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <p>
                    {game.settings.mode === 'timed'
                      ? game.settings.bonus
                        ? '+5 seconds for every correct flag'
                        : 'Keep your eyes on the next flag.'
                      : 'Time to look a little closer.'}
                  </p>
                </div>
                <div className="score-count">
                  <span>Correct flags</span>
                  <strong>
                    {game.score}
                    <i aria-hidden="true">↗</i>
                  </strong>
                </div>
                <div className="minor-stats">
                  <div>
                    <span>Attempts</span>
                    <strong>{game.attempts}</strong>
                  </div>
                  <div>
                    <span>Skipped</span>
                    <strong>{game.skipped}</strong>
                  </div>
                </div>
                <div className="field-tip">
                  <span aria-hidden="true">✳</span>
                  <p>
                    Some places share a flag.
                    <br />
                    Any accepted name earns the point.
                  </p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {game?.status === 'finished' && (
          <Results
            game={game}
            best={state.best}
            saved={state.saved}
            setup={reset}
            replay={() => {
              reset()
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
              setSettings(next)
              begin(next)
            }}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>Made for curious minds.</span>
        <span>Casual play · No account needed</span>
        <button
          className="text-button"
          onClick={() => {
            try {
              localStorage.removeItem('speedflags.bests.v1')
              localStorage.removeItem('speedflags.settings.v1')
            } catch {
              /* optional */
            }
            setSettings(loadSettings())
            dispatch({ type: 'saved', best: 0, saved: true })
          }}
        >
          Reset saved progress
        </button>
      </footer>
    </div>
  )
}
