import type { FC, ReactNode } from 'react'
import {
  DefaultMainMenu,
  DefaultMainMenuContent,
  TldrawUiMenuGroup as _TldrawUiMenuGroup,
  TldrawUiMenuItem as _TldrawUiMenuItem,
} from 'tldraw'
import { useAuth } from '../shell/AuthContext'

// React 18's ReactNode doesn't include bigint; tldraw's components
// are typed against a newer React whose ReactNode does. Cast through
// unknown so the JSX type-check passes; runtime contract is unchanged.
const TldrawUiMenuGroup = _TldrawUiMenuGroup as unknown as FC<{
  id: string
  children?: ReactNode
}>
const TldrawUiMenuItem = _TldrawUiMenuItem as unknown as FC<{
  id: string
  label: string
  icon?: string
  readonlyOk?: boolean
  onSelect: () => void
}>

// Custom MainMenu wrapping tldraw's default content + a VADE
// auth group with a Sign-out item. Wired into tldrawComponents
// in App.tsx. Closes vade-core#186.
//
// The Sign-out item triggers AuthContext.signOut() which clears
// localStorage, disconnects the bridge, and returns the user to
// the TokenGate. window.confirm gates the destructive action;
// canvas autosave is continuous so unsaved-loss is bounded.
export function MainMenu() {
  const { signOut } = useAuth()

  const handleSignOut = () => {
    const ok = window.confirm(
      "Sign out? You'll need to re-paste your operator token to return. " +
      'Canvas changes are autosaved continuously.',
    )
    if (ok) signOut()
  }

  return (
    <DefaultMainMenu>
      <DefaultMainMenuContent />
      <TldrawUiMenuGroup id="vade-auth">
        <TldrawUiMenuItem
          id="sign-out"
          label="Sign out"
          icon="exit"
          readonlyOk
          onSelect={handleSignOut}
        />
      </TldrawUiMenuGroup>
    </DefaultMainMenu>
  )
}
