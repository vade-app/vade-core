import { createContext, useContext } from 'react'

// Auth surface exposed to tldraw chrome components (MainMenu, etc.).
// App.tsx provides the value; consumers call signOut() from a menu
// item or button without needing to know about token storage or the
// bridge connection.
export interface AuthContextValue {
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthContext.Provider')
  }
  return ctx
}
