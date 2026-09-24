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
  return `${rows.join('\n')}\n\n${formatTime(game.adjusted_seconds ?? 0)}`
}
