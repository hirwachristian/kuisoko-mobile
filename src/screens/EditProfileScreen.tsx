import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Check, X as XIcon } from 'lucide-react-native';
import { updateProfile, requestEmailChange, checkUsername } from '../api/customer';
import { ApiError } from '../api/client';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button, TextField, FieldLabel } from '../components/admin/ui';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

// Ports frontend/pages/UserDashboard.tsx's profile tab: edit name/phone/address directly (PATCH
// /users/me), and request an email change separately (it needs a confirmation link, so it can't
// just PATCH straight through) - matches the website exactly. Change Password has no working
// customer-facing UI on the website (the admin account screen's own version is wired up, but the
// website's customer dashboard only ever declared dead state for it, never rendered) - the backend
// route (PATCH /users/me with {currentPassword, password}) is generic across every role though, so
// this ports the mobile ADMIN screen's already-working handleChangePassword pattern here instead.
const EditProfileScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { user, token, updateLocalUser } = useAuth();
  const styles = createStyles(colors);
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');

  // Ports SignUpScreen.tsx's live debounced availability check, with one addition: re-submitting
  // the account's own current username unchanged must never be flagged "taken" - GET
  // /auth/check-username is public/context-free (it has no idea who's asking or what their
  // current username already is), so that guard has to live here on the client.
  useEffect(() => {
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3 || trimmed === (user?.username ?? '').toLowerCase()) {
      setUsernameStatus('idle');
      setUsernameSuggestions([]);
      return;
    }
    setUsernameStatus('checking');
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const result = await checkUsername(trimmed);
        setUsernameStatus(result.available ? 'available' : 'taken');
        setUsernameSuggestions(result.suggestions ?? []);
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
    return () => { if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current); };
  }, [username, user?.username]);

  const handleSaveProfile = async () => {
    if (!token || usernameStatus === 'taken' || usernameStatus === 'checking') return;
    setIsSavingProfile(true);
    setError('');
    setProfileMessage('');
    try {
      const { user: updated } = await updateProfile(
        { name: name.trim(), username: username.trim() || undefined, phoneNumber: phoneNumber.trim(), address: address.trim() },
        token
      );
      updateLocalUser(updated);
      setUsername(updated.username);
      setProfileMessage('Profile updated.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update your profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Ports AdminAccountSecurityScreen.tsx's handleChangePassword: PATCH /users/me only checks
  // currentPassword against the stored hash when a new `password` is present in the body, so this
  // is the same endpoint as the profile-fields save above, just called with different fields.
  const handleChangePassword = async () => {
    if (!token) return;
    setPasswordError('');
    setPasswordMessage('');
    if (!currentPassword || !newPassword) {
      setPasswordError('Enter your current and new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setIsSavingPassword(true);
    try {
      await updateProfile({ currentPassword, password: newPassword }, token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordMessage('Password changed.');
    } catch (e) {
      setPasswordError(e instanceof ApiError ? e.message : 'Could not change your password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!token || !newEmail.trim()) return;
    setIsSavingEmail(true);
    setError('');
    setEmailMessage('');
    try {
      const { message } = await requestEmailChange(newEmail.trim(), token);
      setEmailMessage(message);
      setNewEmail('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not request the email change.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <FieldLabel>Full Name</FieldLabel>
            <TextField value={name} onChangeText={setName} />
            <FieldLabel>Username</FieldLabel>
            <View style={styles.usernameWrap}>
              <TextField
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ paddingRight: 40 }}
              />
              {usernameStatus === 'checking' && <ActivityIndicator size="small" color={colors.slate400} style={styles.usernameIcon} />}
              {usernameStatus === 'available' && <Check size={18} color={colors.emerald600} style={styles.usernameIcon} />}
              {usernameStatus === 'taken' && <XIcon size={18} color={colors.rose500} style={styles.usernameIcon} />}
            </View>
            {usernameStatus === 'taken' && usernameSuggestions.length > 0 && (
              <View style={styles.suggestionRow}>
                {usernameSuggestions.map((s) => (
                  <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => setUsername(s)}>
                    <Text style={styles.suggestionChipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <FieldLabel>Phone Number</FieldLabel>
            <TextField value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
            <FieldLabel>Address</FieldLabel>
            <TextField value={address} onChangeText={setAddress} />
            {profileMessage ? <Text style={styles.success}>{profileMessage}</Text> : null}
            <Button
              label="Save Profile"
              onPress={handleSaveProfile}
              disabled={usernameStatus === 'taken' || usernameStatus === 'checking'}
              loading={isSavingProfile}
              style={{ marginTop: 16 }}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <FieldLabel>Current Password</FieldLabel>
            <TextField value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" />
            <FieldLabel>New Password</FieldLabel>
            <TextField value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
            <FieldLabel>Confirm New Password</FieldLabel>
            <TextField value={confirmNewPassword} onChangeText={setConfirmNewPassword} secureTextEntry autoCapitalize="none" />
            {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
            {passwordMessage ? <Text style={styles.success}>{passwordMessage}</Text> : null}
            <Button
              label="Change Password"
              onPress={handleChangePassword}
              disabled={!currentPassword || !newPassword || !confirmNewPassword}
              loading={isSavingPassword}
              style={{ marginTop: 16 }}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Change Email</Text>
            <Text style={styles.currentEmail}>Current: {user?.email}</Text>
            <FieldLabel>New Email</FieldLabel>
            <TextField value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" />
            {emailMessage ? <Text style={styles.success}>{emailMessage}</Text> : null}
            <Button label="Send Confirmation Link" onPress={handleRequestEmailChange} disabled={!newEmail.trim()} loading={isSavingEmail} style={{ marginTop: 16 }} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  card: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.slate100, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  currentEmail: { fontSize: 12.5, color: colors.slate600, marginBottom: 8 },
  usernameWrap: { position: 'relative', justifyContent: 'center' },
  usernameIcon: { position: 'absolute', right: 14 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  suggestionChip: { backgroundColor: colors.slate100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  suggestionChipText: { fontSize: 11.5, fontWeight: '700', color: colors.slate700 },
  success: { color: colors.accentText, fontSize: 12.5, marginTop: 10, fontWeight: '600' },
  error: { color: colors.rose600, fontSize: 13, textAlign: 'center', marginTop: 10 },
});

export default EditProfileScreen;
