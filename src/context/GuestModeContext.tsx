import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

type EntryMode = 'welcome' | 'guest' | 'signin' | 'signup' | 'forgot';

interface GuestModeContextValue {
  mode: EntryMode;
  isGuest: boolean;
  enterGuestMode: () => void;
  /** Callable from anywhere in the tree (e.g. the Account tab while browsing as a guest), not
   * just the Welcome screen - flips back to the sign-in flow regardless of nesting depth. */
  requestSignIn: () => void;
  requestSignUp: () => void;
  requestForgotPassword: () => void;
  returnToWelcome: () => void;
}

const GuestModeContext = createContext<GuestModeContextValue | undefined>(undefined);

// Tracks the pre-auth entry flow (Welcome -> Sign In, or Welcome -> browse as guest) as its own
// state, separate from AuthContext's user - lets the storefront (Home/Product Detail) stay open
// to guests, matching the website (a guest can browse products freely there and only hits a login
// wall at account-specific actions), while nested screens like Account can prompt to sign in
// instead of rendering blank when there's no user.
export const GuestModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Opening the app (or scanning the Expo Go QR code) lands on the Welcome screen's Sign In/Sign
  // Up choice by default - a previous revision skipped straight to guest browsing on launch, but
  // that isn't how the website behaves either: the website has no upfront guest-choice gate at
  // all, it only gates the one place that actually needs an identity - checkout (see
  // CheckoutAddressScreen.tsx's own guest-checkout gate, which is the accurate 1:1 port of the
  // website's "Sign in to checkout" / "Continue as Guest" card). Welcome-first here is a deliberate
  // mobile-app convention, not a mismatch with the website - the mismatch would have been *not*
  // gating checkout at all, which this revision also fixes.
  const [mode, setMode] = useState<EntryMode>('welcome');

  // Signing out should land straight on the storefront (Home, browsing as a guest), not whatever
  // pre-auth screen happened to be showing right before this session's login (e.g. 'signin', left
  // over from before the user authenticated, or 'welcome') - mode otherwise just sits frozen at
  // that value the whole time a user is signed in, since nothing else in this pre-auth flow runs
  // while `user` is set.
  const { user } = useAuth();
  const wasSignedIn = useRef(!!user);
  useEffect(() => {
    if (wasSignedIn.current && !user) setMode('guest');
    wasSignedIn.current = !!user;
  }, [user]);

  return (
    <GuestModeContext.Provider
      value={{
        mode,
        isGuest: mode === 'guest',
        enterGuestMode: () => setMode('guest'),
        requestSignIn: () => setMode('signin'),
        requestSignUp: () => setMode('signup'),
        requestForgotPassword: () => setMode('forgot'),
        returnToWelcome: () => setMode('welcome'),
      }}
    >
      {children}
    </GuestModeContext.Provider>
  );
};

export function useGuestMode(): GuestModeContextValue {
  const ctx = useContext(GuestModeContext);
  if (!ctx) throw new Error('useGuestMode must be used within a GuestModeProvider');
  return ctx;
}
