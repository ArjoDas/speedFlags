import type { Settings } from '../api/client'
type Props = {
  settings: Settings
  onChange: (settings: Settings) => void
  onStart: () => void
  disabled: boolean
}
export function Setup({ settings, onChange, onStart, disabled }: Props) {
  return (
    <section className="setup-card" aria-label="Game setup">
      <fieldset disabled={disabled}>
        <legend>Mode</legend>
        <div className="segments">
          {(['challenge', 'timed', 'practice'] as const).map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="mode"
                checked={settings.mode === mode}
                onChange={() =>
                  onChange({
                    ...settings,
                    mode,
                    ...(mode === 'challenge' ? { duration: 30, bonus: 0, scope: 'all' } : {}),
                  })
                }
              />
              <span>
                {mode === 'challenge' ? 'Daily Challenge' : mode === 'timed' ? 'Timed' : 'Practice'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {settings.mode === 'challenge' && (
        <div className="challenge-rules">
          <p>
            30 flags daily
            <br />
            +5s per wrong answer or skip
          </p>
          <p>One attempt per day</p>
        </div>
      )}
      {settings.mode === 'timed' && (
        <>
          <fieldset disabled={disabled}>
            <legend>Time</legend>
            <div className="segments">
              {([30, 45, 60, 120] as const).map((duration) => (
                <label key={duration}>
                  <input
                    type="radio"
                    name="duration"
                    checked={settings.duration === duration}
                    onChange={() => onChange({ ...settings, duration })}
                  />
                  <span>{duration}s</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={disabled}>
            <legend>Bonus per correct answer</legend>
            <div className="segments">
              {([0, 2, 5] as const).map((bonus) => (
                <label key={bonus}>
                  <input
                    type="radio"
                    name="bonus"
                    checked={settings.bonus === bonus}
                    onChange={() => onChange({ ...settings, bonus })}
                  />
                  <span>{bonus === 0 ? 'None' : `+${bonus}s`}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {settings.mode !== 'challenge' && (
        <fieldset disabled={disabled}>
          <legend>Flags</legend>
          <div className="segments">
            {(['starter', 'all'] as const).map((scope) => (
              <label key={scope}>
                <input
                  type="radio"
                  name="scope"
                  checked={settings.scope === scope}
                  onChange={() => onChange({ ...settings, scope, country_ids: [] })}
                />
                <span>{scope === 'starter' ? 'Starter 50' : 'All flags'}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button className="primary start-button" disabled={disabled} onClick={onStart}>
        {disabled ? 'Loading…' : 'Play'}
      </button>
    </section>
  )
}
