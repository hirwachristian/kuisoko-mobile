import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
} from 'react-native';
import { ArrowLeft, Eye, EyeOff, Check, X as XIcon } from 'lucide-react-native';
import { signUp, checkUsername } from '../api/customer';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useGuestMode } from '../context/GuestModeContext';
import Logo from '../components/Logo';

const SignUpScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { completeAuth } = useAuth();
  const { enterGuestMode, requestSignIn } = useGuestMode();
  const styles = createStyles(colors);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (username.trim().length < 3) {
      setUsernameStatus('idle');
      setSuggestions([]);
      return;
    }
    setUsernameStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkUsername(username.trim());
        setUsernameStatus(result.available ? 'available' : 'taken');
        setSuggestions(result.suggestions ?? []);
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  const isValid = fullName.trim() && username.trim().length >= 3 && email.trim() && password.length >= 6 && usernameStatus !== 'taken';

  const handleSubmit = async () => {
    if (!isValid) return;
    setError('');
    setIsSubmitting(true);
    try {
      const { user, token } = await signUp({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        password,
      });
      await completeAuth(user, token);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <Logo height={40} />
            </View>
            <Text style={styles.title}>{t('mobile_create_account')}</Text>

            <Text style={styles.label}>{t('mobile_full_name')}</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholderTextColor={colors.slate400} />

            <Text style={styles.label}>{t('mobile_username')}</Text>
            <View style={styles.usernameWrap}>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.slate400}
              />
              {usernameStatus === 'checking' && <ActivityIndicator size="small" color={colors.slate400} style={styles.usernameIcon} />}
              {usernameStatus === 'available' && <Check size={18} color={colors.emerald600} style={styles.usernameIcon} />}
              {usernameStatus === 'taken' && <XIcon size={18} color={colors.rose500} style={styles.usernameIcon} />}
            </View>
            {usernameStatus === 'taken' && suggestions.length > 0 && (
              <View style={styles.suggestionRow}>
                {suggestions.map((s) => (
                  <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => setUsername(s)}>
                    <Text style={styles.suggestionChipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>{t('mobile_email')}</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.slate400} />

            <Text style={styles.label}>{t('mobile_phone_number')}</Text>
            <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" placeholderTextColor={colors.slate400} />

            <Text style={styles.label}>{t('auth_password')}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={colors.slate400}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? <EyeOff size={20} color={colors.slate400} /> : <Eye size={20} color={colors.slate400} />}
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.button, (!isValid || isSubmitting) && styles.buttonDisabled]} onPress={handleSubmit} disabled={!isValid || isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('mobile_sign_up')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkRow} onPress={requestSignIn}>
              <Text style={styles.linkText}>{t('auth_no_account') === "Don't have an account?" ? 'Already have an account? Sign In' : t('auth_sign_in')}</Text>
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
    backgroundColor: colors.white, borderRadius: 32, padding: 28, borderWidth: 1, borderColor: colors.slate100,
    shadowColor: colors.slate900, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  logoRow: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', color: colors.slate900, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: colors.slate700, marginBottom: 8, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 13, fontSize: 14, color: colors.slate900,
  },
  usernameWrap: { position: 'relative', justifyContent: 'center' },
  usernameIcon: { position: 'absolute', right: 14 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  suggestionChip: { backgroundColor: colors.slate100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  suggestionChipText: { fontSize: 11.5, fontWeight: '700', color: colors.slate700 },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: {
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 13, paddingRight: 46, fontSize: 14, color: colors.slate900,
  },
  eyeButton: { position: 'absolute', right: 14 },
  error: { color: colors.rose600, fontSize: 13, marginTop: 16, textAlign: 'center' },
  button: {
    backgroundColor: colors.emerald800, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24,
    shadowColor: colors.emerald800, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  linkRow: { alignItems: 'center', marginTop: 16 },
  linkText: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
});

export default SignUpScreen;
