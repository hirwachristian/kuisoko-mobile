import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, ApiError } from '../api/client';
import { User } from '../types';
import { registerForPushNotifications, unregisterPushNotifications } from '../lib/pushNotifications';
import { setUserContext } from '../lib/errorReporting';

const TOKEN_KEY = 'kuisoko-token';

interface LoginResult {
  success: boolean;
  requiresTwoFactor?: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  pendingToken: string | null;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  verifyTwoFactorCode: (code: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateLocalUser: (user: User) => void;
  /** Persists a session obtained outside the login form (e.g. right after Sign Up returns its
   * own {user, token}) - shares the same SecureStore-backed persistence as login/2FA instead of
   * duplicating it, and lets a fresh signup land the user straight in instead of re-prompting
   * them to sign in with the password they just typed. */
  completeAuth: (user: User, token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// SecureStore (backed by iOS Keychain / Android Keystore) is the mobile equivalent of the
// website's localStorage token - it's encrypted at rest, which matters here since this is a
// physical device that could be lost or shared, not a browser tab.
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          const { user: me } = await apiFetch<{ user: User }>('/auth/me', {}, storedToken);
          setToken(storedToken);
          setUser(me);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (identifier: string, password: string): Promise<LoginResult> => {
    try {
      const response = await apiFetch<
        { user: User; token: string } | { requiresTwoFactor: true; pendingToken: string; email: string }
      >('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });

      if ('requiresTwoFactor' in response) {
        setPendingToken(response.pendingToken);
        return { success: true, requiresTwoFactor: true };
      }

      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
      setToken(response.token);
      setUser(response.user);
      return { success: true };
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Invalid email/username or password.';
      const retryAfterSeconds = e instanceof ApiError ? e.retryAfterSeconds : undefined;
      return { success: false, error: message, retryAfterSeconds };
    }
  };

  const verifyTwoFactorCode = async (code: string): Promise<LoginResult> => {
    if (!pendingToken) return { success: false, error: 'Sign in again to get a new code.' };
    try {
      const { user: verifiedUser, token: sessionToken } = await apiFetch<{ user: User; token: string }>(
        '/auth/2fa/verify',
        { method: 'POST', body: JSON.stringify({ pendingToken, code }) }
      );
      await SecureStore.setItemAsync(TOKEN_KEY, sessionToken);
      setToken(sessionToken);
      setUser(verifiedUser);
      setPendingToken(null);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof ApiError ? e.message : 'Invalid or expired code.' };
    }
  };

  const completeAuth = async (newUser: User, newToken: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setPendingToken(null);
  };

  const logout = async () => {
    if (token) unregisterPushNotifications(token).catch(() => {});
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setPendingToken(null);
  };

  // Covers every path that lands a token in state - initial auto-login from SecureStore, login(),
  // verifyTwoFactorCode(), and completeAuth() (post-signup) - with one registration call instead
  // of duplicating it in each. Best-effort (see pushNotifications.ts); never blocks sign-in.
  useEffect(() => {
    if (token) registerForPushNotifications(token);
  }, [token]);

  // Lets screens (e.g. Account & Security, after PATCH /users/me or a 2FA change) sync the
  // in-memory user with the server's response without a full re-fetch/re-login.
  const updateLocalUser = (updated: User) => setUser(updated);

  // Tags crash reports with who hit them (a no-op until EXPO_PUBLIC_SENTRY_DSN is set - see
  // errorReporting.ts) - matches the website's own Sentry user-context wiring.
  useEffect(() => {
    setUserContext(user ? { id: user.id, email: user.email, username: user.username } : null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, pendingToken, login, verifyTwoFactorCode, logout, updateLocalUser, completeAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
