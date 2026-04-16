'use client'

import { useTheme } from '@/hooks/useTheme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} mode`}
    >
      <span aria-hidden="true" style={{ fontSize: '0.82rem' }}>
        {theme === 'light' ? '☀' : '☾'}
      </span>
      <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  )
}
