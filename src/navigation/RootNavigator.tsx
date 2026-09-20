import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { GuestModeProvider, useGuestMode } from '../context/GuestModeContext';
import { AppColors } from '../theme';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import AdminNavigator from './AdminNavigator';
import CustomerNavigator from './CustomerNavigator';
import RiderNavigator from './RiderNavigator';
import { navigationRef } from './navigationRef';

// Matches the website's fixed white/95-blur header + emerald active-state accents (Navbar.tsx)
// rather than React Navigation's stock blue defaults. Built per-render from the live theme so it
// flips with dark mode instead of being frozen at import time.
const buildNavigationTheme = (colors: AppColors) => ({
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accentText,
    background: colors.slate50,
    card: colors.white,
    text: colors.slate900,
    border: colors.slate200,
  },
});

const LoadingScreen: React.FC = () => {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
      <ActivityIndicator size="large" color={colors.emerald800} />
    </View>
  );
};

// Decides what to render for a signed-out visitor: the Welcome screen first, then Sign In/Sign
// Up/Forgot Password, or - matching the website's guest-accessible storefront - straight into
// the full customer shopping UI (Home/Shop/Cart/Wishlist/Account) without an account. Split out
// so it can read GuestModeContext, which GuestModeProvider (below) supplies.
const SignedOutFlow: React.FC = () => {
  const { mode } = useGuestMode();
  if (mode === 'guest') return <CustomerNavigator />;
  if (mode === 'signin') return <SignInScreen />;
  if (mode === 'signup') return <SignUpScreen />;
  if (mode === 'forgot') return <ForgotPasswordScreen />;
  return <WelcomeScreen />;
};

const RootNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { colors } = useAppTheme();

  if (isLoading) return <LoadingScreen />;

  // Admins get the dedicated admin panel (Dashboard/Orders/Products/Users/More), riders get their
  // own delivery-focused UI (RiderNavigator) - neither should ever land in the customer shopping
  // UI. Matches the website, where an admin/rider login redirects to /admin or /rider rather than
  // the storefront homepage.
  const navigatorForUser = () => {
    if (user!.role === 'admin') return <AdminNavigator />;
    if (user!.role === 'rider') return <RiderNavigator />;
    return <CustomerNavigator />;
  };

  return (
    <NavigationContainer ref={navigationRef} theme={buildNavigationTheme(colors)}>
      <GuestModeProvider>
        {user ? navigatorForUser() : <SignedOutFlow />}
      </GuestModeProvider>
    </NavigationContainer>
  );
};

export default RootNavigator;
