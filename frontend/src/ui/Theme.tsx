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
    <label className="theme-select">
      <span className="sr-only">Color theme</span>
      <span aria-hidden="true">◐</span>
      <select aria-label="Color theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}
