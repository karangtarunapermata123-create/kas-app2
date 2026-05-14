import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Cek localStorage dulu
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'light' || stored === 'dark') return stored
    
    // Fallback ke system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    console.log('Theme changed to:', theme)
    if (theme === 'dark') {
      root.classList.add('dark')
      console.log('Added dark class to html')
    } else {
      root.classList.remove('dark')
      console.log('Removed dark class from html')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
