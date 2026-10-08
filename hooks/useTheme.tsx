import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  lightColors,
  darkColors,
  type ThemeColors,
  type ThemeMode,
} from '../lib/theme'

const THEME_KEY = '@panicai:theme'

type ThemeContextValue = {
  colors: ThemeColors
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored)
      }
      setReady(true)
    })
  }, [])

  const effectiveScheme =
    mode === 'system' ? (systemScheme ?? 'light') : mode
  const isDark = effectiveScheme === 'dark'
  const colors = isDark ? darkColors : lightColors

  async function setMode(next: ThemeMode) {
    setModeState(next)
    await AsyncStorage.setItem(THEME_KEY, next)
  }

  if (!ready) return null

  return (
    <ThemeContext.Provider value={{ colors, mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
