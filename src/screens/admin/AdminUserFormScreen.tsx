import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchUsers, createUser, updateUser, deleteUser } from '../../api/admin';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, FieldLabel, TextField, Button } from '../../components/admin/ui';
import type { AdminUsersStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminUsersStackParamList, 'UserForm'>;

const AdminUserFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route.params;
  const isEditing = !!userId;
  const { token, user: currentUser } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | 'rider'>('user');
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId || !token) return;
    fetchUsers(token).then(({ users }) => {
      const u = users.find((x) => x.id === userId);
      if (u) {
        setName(u.name);
        setUsername(u.username);
        setEmail(u.email);
        setPhoneNumber(u.phoneNumber ?? '');
        setAddress(u.address ?? '');
        setRole(u.role);
        setIsActive(u.isActive !== false);
      }
      setIsLoading(false);
    });
  }, [userId, token]);

  const handleSave = async () => {
    if (!token) return;
    if (!name.trim() || !email.trim() || (!isEditing && !password)) {
      Alert.alert('Missing fields', 'Name, email, and (for new users) a password are required.');
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing) {
        await updateUser(userId!, {
          name: name.trim(), username: username.trim() || undefined, email: email.trim(),
          phoneNumber: phoneNumber.trim(), address: address.trim(), role, isActive,
          ...(password ? { password } : {}),
        }, token);
      } else {
        await createUser({
          name: name.trim(), username: username.trim() || undefined, email: email.trim(),
          phoneNumber: phoneNumber.trim(), address: address.trim(), role, password,
        }, token);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save user.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete user', 'This cannot be undone. Delete this account permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!token || !userId) return;
          await deleteUser(userId, token);
          navigation.goBack();
        },
      },
    ]);
  };

  const isSelf = currentUser?.id === userId;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card>
        <FieldLabel>Full Name</FieldLabel>
        <TextField value={name} onChangeText={setName} placeholder="Full name" />
        <FieldLabel>Username</FieldLabel>
        <TextField value={username} onChangeText={setUsername} placeholder="Auto-generated if left blank" autoCapitalize="none" />
        <FieldLabel>Email</FieldLabel>
        <TextField value={email} onChangeText={setEmail} placeholder="email@example.com" autoCapitalize="none" keyboardType="email-address" />
        <FieldLabel>Phone Number</FieldLabel>
        <TextField value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+250..." keyboardType="phone-pad" />
        <FieldLabel>Address</FieldLabel>
        <TextField value={address} onChangeText={setAddress} placeholder="Address" />

        <FieldLabel>Role</FieldLabel>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={role} onValueChange={setRole}>
            <Picker.Item label="User" value="user" />
            <Picker.Item label="Rider" value="rider" />
            <Picker.Item label="Admin" value="admin" />
          </Picker>
        </View>

        <FieldLabel>{isEditing ? 'New Password (leave blank to keep current)' : 'Password'}</FieldLabel>
        <TextField value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

        {isEditing && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Account Active</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              disabled={isSelf}
              trackColor={{ true: colors.emerald800, false: colors.slate200 }}
            />
          </View>
        )}
      </Card>

      <Button label={isEditing ? 'Save Changes' : 'Create User'} onPress={handleSave} loading={isSaving} style={{ marginTop: 24 }} />
      {isEditing && !isSelf && <Button label="Delete User" variant="danger" onPress={handleDelete} style={{ marginTop: 12 }} />}
    </ScrollView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  pickerWrap: { borderWidth: 1, borderColor: colors.slate200, borderRadius: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
});

export default AdminUserFormScreen;
