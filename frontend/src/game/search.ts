import type { Country } from '../api/client'
export const normalize = (text: string) =>
  text
    .toLocaleLowerCase('en')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
export function suggestions(countries: Country[], text: string): Country[] {
  const needle = normalize(text)
  if (!needle) return []
  const rank = (country: Country) =>
    Math.min(
      ...[country.name, ...country.aliases].map((name) => {
        const value = normalize(name)
        return value === needle ? 0 : value.startsWith(needle) ? 1 : value.includes(needle) ? 2 : 3
      }),
    )
  return countries
    .map((country) => ({ country, rank: rank(country) }))
    .filter((c) => c.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name))
    .slice(0, 5)
    .map((c) => c.country)
}
