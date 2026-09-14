import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Eye, EyeOff, Clock, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useGuestMode } from '../context/GuestModeContext';
import Logo from '../components/Logo';

const formatLockoutTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const SignInScreen: React.FC = () => {
  const { login, verifyTwoFactorCode, pendingToken } = useAuth();
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { enterGuestMode, requestSignUp, requestForgotPassword } = useGuestMode();
  const styles = createStyles(colors);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!lockoutSecondsLeft) return;
    const timer = setTimeout(() => {
      setLockoutSecondsLeft((s) => (s && s > 1 ? s - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [lockoutSecondsLeft]);

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);
    const result = await login(identifier.trim(), password);
    setIsSubmitting(false);
    if (!result.success) {
      if (result.retryAfterSeconds) {
        setLockoutSecondsLeft(result.retryAfterSeconds);
      } else {
        setError(result.error ?? t('auth_invalid_credentials'));
      }
    }
  };

  const handleVerify = async () => {
    setError('');
    setIsSubmitting(true);
    const result = await verifyTwoFactorCode(code.trim());
    setIsSubmitting(false);
    if (!result.success) setError(result.error ?? 'Invalid or expired code.');
  };

  if (pendingToken) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            <View style={styles.logoRow}>
              <Logo height={40} />
            </View>
            <Text style={styles.title}>{t('mobile_enter_verification_code')}</Text>
            <Text style={styles.subtitle}>{t('mobile_verification_code_sent')}</Text>

            <TextInput
              style={styles.codeInput}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              placeholder="000000"
              placeholderTextColor={colors.slate400}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, (isSubmitting || code.length !== 6) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={isSubmitting || code.length !== 6}
            >
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('mobile_verify_and_sign_in')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.centerWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.topRow}>
              <TouchableOpacity onPress={enterGuestMode} style={styles.backButton}>
                <ArrowLeft size={18} color={colors.slate600} />
              </TouchableOpacity>
            </View>
            <View style={styles.logoRow}>
              <Logo height={44} />
            </View>
            <Text style={styles.title}>{t('auth_welcome_back')}</Text>
            <Text style={styles.subtitle}>{t('auth_sign_in_subtitle')}</Text>

            <Text style={styles.label}>{t('auth_email_or_username')}</Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('auth_email_or_username_placeholder')}
              placeholderTextColor={colors.slate400}
            />

            <Text style={styles.label}>{t('auth_password')}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder={t('mobile_your_password')}
                placeholderTextColor={colors.slate400}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? <EyeOff size={20} color={colors.slate400} /> : <Eye size={20} color={colors.slate400} />}
              </TouchableOpacity>
            </View>

            {lockoutSecondsLeft ? (
              <View style={styles.lockoutBox}>
                <View style={styles.lockoutTitleRow}>
                  <Clock size={16} color={colors.amber800} />
                  <Text style={styles.lockoutTitle}>{t('auth_too_many_attempts')}</Text>
                </View>
                <Text style={styles.lockoutText}>{t('auth_try_again_in', { time: formatLockoutTime(lockoutSecondsLeft) })}</Text>
              </View>
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <TouchableOpacity style={styles.forgotRow} onPress={requestForgotPassword}>
              <Text style={styles.forgotText}>{t('auth_forgot_password')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, (isSubmitting || !!lockoutSecondsLeft) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting || !!lockoutSecondsLeft}
            >
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('auth_sign_in')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.signUpRow} onPress={requestSignUp}>
              <Text style={styles.signUpText}>{t('auth_no_account')} <Text style={styles.signUpTextAccent}>{t('auth_sign_up_free')}</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  centerWrap: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.slate100,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  logoRow: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', fontFamily: 'Inter_900Black', color: colors.slate900, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.slate600, textAlign: 'center', marginTop: 6, marginBottom: 26 },
  label: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold', color: colors.slate700, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.slate900,
  },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    paddingRight: 46,
    fontSize: 14,
    color: colors.slate900,
  },
  eyeButton: { position: 'absolute', right: 14 },
  codeInput: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 18,
    fontSize: 26,
    letterSpacing: 14,
    textAlign: 'center',
    color: colors.slate900,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    marginBottom: 20,
  },
  error: { color: colors.rose600, fontSize: 13, marginTop: 16, textAlign: 'center' },
  lockoutBox: {
    backgroundColor: colors.amber50,
    borderColor: colors.amber200,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  lockoutTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockoutTitle: { color: colors.amber800, fontWeight: '700', fontFamily: 'Inter_700Bold', fontSize: 13 },
  lockoutText: { color: colors.amber800, fontSize: 13, marginTop: 6 },
  button: {
    backgroundColor: colors.emerald800,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: colors.emerald800,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  forgotRow: { alignItems: 'flex-end', marginTop: 12 },
  forgotText: { color: colors.accentText, fontSize: 12.5, fontWeight: '700' },
  signUpRow: { alignItems: 'center', marginTop: 18 },
  signUpText: { color: colors.slate600, fontSize: 13, fontWeight: '600' },
  signUpTextAccent: { color: colors.accentText, fontWeight: '800' },
});

export default SignInScreen;
