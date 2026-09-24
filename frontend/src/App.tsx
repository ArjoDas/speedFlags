import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { api, ApiError, preload, type Country, type Game, type Settings } from './api/client'
import { loadSettings, recordBest, write } from './storage/preferences'
import { AnswerInput } from './ui/AnswerInput'
import { Results } from './ui/Results'
import { Setup } from './ui/Setup'
import { Theme } from './ui/Theme'
import { normalize } from './game/search'

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
  const [warmupError, setWarmupError] = useState('')
  const [flash, setFlash] = useState(false)
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
      return prepared
    })
  }
  function reset() {
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
      run((signal) => api.start(game, text, signal))
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

  useEffect(() => {
    setFlash(!!game?.last_attempt && game.last_attempt.result !== 'correct')
    const timer = setTimeout(() => setFlash(false), 3000)
    return () => clearTimeout(timer)
  }, [game?.last_attempt?.question_id, game?.last_attempt?.result])

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
          <Theme />
        </div>
      </header>
      <main id="main">
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
        {!game && (
          <Setup
            settings={settings}
            disabled={busy}
            onChange={setSettings}
            onStart={() => begin()}
          />
        )}
        {game && game.status !== 'finished' && (
          <section className="play-layout" aria-label="Flag game">
            <h1 className="sr-only">Flag game</h1>
            <div className="play-top">
              <span
                className={`timer ${remaining < 10000 ? 'urgent' : ''}`}
                aria-label={
                  game.settings.mode === 'timed'
                    ? `${game.status === 'ready' ? game.settings.duration : Math.ceil(remaining / 1000)} seconds remaining`
                    : 'Untimed practice'
                }
              >
                {game.settings.mode === 'timed'
                  ? `${game.status === 'ready' ? game.settings.duration : (remaining / 1000).toFixed(1)}s`
                  : 'Untimed'}
              </span>
              <button
                className="text-button"
                onClick={game.status === 'ready' ? reset : finish}
                disabled={busy}
              >
                {game.status === 'ready' ? 'Change settings' : 'Finish round'}
              </button>
            </div>
            {game.settings.mode === 'timed' && (
              <div
                className="time-track"
                role="progressbar"
                aria-label="Time remaining"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={game.status === 'ready' ? 100 : Math.round(progress)}
              >
                <div style={{ width: `${game.status === 'ready' ? 100 : progress}%` }} />
              </div>
            )}
            <div className="game-workspace">
              <aside className="previous-panel" aria-label="Previous answer">
                {feedback && (
                  <>
                    <h2>Previous flag</h2>
                    <img
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
                        {game.status === 'playing' && game.settings.mode === 'timed'
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
                        {game.settings.mode === 'timed' ? 'start the timer' : 'start playing'}.
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
                  disabled={busy || !!error || imageStatus !== 'ready' || remaining <= 0}
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
    </div>
  )
}
