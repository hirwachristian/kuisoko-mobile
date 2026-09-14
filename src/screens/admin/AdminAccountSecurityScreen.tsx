import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { updateMe, start2FAEnable, confirm2FAEnable, uploadFile } from '../../api/admin';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, SectionTitle, FieldLabel, TextField, Button, ToggleRow } from '../../components/admin/ui';

const AdminAccountSecurityScreen: React.FC = () => {
  const { user, token, updateLocalUser } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [twoFAModalVisible, setTwoFAModalVisible] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [isSending2FA, setIsSending2FA] = useState(false);

  if (!user) return null;

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to change your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !token) return;
    const asset = result.assets[0];
    setIsUploadingPhoto(true);
    try {
      const fileName = asset.fileName ?? `profile-${Date.now()}.jpg`;
      const { url } = await uploadFile(asset.uri, fileName, asset.mimeType ?? 'image/jpeg', token);
      const { user: updated } = await updateMe({ profileImage: url }, token);
      updateLocalUser(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update profile photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    setIsSavingProfile(true);
    try {
      const { user: updated } = await updateMe({ name: name.trim(), username: username.trim(), phoneNumber: phoneNumber.trim(), address: address.trim() }, token);
      updateLocalUser(updated);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token || !currentPassword || !newPassword) {
      Alert.alert('Missing fields', 'Enter your current and new password.');
      return;
    }
    setIsSavingPassword(true);
    try {
      await updateMe({ currentPassword, password: newPassword }, token);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Saved', 'Your password has been changed.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not change password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleStart2FA = async () => {
    if (!token) return;
    setIsSending2FA(true);
    try {
      await start2FAEnable(token);
      setTwoFAModalVisible(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send code.');
    } finally {
      setIsSending2FA(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (!token || twoFACode.length !== 6) return;
    setIsSending2FA(true);
    try {
      const { user: updated } = await confirm2FAEnable(twoFACode, token);
      updateLocalUser(updated);
      setTwoFAModalVisible(false);
      setTwoFACode('');
      Alert.alert('Enabled', 'Two-factor authentication is now on for your account.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Invalid or expired code.');
    } finally {
      setIsSending2FA(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
        <Text style={styles.photoHint}>Tap to change photo</Text>
      </View>

      <SectionTitle>Profile</SectionTitle>
      <Card>
        <FieldLabel>Full Name</FieldLabel>
        <TextField value={name} onChangeText={setName} placeholder="Full name" />
        <FieldLabel>Username</FieldLabel>
        <TextField value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" />
        <FieldLabel>Phone Number</FieldLabel>
        <TextField value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+250..." keyboardType="phone-pad" />
        <FieldLabel>Address</FieldLabel>
        <TextField value={address} onChangeText={setAddress} placeholder="Address" />
        <Button label="Save Profile" onPress={handleSaveProfile} loading={isSavingProfile} style={{ marginTop: 14 }} />
      </Card>

      <SectionTitle style={{ marginTop: 24 }}>Change Password</SectionTitle>
      <Card>
        <FieldLabel>Current Password</FieldLabel>
        <TextField value={currentPassword} onChangeText={setCurrentPassword} placeholder="••••••••" secureTextEntry />
        <FieldLabel>New Password</FieldLabel>
        <TextField value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" secureTextEntry />
        <Button label="Change Password" onPress={handleChangePassword} loading={isSavingPassword} style={{ marginTop: 14 }} />
      </Card>

      <SectionTitle style={{ marginTop: 24 }}>Two-Factor Authentication</SectionTitle>
      <Card>
        {user.role === 'admin' ? (
          <ToggleRow
            label="Two-Factor Authentication"
            description="Required for all admin accounts and cannot be turned off."
            value={true}
            onToggle={() => Alert.alert('Required', 'Two-factor authentication cannot be disabled for admin accounts.')}
          />
        ) : user.twoFactorEnabled ? (
          <ToggleRow label="Two-Factor Authentication" description="Enabled on your account." value={true} onToggle={() => {}} />
        ) : (
          <>
            <Text style={styles.description}>Add an extra layer of security - we'll email you a code to enter at sign-in.</Text>
            <Button label="Enable Two-Factor Authentication" variant="secondary" onPress={handleStart2FA} loading={isSending2FA} style={{ marginTop: 12 }} />
          </>
        )}
      </Card>

      <Modal visible={twoFAModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter Verification Code</Text>
            <Text style={styles.description}>We emailed you a 6-digit code.</Text>
            <TextField
              value={twoFACode}
              onChangeText={(t) => setTwoFACode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8, marginTop: 12 }}
            />
            <View style={styles.modalButtons}>
              <Button label="Cancel" variant="secondary" onPress={() => setTwoFAModalVisible(false)} style={{ flex: 1 }} />
              <Button label="Confirm" onPress={handleConfirm2FA} loading={isSending2FA} disabled={twoFACode.length !== 6} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  photoSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.emerald600, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { color: colors.white, fontSize: 30, fontWeight: '900' },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.slate50,
  },
  photoHint: { fontSize: 11.5, color: colors.slate600, marginTop: 8, fontWeight: '600' },
  description: { fontSize: 12.5, color: colors.slate600, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900, marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});

export default AdminAccountSecurityScreen;
