import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, Search } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAdminNotifications } from '../../context/AdminNotificationsContext';
import { fetchUsers, markUserRead } from '../../api/admin';
import { User } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { EmptyState, StatusBadge } from '../../components/admin/ui';
import type { AdminUsersStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminUsersStackParamList, 'UsersList'>;

const AdminUsersScreen: React.FC<Props> = ({ navigation }) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const { refresh: refreshAdminNotifications } = useAdminNotifications();
  const styles = createStyles(colors);
  const roleColors: Record<string, string> = { admin: colors.emerald800, rider: colors.orange500, user: colors.slate600 };
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ports frontend/pages/AdminManageUsers.tsx: simply landing on this list bulk-clears every
  // unread user's badge, no click into an individual user needed - matches the website exactly.
  const load = useCallback(async () => {
    if (!token) return;
    const { users: fetched } = await fetchUsers(token);
    setUsers(fetched);
    const unread = fetched.filter((u) => u.unread);
    if (unread.length > 0) {
      await Promise.all(unread.map((u) => markUserRead(u.id, token).catch(() => {})));
      setUsers((prev) => prev.map((u) => (u.unread ? { ...u, unread: false } : u)));
      refreshAdminNotifications();
    }
  }, [token, refreshAdminNotifications]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const visible = users.filter(
    (u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase())
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Search size={16} color={colors.slate400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={colors.slate400}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('UserForm', {})}>
          <Plus size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald800} />}
        ListEmptyComponent={<EmptyState label="No users found" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('UserForm', { userId: item.id })}>
            <View style={[styles.avatar, { backgroundColor: roleColors[item.role] }]}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardUsername}>@{item.username}</Text>
              <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <StatusBadge status={item.role} />
              {item.isActive === false && <StatusBadge status="inactive" />}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  topBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.slate50,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.slate900 },
  addButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: 12,
    marginBottom: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  cardName: { fontSize: 13.5, fontWeight: '700', color: colors.slate900 },
  cardUsername: { fontSize: 11.5, color: colors.slate400, marginTop: 1, fontWeight: '600' },
  cardEmail: { fontSize: 11.5, color: colors.slate600, marginTop: 1 },
});

export default AdminUsersScreen;
