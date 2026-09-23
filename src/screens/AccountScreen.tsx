import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Image, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  LogOut, Mail, Phone, UserCircle, Package, Info, MessageCircle, ChevronRight,
  UserCog, HelpCircle, Truck, FileText, Shield, Mail as MailIcon, Sun, Moon, Smartphone, MapPin,
} from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useGuestMode } from '../context/GuestModeContext';
import { fetchNewsletterStatus, subscribeToNewsletter, unsubscribeFromNewsletter } from '../api/customer';
import LanguageSwitcher from '../components/LanguageSwitcher';
import type { CustomerTabParamList, CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = BottomTabScreenProps<CustomerTabParamList, 'Account'> & {
  navigation: NativeStackNavigationProp<CustomerStackParamList> & BottomTabScreenProps<CustomerTabParamList, 'Account'>['navigation'];
};

const AccountScreen: React.FC<Props> = ({ navigation }) => {
  const { user, token, logout } = useAuth();
  const { colors, mode, setMode } = useAppTheme();
  const { t } = useLanguage();
  const { requestSignIn } = useGuestMode();
  const styles = createStyles(colors);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isTogglingNewsletter, setIsTogglingNewsletter] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      fetchNewsletterStatus(token).then(({ subscribed }) => setIsSubscribed(subscribed)).catch(() => {});
    }, [token])
  );

  const handleToggleNewsletter = async () => {
    if (!token || !user) return;
    setIsTogglingNewsletter(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromNewsletter(user.email);
        setIsSubscribed(false);
      } else {
        await subscribeToNewsletter(token);
        setIsSubscribed(true);
      }
    } catch {
      // leave the toggle as-is on failure - the user can just try again
    } finally {
      setIsTogglingNewsletter(false);
    }
  };

  const themeOptions: { value: 'light' | 'dark' | 'system'; label: string; Icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'system', label: 'Auto', Icon: Smartphone },
  ];

  const helpMenu = (
    <View style={styles.menuCard}>
      <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('About')}>
        <View style={styles.rowIcon}><Info size={15} color={colors.accentText} /></View>
        <Text style={[styles.rowValue, { flex: 1 }]}>About Us</Text>
        <ChevronRight size={16} color={colors.slate400} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Contact')}>
        <View style={styles.rowIcon}><MessageCircle size={15} color={colors.accentText} /></View>
        <Text style={[styles.rowValue, { flex: 1 }]}>Contact Us</Text>
        <ChevronRight size={16} color={colors.slate400} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Faq')}>
        <View style={styles.rowIcon}><HelpCircle size={15} color={colors.accentText} /></View>
        <Text style={[styles.rowValue, { flex: 1 }]}>FAQ</Text>
        <ChevronRight size={16} color={colors.slate400} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('ShippingPolicy')}>
        <View style={styles.rowIcon}><Truck size={15} color={colors.accentText} /></View>
        <Text style={[styles.rowValue, { flex: 1 }]}>Shipping Policy</Text>
        <ChevronRight size={16} color={colors.slate400} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('TermsOfService')}>
        <View style={styles.rowIcon}><FileText size={15} color={colors.accentText} /></View>
        <Text style={[styles.rowValue, { flex: 1 }]}>Terms of Service</Text>
        <ChevronRight size={16} color={colors.slate400} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('PrivacyPolicy')}>
        <View style={styles.rowIcon}><Shield size={15} color={colors.accentText} /></View>
        <Text style={[styles.rowValue, { flex: 1 }]}>Privacy Policy</Text>
        <ChevronRight size={16} color={colors.slate400} />
      </TouchableOpacity>
    </View>
  );

  const appearanceCard = (
    <View style={styles.menuCard}>
      <Text style={styles.settingsLabel}>Appearance</Text>
      <View style={styles.themeRow}>
        {themeOptions.map(({ value, label, Icon }) => (
          <TouchableOpacity
            key={value}
            style={[styles.themeChip, mode === value && styles.themeChipActive]}
            onPress={() => setMode(value)}
          >
            <Icon size={14} color={mode === value ? colors.accentText : colors.slate600} />
            <Text style={[styles.themeChipText, mode === value && styles.themeChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Browsing as a guest (no account yet) - matches the website's guest-accessible storefront:
  // the Home/Product Detail screens stay open, but Account prompts to sign in instead of
  // rendering blank.
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
          <View style={styles.languageRow}>
            <LanguageSwitcher />
          </View>
          <View style={styles.guestPrompt}>
            <View style={styles.guestIconWrap}>
              <UserCircle size={40} color={colors.emerald700} />
            </View>
            <Text style={styles.guestTitle}>{t('mobile_sign_in_prompt_title')}</Text>
            <Text style={styles.guestSubtitle}>{t('mobile_sign_in_prompt_subtitle')}</Text>
            <TouchableOpacity style={styles.guestButton} onPress={requestSignIn} activeOpacity={0.85}>
              <Text style={styles.guestButtonText}>{t('auth_sign_in')}</Text>
            </TouchableOpacity>
          </View>
          {appearanceCard}
          {helpMenu}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const initial = user.name?.charAt(0).toUpperCase() ?? '?';

  const handleSignOut = () => {
    Alert.alert(t('dashboard_logout'), t('mobile_sign_out_confirm'), [
      { text: t('mobile_cancel'), style: 'cancel' },
      { text: t('dashboard_logout'), style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.languageRow}>
          <LanguageSwitcher />
        </View>
        <View style={styles.header}>
          <View style={styles.avatar}>
            {user.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.username}>@{user.username}</Text>
        </View>

        <View style={styles.card}>
          <View style={[styles.row, !user.phoneNumber && { borderBottomWidth: 0 }]}>
            <View style={styles.rowIcon}><Mail size={15} color={colors.accentText} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('mobile_email')}</Text>
              <Text style={styles.rowValue}>{user.email}</Text>
            </View>
          </View>
          {user.phoneNumber ? (
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowIcon}><Phone size={15} color={colors.accentText} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{t('mobile_phone')}</Text>
                <Text style={styles.rowValue}>{user.phoneNumber}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('EditProfile')}>
            <View style={styles.rowIcon}><UserCog size={15} color={colors.accentText} /></View>
            <Text style={[styles.rowValue, { flex: 1 }]}>Edit Profile</Text>
            <ChevronRight size={16} color={colors.slate400} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('OrderHistory')}>
            <View style={styles.rowIcon}><Package size={15} color={colors.accentText} /></View>
            <Text style={[styles.rowValue, { flex: 1 }]}>{t('mobile_my_orders')}</Text>
            <ChevronRight size={16} color={colors.slate400} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('AddressBook')}>
            <View style={styles.rowIcon}><MapPin size={15} color={colors.accentText} /></View>
            <Text style={[styles.rowValue, { flex: 1 }]}>Address Book</Text>
            <ChevronRight size={16} color={colors.slate400} />
          </TouchableOpacity>
        </View>

        {appearanceCard}

        <View style={styles.menuCard}>
          <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={handleToggleNewsletter} disabled={isTogglingNewsletter}>
            <View style={styles.rowIcon}><MailIcon size={15} color={colors.accentText} /></View>
            <Text style={[styles.rowValue, { flex: 1 }]}>Newsletter</Text>
            <View style={[styles.switchTrack, isSubscribed && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, isSubscribed && styles.switchThumbOn]} />
            </View>
          </TouchableOpacity>
        </View>

        {helpMenu}

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut} activeOpacity={0.85}>
          <LogOut size={17} color={colors.rose600} />
          <Text style={styles.logoutText}>{t('dashboard_logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  languageRow: { alignItems: 'flex-end', marginBottom: 4, paddingHorizontal: 16, paddingTop: 12 },
  guestPrompt: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  guestIconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  guestTitle: { fontSize: 18, fontWeight: '900', color: colors.slate900, textAlign: 'center' },
  guestSubtitle: { fontSize: 13, color: colors.slate600, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  guestButton: {
    backgroundColor: colors.emerald800,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
    shadowColor: colors.emerald800,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  guestButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  header: { alignItems: 'center', paddingVertical: 28 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.emerald600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: colors.emerald800,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontSize: 28, fontWeight: '900', fontFamily: 'Inter_900Black' },
  name: { fontSize: 20, fontWeight: '900', fontFamily: 'Inter_900Black', color: colors.slate900, letterSpacing: -0.3 },
  username: { fontSize: 13, color: colors.slate600, marginTop: 3, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.slate100,
    paddingHorizontal: 16,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 11, color: colors.slate600, fontWeight: '700', fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  rowValue: { fontSize: 14, color: colors.slate900, fontWeight: '700', fontFamily: 'Inter_700Bold', marginTop: 2 },
  menuCard: {
    backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.slate100,
    paddingHorizontal: 16, marginTop: 16,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  settingsLabel: { fontSize: 11, fontWeight: '800', color: colors.slate600, textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 14 },
  themeRow: { flexDirection: 'row', gap: 8, paddingVertical: 14 },
  themeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate100,
  },
  themeChipActive: { backgroundColor: colors.emerald50, borderColor: colors.emerald100 },
  themeChipText: { fontSize: 12, fontWeight: '700', color: colors.slate600 },
  themeChipTextActive: { color: colors.accentText },
  switchTrack: { width: 46, height: 27, borderRadius: 14, backgroundColor: colors.slate200, padding: 2, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: colors.emerald800 },
  switchThumb: { width: 23, height: 23, borderRadius: 12, backgroundColor: colors.white },
  switchThumbOn: { transform: [{ translateX: 19 }] },
  logoutButton: {
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
  logoutText: { color: colors.rose600, fontSize: 15, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
});

export default AccountScreen;
