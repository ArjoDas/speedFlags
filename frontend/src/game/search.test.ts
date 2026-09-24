import { describe, expect, it } from 'vitest'
import { normalize, suggestions } from './search'
import { loadSettings, recordBest } from '../storage/preferences'
import type { Game } from '../api/client'

const countries = [
  { id: 'US', name: 'United States', aliases: ['USA'] },
  { id: 'GB', name: 'United Kingdom', aliases: ['UK'] },
  { id: 'CI', name: 'Ivory Coast', aliases: ['Côte d’Ivoire'] },
]
describe('country search', () => {
  it('normalizes punctuation, spacing and accents', () => {
    expect(normalize(" Côte d'Ivoire ")).toBe(normalize('cote d’ivoire'))
    expect(normalize('Türkiye')).toBe('turkiye')
  })
  it('matches aliases and does not auto-select an ambiguous prefix', () => {
    expect(suggestions(countries, 'USA')[0].id).toBe('US')
    expect(suggestions(countries, 'united')).toHaveLength(2)
    expect(suggestions(countries, '')).toEqual([])
    expect(suggestions(countries, 'xyz')).toEqual([])
  })
})
it('storage failure falls back safely', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('denied')
    },
  })
  expect(loadSettings().duration).toBe(30)
  const result = recordBest({
    settings: { mode: 'timed', duration: 30, bonus: 0, scope: 'all' },
    dataset_version: 'x',
    eligible_best: true,
    score: 5,
  } as Game)
  expect(result).toEqual({ best: 5, saved: false })
})
