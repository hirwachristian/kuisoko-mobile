import * as Sentry from '@sentry/react-native';

// Crash reporting is opt-in via EXPO_PUBLIC_SENTRY_DSN (Expo's equivalent of a Vite VITE_ env
// var - baked in at build time). No DSN is set anywhere in this repo (there's nothing to put here
// without a real Sentry project), so this no-ops by default rather than sending nothing to a
// well-formed-but-fake endpoint or crashing the app trying to init without a DSN. Set the env var
// (locally via `EXPO_PUBLIC_SENTRY_DSN=... npx expo start`, or per-profile in eas.json's `build.*.env`
// for real builds) once a Sentry project exists, and every capture call below starts working with
// no other code changes - this mirrors the website's own @sentry/react usage.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let isInitialized = false;

export function initErrorReporting() {
  if (!DSN || isInitialized) return;
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
    // Matches app.json's own version field - lets a crash in Sentry be traced back to which
    // build a user actually hit it on, same as the website tagging releases.
    release: `kuisoko-mobile@1.0.0`,
  });
  isInitialized = true;
}

export function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!isInitialized) {
    // No DSN configured - the error is still real, so at least surface it in the terminal/device
    // logs instead of silently disappearing.
    console.error('[captureException]', error, extra);
    return;
  }
  Sentry.captureException(error, extra ? { extra } : undefined);
}

export function setUserContext(user: { id: string; email?: string; username?: string } | null) {
  if (!isInitialized) return;
  Sentry.setUser(user);
}
