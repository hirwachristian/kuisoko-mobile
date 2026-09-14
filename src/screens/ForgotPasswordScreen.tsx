import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowLeft, MailCheck } from 'lucide-react-native';
import { requestPasswordReset, confirmPasswordResetRequest } from '../api/customer';
import { ApiError } from '../api/client';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useGuestMode } from '../context/GuestModeContext';
import Logo from '../components/Logo';

type Stage = 'username' | 'confirm' | 'sent';

// Username-based (not email-based, since a single email can back multiple accounts in this app's
// design) and 3-step on the website: request -> confirm -> the actual reset link is emailed and
// opens in a browser from there. The reset-password-with-token step itself is intentionally not
// built here - that link naturally opens in a browser regardless of platform, so there is no
// mobile-specific screen for it (see the customer-side feature scoping notes).
const ForgotPasswordScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { enterGuestMode, requestSignIn } = useGuestMode();
  const styles = createStyles(colors);
  const [stage, setStage] = useState<Stage>('username');
  const [username, setUsername] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!username.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      const { maskedEmail: masked } = await requestPasswordReset(username.trim());
      setMaskedEmail(masked);
      setStage('confirm');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not find that username.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await confirmPasswordResetRequest(username.trim());
      setStage('sent');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centerWrap}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={enterGuestMode} style={styles.backButton}>
              <ArrowLeft size={18} color={colors.slate600} />
            </TouchableOpacity>
          </View>
          <View style={styles.logoRow}>
            <Logo height={40} />
          </View>
          <Text style={styles.title}>{t('mobile_forgot_password_title')}</Text>

          {stage === 'username' && (
            <>
              <Text style={styles.subtitle}>Enter your username and we'll help you reset your password.</Text>
              <Text style={styles.label}>{t('mobile_username')}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.slate400}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity style={[styles.button, (!username.trim() || isSubmitting) && styles.buttonDisabled]} onPress={handleRequest} disabled={!username.trim() || isSubmitting}>
                {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('mobile_continue')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {stage === 'confirm' && (
            <>
              <Text style={styles.subtitle}>We'll send a password reset link to {maskedEmail}. Continue?</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('mobile_send_verification_code')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {stage === 'sent' && (
            <View style={styles.sentWrap}>
              <MailCheck size={40} color={colors.emerald600} />
              <Text style={styles.subtitle}>{t('mobile_reset_password_sent')}</Text>
              <TouchableOpacity style={styles.button} onPress={requestSignIn}>
                <Text style={styles.buttonText}>{t('auth_sign_in')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  centerWrap: { flex: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: colors.white, borderRadius: 32, padding: 28, borderWidth: 1, borderColor: colors.slate100,
    shadowColor: colors.slate900, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4,
  },
  topRow: { flexDirection: 'row', marginBottom: 12 },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  logoRow: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', color: colors.slate900, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.slate600, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700', color: colors.slate700, marginBottom: 8, marginTop: 20 },
  input: {
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 13, fontSize: 14, color: colors.slate900,
  },
  error: { color: colors.rose600, fontSize: 13, marginTop: 16, textAlign: 'center' },
  button: {
    backgroundColor: colors.emerald800, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24,
    shadowColor: colors.emerald800, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, width: '100%',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  sentWrap: { alignItems: 'center', marginTop: 8 },
});

export default ForgotPasswordScreen;
