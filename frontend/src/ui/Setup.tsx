import type { Settings } from '../api/client'
type Props = {
  settings: Settings
  onChange: (settings: Settings) => void
  onStart: () => void
  disabled: boolean
}
export function Setup({ settings, onChange, onStart, disabled }: Props) {
  return (
    <section className="setup-grid" aria-label="Game setup">
      <div className="intro">
        <div className="eyebrow">
          <span className="status-dot" /> YOUR DAILY DOSE OF GEOGRAPHY
        </div>
        <h1>
          A world of flags.
          <br />
          <span>
            How many
            <br className="desktop-break" /> do you know?
          </span>
        </h1>
        <p className="intro-copy">
          A little geography. A little adrenaline.
          <br />
          Put a name to the flag and see how far you go.
        </p>
        <div className="flag-collage" aria-hidden="true">
          <div className="mini-flag japan">
            <i />
          </div>
          <div className="mini-flag france" />
          <div className="mini-flag brazil">
            <i />
          </div>
          <span className="collage-caption">One planet. Plenty to learn.</span>
        </div>
        <div className="intro-facts">
          <span>
            <strong>245</strong> distinct flags
          </span>
          <span>
            <strong>250</strong> countries & territories
          </span>
        </div>
      </div>
      <div className="setup-card">
        <div className="card-heading">
          <span className="eyebrow">MAKE IT YOUR GAME</span>
          <span className="small-star" aria-hidden="true">
            ✳
          </span>
        </div>
        <h2>Ready, set, explore.</h2>
        <fieldset disabled={disabled}>
          <legend>Choose your pace</legend>
          <div className="mode-options">
            {(['timed', 'practice'] as const).map((mode) => (
              <label key={mode} className={`mode-option ${settings.mode === mode ? 'chosen' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  value={mode}
                  checked={settings.mode === mode}
                  onChange={() => onChange({ ...settings, mode })}
                />
                <span className="mode-icon" aria-hidden="true">
                  {mode === 'timed' ? '↗' : '◎'}
                </span>
                <strong>{mode === 'timed' ? 'Against the clock' : 'Just practicing'}</strong>
                <small>
                  {mode === 'timed' ? 'Quick thinking. Keep going.' : 'No rush. Find your rhythm.'}
                </small>
              </label>
            ))}
          </div>
        </fieldset>
        {settings.mode === 'timed' && (
          <div className="settings-row">
            <fieldset disabled={disabled}>
              <legend>Time on the clock</legend>
              <div className="segments">
                {([30, 45, 60, 120] as const).map((duration) => (
                  <label key={duration} className={settings.duration === duration ? 'chosen' : ''}>
                    <input
                      type="radio"
                      name="duration"
                      checked={settings.duration === duration}
                      onChange={() => onChange({ ...settings, duration })}
                    />
                    {duration}s
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="bonus-toggle">
              <input
                type="checkbox"
                checked={settings.bonus === 5}
                disabled={disabled}
                onChange={(e) => onChange({ ...settings, bonus: e.target.checked ? 5 : 0 })}
              />
              <span>
                <strong>Bonus time</strong>
                <small>+5s per correct answer</small>
              </span>
            </label>
          </div>
        )}
        <label className="scope-label" htmlFor="scope">
          Your flag collection
        </label>
        <select
          id="scope"
          value={settings.scope}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...settings, scope: e.target.value as Settings['scope'], country_ids: [] })
          }
        >
          <option value="starter">The starting fifty · a familiar first step</option>
          <option value="all">The whole world · countries & territories</option>
        </select>
        {!!settings.country_ids?.length && (
          <p className="practice-note">
            Practicing {settings.country_ids.length} entries from your last round.
          </p>
        )}
        <button className="primary start-button" disabled={disabled} onClick={onStart}>
          {disabled
            ? 'Getting your flags ready…'
            : settings.mode === 'timed'
              ? 'Let’s play'
              : 'Start practicing'}
          <span aria-hidden="true">↗</span>
        </button>
        <p className="setup-note">
          {settings.mode === 'timed'
            ? 'The clock starts when your first flag is ready.'
            : 'Take your time. Finish whenever you like.'}
        </p>
      </div>
      <details className="rules">
        <summary>How scoring works</summary>
        <p>
          Each correct flag earns one point. Skip advances without a point and counts as an attempt.
          Equivalent shared flags accept any listed name. Timed rounds keep running during tab
          changes and network delays; optional bonus time adds five seconds per correct answer. All
          rounds last at most 15 minutes. Finish early whenever you like, but only completed timed
          rounds update your personal best.
        </p>
      </details>
      <div className="how-to">
        <span className="eyebrow">A QUICK FIELD GUIDE</span>
        <div>
          <b>01</b>
          <p>
            <strong>Spot the flag.</strong>
            <span>Look closely. You’ve got this.</span>
          </p>
        </div>
        <div>
          <b>02</b>
          <p>
            <strong>Name the place.</strong>
            <span>Type, choose, or skip to the next.</span>
          </p>
        </div>
        <div>
          <b>03</b>
          <p>
            <strong>Know a little more.</strong>
            <span>Review your round. Try again.</span>
          </p>
        </div>
      </div>
    </section>
  )
}
