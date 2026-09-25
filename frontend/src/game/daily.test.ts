import { describe, expect, it } from 'vitest'
import { dailyShare, formatTime } from './daily'
import type { Game } from '../api/client'

describe('daily share', () => {
  it('copies the dated site attribution, grid, adjusted time and score', () => {
    const game = {
      challenge_date: '2026-09-24',
      finish_reason: 'deck',
      adjusted_seconds: 132,
      score: 24,
      history: Array.from({ length: 30 }, (_, i) => ({
        result: i < 24 ? 'correct' : i < 28 ? 'incorrect' : 'skipped',
      })),
    } as Game
    expect(dailyShare(game)).toBe(
      'Here’s my speedFlags.win result\non 24-09-26\n' +
        `${'🟩'.repeat(6)}\n`.repeat(4) +
        '🟥🟥🟥🟥🟨🟨\ntime: 2:12, score 24/30',
    )
    expect(dailyShare({ ...game, finish_reason: 'ended' })).toBeNull()
    expect(formatTime(61.1)).toBe('1:02')
  })
})
