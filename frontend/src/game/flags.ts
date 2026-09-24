import { api, ApiError, preload } from '../api/client'

// Retain loaded images for the page lifetime. Immutable HTTP caching also reuses
// their downloads on later visits, subject to the browser's cache limits.
const loaded = new Map<string, HTMLImageElement>()
export type FlagProgress = { loaded: number; total: number }

export async function preloadFlags(
  signal: AbortSignal,
  onProgress: (progress: FlagProgress | null) => void,
) {
  const urls = await api.flags(signal)
  signal.throwIfAborted()
  let completed = urls.filter((url) => loaded.has(url)).length
  onProgress({ loaded: completed, total: urls.length })
  const pending = urls.filter((url) => !loaded.has(url))
  const stop = new AbortController()
  const combined = AbortSignal.any([signal, stop.signal])
  let next = 0
  try {
    await Promise.all(
      Array.from({ length: Math.min(6, pending.length) }, async () => {
        while (next < pending.length) {
          combined.throwIfAborted()
          const url = pending[next++]
          const image = await preload(url, combined)
          combined.throwIfAborted()
          loaded.set(url, image)
          onProgress({ loaded: ++completed, total: urls.length })
        }
      }),
    )
    onProgress(null)
  } catch (error) {
    stop.abort()
    if (signal.aborted) throw error
    throw new ApiError('Could not load all flags. Check your connection and retry before starting.')
  }
}
