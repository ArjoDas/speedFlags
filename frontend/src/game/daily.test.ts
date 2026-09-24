import { describe, expect, it } from 'vitest'
import { dailyShare, formatTime } from './daily'
import type { Game } from '../api/client'

describe('daily share', () => {
  it('copies only five rows of six outcomes and penalty-inclusive time', () => {
    const game = {
      challenge_date: '2026-09-24',
      finish_reason: 'deck',
      adjusted_seconds: 132,
      history: Array.from({ length: 30 }, (_, i) => ({
        result: i < 24 ? 'correct' : i < 28 ? 'incorrect' : 'skipped',
      })),
    } as Game
    expect(dailyShare(game)).toBe(`${'🟩'.repeat(6)}\n`.repeat(4) + '🟥🟥🟥🟥🟨🟨\n\n2:12')
    expect(dailyShare({ ...game, finish_reason: 'ended' })).toBeNull()
    expect(formatTime(61.1)).toBe('1:02')
  })
})
