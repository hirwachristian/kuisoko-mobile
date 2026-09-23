import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity, Image, Alert, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Check, X as XIcon, Camera, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import {
  updateProfile, requestEmailChange, checkUsername, uploadProfilePhoto, deleteUploadedFile,
  start2FAEnable, confirm2FAEnable, disable2FA,
} from '../api/customer';
import { ApiError } from '../api/client';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button, TextField, FieldLabel } from '../components/admin/ui';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';
type TwoFAStep = 'idle' | 'awaiting-code' | 'awaiting-disable-password';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Ports frontend/pages/UserDashboard.tsx's profile tab: edit name/phone/address directly (PATCH
// /users/me), and request an email change separately (it needs a confirmation link, so it can't
// just PATCH straight through) - matches the website exactly. Change Password has no working
// customer-facing UI on the website (the admin account screen's own version is wired up, but the
// website's customer dashboard only ever declared dead state for it, never rendered) - the backend
// route (PATCH /users/me with {currentPassword, password}) is generic across every role though, so
// this ports the mobile ADMIN screen's already-working handleChangePassword pattern here instead.
//
// Avatar upload/remove and the 2FA enable/disable toggle port the website's later profile-settings
// redesign - the upload flow mirrors AdminAccountSecurityScreen.handleChangePhoto exactly (same
// ImagePicker -> uploadProfilePhoto -> PATCH /users/me -> updateLocalUser chain); the 2FA modal
// mirrors that same screen's enable flow, plus a working disable action it never wired up.
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');

  const [twoFAStep, setTwoFAStep] = useState<TwoFAStep>('idle');
  const [twoFACode, setTwoFACode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [is2FABusy, setIs2FABusy] = useState(false);

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

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to change your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !token) return;
    const asset = result.assets[0];
    const previousImage = user?.profileImage;
    setIsUploadingPhoto(true);
    try {
      const fileName = asset.fileName ?? `profile-${Date.now()}.jpg`;
      const { url } = await uploadProfilePhoto(asset.uri, fileName, asset.mimeType ?? 'image/jpeg', token);
      const { user: updated } = await updateProfile({ profileImage: url }, token);
      updateLocalUser(updated);
      if (previousImage) deleteUploadedFile(previousImage, token).catch(() => {});
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update your profile photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!token || !user?.profileImage) return;
    const previousImage = user.profileImage;
    setIsUploadingPhoto(true);
    try {
      const { user: updated } = await updateProfile({ profileImage: null }, token);
      updateLocalUser(updated);
      deleteUploadedFile(previousImage, token).catch(() => {});
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove your profile photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

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

  const handleStart2FA = async () => {
    if (!token) return;
    setIs2FABusy(true);
    try {
      await start2FAEnable(token);
      setTwoFAStep('awaiting-code');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send code.');
    } finally {
      setIs2FABusy(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (!token || twoFACode.length !== 6) return;
    setIs2FABusy(true);
    try {
      const { user: updated } = await confirm2FAEnable(twoFACode, token);
      updateLocalUser(updated);
      setTwoFAStep('idle');
      setTwoFACode('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Invalid or expired code.');
    } finally {
      setIs2FABusy(false);
    }
  };

  const handleConfirmDisable2FA = async () => {
    if (!token || !disablePassword) return;
    setIs2FABusy(true);
    try {
      const { user: updated } = await disable2FA(disablePassword, token);
      updateLocalUser(updated);
      setTwoFAStep('idle');
      setDisablePassword('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Incorrect password.');
    } finally {
      setIs2FABusy(false);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={styles.photoSection}>
            <TouchableOpacity style={styles.avatarWrap} onPress={handleChangePhoto} disabled={isUploadingPhoto} activeOpacity={0.8}>
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</Text>
              )}
              <View style={styles.avatarBadge}>
                {isUploadingPhoto ? <ActivityIndicator size="small" color={colors.white} /> : <Camera size={13} color={colors.white} />}
              </View>
            </TouchableOpacity>
            {user.profileImage && (
              <TouchableOpacity style={styles.removePhotoBadge} onPress={handleRemovePhoto} disabled={isUploadingPhoto}>
                <XIcon size={12} color={colors.white} />
              </TouchableOpacity>
            )}
            <Text style={styles.photoHint}>Tap to change photo</Text>
            <Text style={styles.customerId}>Customer ID: {user.id}</Text>
            {user.isActive !== false && (
              <View style={styles.activeBadge}>
                <View style={styles.activeDot} />
                <Text style={styles.activeBadgeText}>Active Account</Text>
              </View>
            )}
          </View>

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
              variant="orange"
              onPress={handleSaveProfile}
              disabled={usernameStatus === 'taken' || usernameStatus === 'checking'}
              loading={isSavingProfile}
              style={{ marginTop: 16 }}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Security</Text>
            <View style={styles.securityRow}>
              <Text style={styles.securityLabel}>Member Since</Text>
              <Text style={styles.securityValue}>{user.registrationDate ? formatDate(user.registrationDate) : '—'}</Text>
            </View>
            <View style={[styles.securityRow, { borderBottomWidth: twoFAStep === 'idle' ? 0 : 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color={colors.accentText} />
                <Text style={styles.securityLabel}>Two-Factor Auth</Text>
              </View>
              {twoFAStep === 'idle' && (
                user.twoFactorEnabled ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={styles.enabledText}>Enabled</Text>
                    <TouchableOpacity onPress={() => setTwoFAStep('awaiting-disable-password')}>
                      <Text style={styles.disableLink}>Disable</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleStart2FA} disabled={is2FABusy}>
                    <Text style={styles.enableLink}>{is2FABusy ? 'Sending...' : 'Enable'}</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
            {twoFAStep === 'idle' && !user.twoFactorEnabled && (
              <Text style={styles.description}>Add a 6-digit code sent to your email on top of your password when signing in.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <FieldLabel>Current Password</FieldLabel>
            <View style={styles.passwordWrap}>
              <TextField value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry={!showCurrentPassword} autoCapitalize="none" style={{ paddingRight: 40 }} />
              <TouchableOpacity style={styles.passwordEye} onPress={() => setShowCurrentPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showCurrentPassword ? <EyeOff size={18} color={colors.slate400} /> : <Eye size={18} color={colors.slate400} />}
              </TouchableOpacity>
            </View>
            <FieldLabel>New Password</FieldLabel>
            <View style={styles.passwordWrap}>
              <TextField value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showNewPassword} autoCapitalize="none" style={{ paddingRight: 40 }} />
              <TouchableOpacity style={styles.passwordEye} onPress={() => setShowNewPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showNewPassword ? <EyeOff size={18} color={colors.slate400} /> : <Eye size={18} color={colors.slate400} />}
              </TouchableOpacity>
            </View>
            <FieldLabel>Confirm New Password</FieldLabel>
            <View style={styles.passwordWrap}>
              <TextField value={confirmNewPassword} onChangeText={setConfirmNewPassword} secureTextEntry={!showConfirmNewPassword} autoCapitalize="none" style={{ paddingRight: 40 }} />
              <TouchableOpacity style={styles.passwordEye} onPress={() => setShowConfirmNewPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showConfirmNewPassword ? <EyeOff size={18} color={colors.slate400} /> : <Eye size={18} color={colors.slate400} />}
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
            {passwordMessage ? <Text style={styles.success}>{passwordMessage}</Text> : null}
            <Button
              label="Change Password"
              variant="orange"
              onPress={handleChangePassword}
              disabled={!currentPassword || !newPassword || !confirmNewPassword}
              loading={isSavingPassword}
              style={{ marginTop: 16 }}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Change Email</Text>
            <Text style={styles.currentEmail}>Current: {user.email}</Text>
            <FieldLabel>New Email</FieldLabel>
            <TextField value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" />
            {emailMessage ? <Text style={styles.success}>{emailMessage}</Text> : null}
            <Button label="Send Confirmation Link" variant="orange" onPress={handleRequestEmailChange} disabled={!newEmail.trim()} loading={isSavingEmail} style={{ marginTop: 16 }} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={twoFAStep === 'awaiting-code'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter Verification Code</Text>
            <Text style={styles.description}>We emailed you a 6-digit code.</Text>
            <TextField
              value={twoFACode}
              onChangeText={(v) => setTwoFACode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8, marginTop: 12 }}
            />
            <View style={styles.modalButtons}>
              <Button label="Cancel" variant="secondary" onPress={() => { setTwoFAStep('idle'); setTwoFACode(''); }} style={{ flex: 1 }} />
              <Button label="Confirm" onPress={handleConfirm2FA} loading={is2FABusy} disabled={twoFACode.length !== 6} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={twoFAStep === 'awaiting-disable-password'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Disable Two-Factor Auth</Text>
            <Text style={styles.description}>Enter your password to confirm.</Text>
            <TextField
              value={disablePassword}
              onChangeText={setDisablePassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              style={{ marginTop: 12 }}
            />
            <View style={styles.modalButtons}>
              <Button label="Cancel" variant="secondary" onPress={() => { setTwoFAStep('idle'); setDisablePassword(''); }} style={{ flex: 1 }} />
              <Button label="Disable" variant="danger" onPress={handleConfirmDisable2FA} loading={is2FABusy} disabled={!disablePassword} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  avatarWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.emerald600, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { color: colors.white, fontSize: 30, fontWeight: '900' },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.slate50,
  },
  removePhotoBadge: {
    position: 'absolute', top: 0, right: '38%', width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.rose500, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.slate50,
  },
  photoHint: { fontSize: 11.5, color: colors.slate600, marginTop: 8, fontWeight: '600' },
  customerId: { fontSize: 11, color: colors.slate400, marginTop: 4, fontWeight: '600' },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.emerald50,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald600 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accentText },
  card: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.slate100, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  currentEmail: { fontSize: 12.5, color: colors.slate600, marginBottom: 8 },
  usernameWrap: { position: 'relative', justifyContent: 'center' },
  usernameIcon: { position: 'absolute', right: 14 },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordEye: { position: 'absolute', right: 14, top: 12 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  suggestionChip: { backgroundColor: colors.slate100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  suggestionChipText: { fontSize: 11.5, fontWeight: '700', color: colors.slate700 },
  success: { color: colors.accentText, fontSize: 12.5, marginTop: 10, fontWeight: '600' },
  error: { color: colors.rose600, fontSize: 13, textAlign: 'center', marginTop: 10 },
  securityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  securityLabel: { fontSize: 13.5, fontWeight: '700', color: colors.slate700 },
  securityValue: { fontSize: 13.5, fontWeight: '700', color: colors.slate900 },
  enabledText: { fontSize: 13, fontWeight: '700', color: colors.accentText },
  disableLink: { fontSize: 12.5, fontWeight: '700', color: colors.rose600 },
  enableLink: { fontSize: 13, fontWeight: '700', color: colors.orange600 },
  description: { fontSize: 12, color: colors.slate600, lineHeight: 18, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900, marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});

export default EditProfileScreen;
