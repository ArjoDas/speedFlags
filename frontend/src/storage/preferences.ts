import { validGame, type Game, type Settings } from '../api/client'
export const defaults: Settings = {
  mode: 'challenge',
  duration: 30,
  bonus: 0,
  scope: 'all',
  country_ids: [],
}
export function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(`speedflags.${key}`) ?? 'null')
  } catch {
    return null
  }
}
export function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(`speedflags.${key}`, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
export function loadSettings(): Settings {
  const saved = read('settings.v2') as Partial<Settings> | null
  if (!saved) return { ...defaults }
  return {
    mode: saved.mode === 'practice' || saved.mode === 'timed' ? saved.mode : 'challenge',
    duration:
      saved.mode === 'timed' && [30, 45, 60, 120].includes(saved.duration ?? 0)
        ? saved.duration!
        : 30,
    bonus: saved.mode === 'timed' && [0, 2, 5].includes(saved.bonus ?? -1) ? saved.bonus! : 0,
    scope: saved.mode === 'challenge' || saved.scope === 'all' ? 'all' : 'starter',
    country_ids: [],
  }
}
export function bestKey(game: Game): string {
  const s = game.settings
  return `${game.dataset_version}:${s.mode}:${s.duration}:${s.bonus}:${s.scope}`
}
export function recordBest(game: Game): { best: number; saved: boolean } {
  const raw = read('bests.v1')
  const bests: Record<string, number> =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? Object.fromEntries(
          Object.entries(raw)
            .filter(([, v]) => Number.isInteger(v) && v >= 0 && v <= 250)
            .slice(-99),
        )
      : {}
  const key = bestKey(game)
  const best = Math.max(bests[key] ?? 0, game.eligible_best ? game.score : 0)
  if (!game.eligible_best) return { best, saved: true }
  return { best, saved: write('bests.v1', { ...bests, [key]: best }) }
}

export function dailyKey(game: Game): string {
  return `daily.v2.${game.challenge_date}`
}
export function storedDaily(game: Game): Game | null {
  const saved = (read(dailyKey(game)) ??
    read(`daily.v1.${game.challenge_date}.${game.dataset_version}`)) as Game | null
  try {
    return saved &&
      saved.challenge_date === game.challenge_date &&
      saved.settings?.mode === 'challenge'
      ? validGame(saved)
      : null
  } catch {
    return null
  }
}
