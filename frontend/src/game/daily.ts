import type { Game } from '../api/client'

export function formatTime(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export function dailyShare(game: Game): string | null {
  if (!game.challenge_date || game.finish_reason !== 'deck' || game.history?.length !== 30)
    return null
  const blocks = game.history.map((a) =>
    a.result === 'correct' ? '🟩' : a.result === 'incorrect' ? '🟥' : '🟨',
  )
  const rows = Array.from({ length: 5 }, (_, i) => blocks.slice(i * 6, i * 6 + 6).join(''))
  const [year, month, day] = game.challenge_date.split('-')
  return `My results for speedflags.win on ${day}-${month}-${year.slice(-2)}\n${rows.join('\n')}\ntime: ${formatTime(game.adjusted_seconds ?? 0)}, score ${game.score}/30`
}
