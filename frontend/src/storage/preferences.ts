import type { Game, Settings } from '../api/client'
export const defaults: Settings = {
  mode: 'timed',
  duration: 30,
  bonus: 0,
  scope: 'starter',
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
  const saved = read('settings.v1') as Partial<Settings> | null
  if (!saved) return { ...defaults }
  return {
    mode: saved.mode === 'practice' ? 'practice' : 'timed',
    duration: [30, 45, 60, 120].includes(saved.duration ?? 0) ? saved.duration! : 30,
    bonus: saved.bonus === 5 ? 5 : 0,
    scope: saved.scope === 'all' ? 'all' : 'starter',
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
