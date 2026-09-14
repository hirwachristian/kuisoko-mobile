import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Truck, ShieldCheck, RotateCcw } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useGuestMode } from '../context/GuestModeContext';
import Logo from '../components/Logo';

// The first thing a fresh install (or a scanned Expo Go QR link) lands on - matches the website's
// home page hero copy (frontend/translations.ts home_hero_*). Leads with "Start Shopping" as the
// one prominent action (straight into the guest-accessible storefront, same as the website itself
// requires no account to browse) rather than putting Sign In first - asking a brand-new visitor to
// authenticate before they've even seen a product reads as a wall, not a welcome. Sign In and
// Create an account are still one tap away, just visually secondary to browsing.
const WelcomeScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { enterGuestMode, requestSignIn, requestSignUp } = useGuestMode();
  const styles = createStyles(colors);

  const features: { Icon: typeof Truck; label: string }[] = [
    { Icon: Truck, label: t('mobile_feature_delivery') },
    { Icon: ShieldCheck, label: t('mobile_feature_secure') },
    { Icon: RotateCcw, label: t('mobile_feature_returns') },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Logo height={52} />
        </View>
        <Text style={styles.title}>{t('home_hero_title_3')}</Text>
        <Text style={styles.titleAccent}>{t('home_hero_title_4')}</Text>
        <Text style={styles.subtitle}>{t('home_hero_subtitle')}</Text>

        <View style={styles.featureRow}>
          {features.map(({ Icon, label }) => (
            <View key={label} style={styles.featureChip}>
              <View style={styles.featureIconWrap}>
                <Icon size={16} color={colors.emerald700} />
              </View>
              <Text style={styles.featureLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={enterGuestMode} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>{t('mobile_start_shopping')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={requestSignIn} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>{t('auth_sign_in')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signUpRow} onPress={requestSignUp} activeOpacity={0.7}>
          <Text style={styles.signUpHint}>{t('mobile_new_here')} </Text>
          <Text style={styles.signUpLink}>{t('mobile_sign_up')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap: { marginBottom: 28 },
  title: { fontSize: 30, fontWeight: '900', color: colors.slate900, textAlign: 'center', letterSpacing: -0.5 },
  titleAccent: { fontSize: 30, fontWeight: '900', color: colors.emerald800, textAlign: 'center', letterSpacing: -0.5, marginBottom: 16 },
  subtitle: { fontSize: 14, color: colors.slate600, textAlign: 'center', lineHeight: 21 },
  featureRow: { flexDirection: 'row', gap: 10, marginTop: 28 },
  featureChip: {
    alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1,
    borderColor: colors.slate100, paddingVertical: 12, paddingHorizontal: 10, flex: 1,
  },
  featureIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 10, fontWeight: '700', color: colors.slate600, textAlign: 'center' },
  actions: { paddingHorizontal: 24, paddingBottom: 28, gap: 12 },
  primaryButton: {
    backgroundColor: colors.emerald800,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: colors.emerald800,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    borderWidth: 1.5, borderColor: colors.emerald800, borderRadius: 16, paddingVertical: 15, alignItems: 'center',
  },
  secondaryButtonText: { color: colors.emerald800, fontSize: 15, fontWeight: '800' },
  signUpRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 4 },
  signUpHint: { fontSize: 13, color: colors.slate600, fontWeight: '600' },
  signUpLink: { fontSize: 13, color: colors.accentText, fontWeight: '800' },
});

export default WelcomeScreen;
