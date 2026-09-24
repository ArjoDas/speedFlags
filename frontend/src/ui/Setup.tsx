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
      <h1>New game</h1>
      <fieldset disabled={disabled}>
        <legend>Mode</legend>
        <div className="segments">
          {(['timed', 'practice'] as const).map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="mode"
                checked={settings.mode === mode}
                onChange={() => onChange({ ...settings, mode })}
              />
              <span>{mode === 'timed' ? 'Timed' : 'Practice'}</span>
            </label>
          ))}
        </div>
      </fieldset>
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
          <label className="bonus-toggle">
            <input
              type="checkbox"
              disabled={disabled}
              checked={settings.bonus === 5}
              onChange={(e) => onChange({ ...settings, bonus: e.target.checked ? 5 : 0 })}
            />
            +5 seconds per correct answer
          </label>
        </>
      )}
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
      <button className="primary start-button" disabled={disabled} onClick={onStart}>
        {disabled ? 'Loading…' : 'Play'}
      </button>
    </section>
  )
}
