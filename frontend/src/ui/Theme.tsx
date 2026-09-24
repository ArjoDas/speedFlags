import { useEffect, useState } from 'react'
export function Theme() {
  const [theme, setTheme] = useState(() => {
    try {
      const t = localStorage.getItem('speedflags.theme')
      return t === 'light' || t === 'dark' ? t : 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
    }
    apply()
    media.addEventListener('change', apply)
    try {
      localStorage.setItem('speedflags.theme', theme)
    } catch {
      /* storage is optional */
    }
    return () => media.removeEventListener('change', apply)
  }, [theme])
  return (
    <div className="theme-options" role="group" aria-label="Color theme">
      {(['system', 'light', 'dark'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          {value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  )
}
