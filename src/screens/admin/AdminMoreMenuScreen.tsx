import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Layers, Tag, RotateCcw, MessageCircleQuestion, MessageCircle, Settings, Megaphone, ShieldCheck, ChevronRight, LogOut, Moon, Sun, Smartphone } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAdminNotifications } from '../../context/AdminNotificationsContext';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

const THEME_OPTIONS: { mode: 'light' | 'dark' | 'system'; label: string; icon: any }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Smartphone },
];

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'MoreMenu'>;

const items: { key: keyof AdminMoreStackParamList; label: string; description: string; icon: any; badgeKey?: 'chat' | 'enquiry' }[] = [
  { key: 'Categories', label: 'Categories', description: 'Manage catalog categories & sections', icon: Layers },
  { key: 'Coupons', label: 'Coupons', description: 'Discount codes and promotions', icon: Tag },
  { key: 'Returns', label: 'Returns', description: 'Customer return requests', icon: RotateCcw },
  { key: 'Enquiries', label: 'Enquiries', description: 'Contact form submissions', icon: MessageCircleQuestion, badgeKey: 'enquiry' },
  { key: 'Messages', label: 'Messages', description: 'Customer support chat', icon: MessageCircle, badgeKey: 'chat' },
  { key: 'StoreConfig', label: 'Store Configuration', description: 'Shipping zones & fees', icon: Settings },
  { key: 'Business', label: 'Business & Notifications', description: 'Announcements & marketing', icon: Megaphone },
  { key: 'AccountSecurity', label: 'Account & Security', description: 'Your profile & password', icon: ShieldCheck },
];

const AdminMoreMenuScreen: React.FC<Props> = ({ navigation }) => {
  const { logout } = useAuth();
  const { colors, mode, setMode } = useAppTheme();
  const { chatUnreadCount, enquiryUnreadCount } = useAdminNotifications();
  const styles = createStyles(colors);
  const badgeCounts: Record<'chat' | 'enquiry', number> = { chat: chatUnreadCount, enquiry: enquiryUnreadCount };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.themeCard}>
          <Text style={styles.themeLabel}>Appearance</Text>
          <View style={styles.themeOptions}>
            {THEME_OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => {
              const isActive = mode === optionMode;
              return (
                <TouchableOpacity
                  key={optionMode}
                  style={[styles.themeOption, isActive && styles.themeOptionActive]}
                  onPress={() => setMode(optionMode)}
                  activeOpacity={0.7}
                >
                  <Icon size={16} color={isActive ? colors.white : colors.slate600} />
                  <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          {items.map(({ key, label, description, icon: Icon, badgeKey }, i) => {
            const badgeCount = badgeKey ? badgeCounts[badgeKey] : 0;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.row, i === items.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => navigation.navigate(key as any)}
                activeOpacity={0.7}
              >
                <View style={styles.iconWrap}><Icon size={17} color={colors.accentText} /></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.label}>{label}</Text>
                    {badgeCount > 0 && (
                      <View style={styles.rowBadge}>
                        <Text style={styles.rowBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.description}>{description}</Text>
                </View>
                <ChevronRight size={18} color={colors.slate400} />
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.85}>
          <LogOut size={17} color={colors.rose600} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  themeCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: 16,
    marginBottom: 16,
  },
  themeLabel: { fontSize: 12, fontWeight: '800', color: colors.slate600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  themeOptions: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.slate100 },
  themeOptionActive: { backgroundColor: colors.emerald800 },
  themeOptionText: { fontSize: 12, fontWeight: '700', color: colors.slate600 },
  themeOptionTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.slate100,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  iconWrap: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  rowBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.orange500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  rowBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  description: { fontSize: 11.5, color: colors.slate600, marginTop: 2 },
  signOutButton: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { color: colors.rose600, fontSize: 15, fontWeight: '800' },
});

export default AdminMoreMenuScreen;
