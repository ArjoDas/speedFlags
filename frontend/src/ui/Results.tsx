import { useEffect, useRef, useState } from 'react'
import { dailyShare, formatTime } from '../game/daily'
import type { Game } from '../api/client'
type Props = {
  game: Game
  best: number
  saved: boolean
  replay: () => void
  practice: () => void
}
export function Results({ game, best, saved, replay, practice }: Props) {
  const [copyState, setCopyState] = useState('')
  useEffect(() => {
    if (copyState !== 'Copied') return
    const timer = setTimeout(() => setCopyState(''), 2000)
    return () => clearTimeout(timer)
  }, [copyState])
  const share = dailyShare(game)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const history = game.history ?? []
  const missed = history.filter((a) => a.result !== 'correct')
  const accuracy = game.attempts ? Math.round((game.score / game.attempts) * 100) : 0
  const resultHeading = (
    <div className="result-heading">
      <h1 ref={heading} tabIndex={-1}>
        Results
      </h1>
      <p>
        {game.finish_reason === 'time'
          ? 'Time’s up.'
          : game.finish_reason === 'deck'
            ? 'All flags completed.'
            : 'Round finished.'}
      </p>
    </div>
  )
  return (
    <section className="results">
      {game.challenge_date ? (
        <div className="daily-overview">
          <div className="daily-summary">
            {resultHeading}
            <div className="daily-result">
              <strong>
                {game.finish_reason === 'deck' ? formatTime(game.adjusted_seconds) : 'Incomplete'} ·{' '}
                {game.score}/30
              </strong>
              <p>
                {formatTime(game.elapsed_seconds)} + {game.penalty_seconds}s penalties
              </p>
              <p>{game.challenge_date} · Daily attempt used. Come back tomorrow.</p>
            </div>
          </div>
          {share && (
            <div className="daily-share">
              <pre aria-label="Share preview">{share}</pre>
            </div>
          )}
        </div>
      ) : (
        <>
          {resultHeading}
          <div className="result-stats">
            <div>
              <span>Correct flags</span>
              <strong>
                {game.score}
                <small> / {game.attempts}</small>
              </strong>
            </div>
            <div>
              <span>Accuracy</span>
              <strong>
                {accuracy}
                <small>%</small>
              </strong>
            </div>
            <div>
              <span>Personal best</span>
              <strong>{game.settings.mode !== 'practice' ? best : '—'}</strong>
            </div>
          </div>
        </>
      )}
      <div className="result-actions">
        {!game.challenge_date && (
          <button className="primary" onClick={replay}>
            Play again
            <span aria-hidden="true">↗</span>
          </button>
        )}
        {missed.length > 0 && (
          <button className="secondary" onClick={practice}>
            Practice missed flags
          </button>
        )}
        {share && (
          <button
            className="primary copy-result"
            disabled={copyState === 'Copied' || copyState === 'Copying…'}
            aria-live="polite"
            onClick={async () => {
              setCopyState('Copying…')
              try {
                await navigator.clipboard.writeText(share)
                setCopyState('Copied')
              } catch {
                setCopyState('Could not copy. Select and copy the text below.')
              }
            }}
          >
            {copyState === 'Copied' || copyState === 'Copying…' ? copyState : 'Copy result'}
          </button>
        )}
      </div>
      {share && copyState.startsWith('Could') && (
        <div className="share-status">
          {' '}
          <p role="status">{copyState}</p>
          {copyState.startsWith('Could') && (
            <textarea
              aria-label="Result to copy"
              readOnly
              value={share}
              onFocus={(event) => event.target.select()}
            />
          )}
        </div>
      )}
      {!game.challenge_date && (
        <p className="result-note">
          Accuracy includes skipped flags. Unanswered flags are not counted.{' '}
          {game.eligible_best
            ? 'Personal bests use these exact settings and dataset.'
            : 'This round does not update timed personal bests.'}
        </p>
      )}
      {!saved && (
        <p className="result-note">
          Browser storage is unavailable; this result could not be saved.
        </p>
      )}
      <div className="review-heading">
        <h2>Answers</h2>
        <span>{history.length} answers</span>
      </div>
      {!history.length ? (
        <p className="empty-review">No answers this time. Start a new round when you’re ready.</p>
      ) : (
        <div className="review-grid">
          {history.map((attempt, i) => (
            <article className={`review-card ${attempt.result}`} key={attempt.question_id}>
              <div className="review-flag">
                <span className="flag-number">{String(i + 1).padStart(2, '0')}</span>
                <img
                  src={attempt.asset_url}
                  alt={`${attempt.accepted_names.join(' / ')} flag`}
                  loading="lazy"
                />
              </div>
              <div className="review-copy">
                <span className={`result-badge ${attempt.result}`}>
                  {attempt.result === 'correct'
                    ? '✓ Correct'
                    : attempt.result === 'skipped'
                      ? '→ Skipped'
                      : '× Incorrect'}
                </span>
                <h3>{attempt.accepted_names.join(' / ')}</h3>
                <p>
                  Your answer: <strong>{attempt.answer || 'Skipped'}</strong>
                </p>
                {attempt.accepted_names.length > 1 && (
                  <small>Shared flag: either name is accepted.</small>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
