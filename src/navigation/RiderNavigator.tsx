import React from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Bike, History, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import TabBarIcon from '../components/TabBarIcon';
import RiderActiveScreen from '../screens/rider/RiderActiveScreen';
import RiderHistoryScreen from '../screens/rider/RiderHistoryScreen';

const Tab = createBottomTabNavigator();

// Matches AdminMoreMenuScreen's sign-out confirmation - a rider has no "More"/Account tab to tuck
// this into, so it lives in the header instead (mirrors the website's RiderDashboard header).
const LogoutButton: React.FC = () => {
  const { logout } = useAuth();
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const handlePress = () => {
    Alert.alert(t('mobile_rider_sign_out_title'), t('mobile_rider_sign_out_body'), [
      { text: t('mobile_cancel'), style: 'cancel' },
      { text: t('mobile_rider_sign_out_title'), style: 'destructive', onPress: logout },
    ]);
  };
  return (
    <TouchableOpacity onPress={handlePress} style={{ paddingHorizontal: 16 }}>
      <LogOut size={20} color={colors.slate600} />
    </TouchableOpacity>
  );
};

// Ports frontend/pages/RiderDashboard.tsx's two tabs (Active/History) - a rider account gets this
// instead of AdminNavigator or CustomerNavigator (see RootNavigator.tsx). Deliberately flat, no
// nested stacks: unlike the admin section, neither tab here drills into its own sub-screens.
const RiderNavigator: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { fontWeight: '800' },
        headerTintColor: colors.slate900,
        headerRight: () => <LogoutButton />,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.slate400,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.slate100,
          backgroundColor: colors.white,
          height: 58 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 10,
          shadowColor: colors.slate900,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tab.Screen
        name="RiderActive"
        component={RiderActiveScreen}
        options={{ title: t('mobile_rider_tab_active'), tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={Bike} color={color} focused={focused} /> }}
      />
      <Tab.Screen
        name="RiderHistory"
        component={RiderHistoryScreen}
        options={{ title: t('mobile_rider_tab_history'), tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={History} color={color} focused={focused} /> }}
      />
    </Tab.Navigator>
  );
};

export default RiderNavigator;
