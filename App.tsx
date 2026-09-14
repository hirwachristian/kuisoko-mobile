import { useCallback, useEffect } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { CartProvider } from './src/context/CartContext';
import { WishlistProvider } from './src/context/WishlistContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigateFromNotificationData } from './src/navigation/navigationRef';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initErrorReporting } from './src/lib/errorReporting';

initErrorReporting();

const ThemedStatusBar = () => {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
};

SplashScreen.preventAutoHideAsync();

// Matches the website's `body { font-family: 'Inter', sans-serif }` (frontend/index.html) - RN
// has no CSS-style global font-family, so any Text/TextInput that doesn't set its own fontFamily
// falls back to Inter_400Regular here instead of the platform default (San Francisco/Roboto).
// @ts-expect-error - defaultProps isn't in RN's public types but is still respected at runtime.
RNText.defaultProps = RNText.defaultProps ?? {};
// @ts-expect-error
RNText.defaultProps.style = [{ fontFamily: 'Inter_400Regular' }, RNText.defaultProps.style];
// @ts-expect-error
RNTextInput.defaultProps = RNTextInput.defaultProps ?? {};
// @ts-expect-error
RNTextInput.defaultProps.style = [{ fontFamily: 'Inter_400Regular' }, RNTextInput.defaultProps.style];

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  // Tapping a push notification (app backgrounded or fully closed) should open the screen it's
  // about, not just bring the app to the foreground on whatever screen it was last on. Also
  // checks for a notification that launched the app cold (getLastNotificationResponseAsync) -
  // addNotificationResponseReceivedListener alone only fires for taps while already running.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationData(response.notification.request.content.data as Record<string, unknown>);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) navigateFromNotificationData(response.notification.request.content.data as Record<string, unknown>);
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider onLayout={onLayout}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <RootNavigator />
                  <ThemedStatusBar />
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
