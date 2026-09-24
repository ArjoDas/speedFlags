import type { components } from './schema'
export type Game = components['schemas']['GameResponse']
export type Settings = components['schemas']['Settings']
export type Country = components['schemas']['Country']
export type Attempt = components['schemas']['Attempt']
export type Answer = components['schemas']['AnswerRequest']

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message)
  }
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(15000)
  let response: Response
  try {
    response = await fetch(`/api/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError('Could not reach the game server. Check your connection and retry.')
  }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new ApiError('The server returned an unexpected response. Please retry.')
  }
  if (!response.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message
    throw new ApiError(
      typeof message === 'string' ? message : 'Something went wrong. Please retry.',
      response.status,
    )
  }
  return data as T
}

function validAttempt(value: Attempt | null): boolean {
  return (
    !!value &&
    typeof value.question_id === 'string' &&
    /^\/flags\/[a-f0-9]{24}\.svg$/.test(value.asset_url) &&
    typeof value.answer === 'string' &&
    ['correct', 'incorrect', 'skipped'].includes(value.result) &&
    Array.isArray(value.accepted_names) &&
    value.accepted_names.length > 0 &&
    value.accepted_names.every((n) => typeof n === 'string') &&
    Array.isArray(value.country_ids) &&
    value.country_ids.every((id) => typeof id === 'string')
  )
}
function validGame(data: Game): Game {
  if (
    !data ||
    typeof data.token !== 'string' ||
    typeof data.id !== 'string' ||
    !Number.isInteger(data.score) ||
    data.score < 0 ||
    !Number.isFinite(data.server_time) ||
    !Number.isInteger(data.attempts) ||
    data.attempts < data.score ||
    !['ready', 'playing', 'finished'].includes(data.status) ||
    (data.status === 'ready' && (typeof data.warmup_answer !== 'string' || !data.warmup_answer)) ||
    !data.settings ||
    !['timed', 'practice'].includes(data.settings.mode!) ||
    ![30, 45, 60, 120].includes(data.settings.duration!) ||
    typeof data.dataset_version !== 'string' ||
    (data.deadline !== null && !Number.isFinite(data.deadline)) ||
    (data.last_attempt !== null &&
      data.last_attempt !== undefined &&
      !validAttempt(data.last_attempt)) ||
    (data.status === 'finished' &&
      (!Array.isArray(data.history) ||
        data.history.length !== data.attempts ||
        !data.history.every(validAttempt))) ||
    (data.status !== 'finished' &&
      (!data.question ||
        typeof data.question.id !== 'string' ||
        data.question.sequence !== data.attempts ||
        !/^\/flags\/[a-f0-9]{24}\.svg$/.test(data.question.asset_url)))
  ) {
    throw new ApiError('The server returned incomplete game data. Please retry.')
  }
  return data
}

export const api = {
  countries: async (signal?: AbortSignal) => {
    const data = await request<components['schemas']['CountryList']>('countries', undefined, signal)
    if (
      !data ||
      !Array.isArray(data.countries) ||
      data.countries.some(
        (c) => typeof c.id !== 'string' || typeof c.name !== 'string' || !Array.isArray(c.aliases),
      )
    )
      throw new ApiError('Could not load the country list.')
    return data.countries
  },
  create: async (settings: Settings, signal: AbortSignal) =>
    validGame(await request<Game>('games', settings, signal)),
  start: async (game: Game, answer: string, signal: AbortSignal) =>
    validGame(await request<Game>(`games/${game.id}/start`, { token: game.token, answer }, signal)),
  answer: async (game: Game, answer: Answer, signal: AbortSignal) =>
    validGame(await request<Game>(`games/${game.id}/answers`, answer, signal)),
  sync: async (game: Game, signal: AbortSignal) =>
    validGame(await request<Game>(`games/${game.id}/sync`, { token: game.token }, signal)),
  finish: async (game: Game, signal: AbortSignal) =>
    validGame(await request<Game>(`games/${game.id}/finish`, { token: game.token }, signal)),
}

export function preload(url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const finish = (error?: Error) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      image.onload = null
      image.onerror = null
      if (error) reject(error)
      else resolve()
    }
    const abort = () => finish(new Error('Cancelled'))
    const timer = setTimeout(
      () => finish(new ApiError('This flag could not load. Check your connection and retry.')),
      10000,
    )
    signal.addEventListener('abort', abort, { once: true })
    image.onload = () => finish()
    image.onerror = () =>
      finish(new ApiError('This flag could not load. Check your connection and retry.'))
    if (signal.aborted) {
      abort()
      return
    }
    image.src = url
  })
}
