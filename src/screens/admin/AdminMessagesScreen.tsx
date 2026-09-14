import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchConversations } from '../../api/admin';
import { ChatConversation } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { EmptyState } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'Messages'>;

const AdminMessagesScreen: React.FC<Props> = ({ navigation }) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const { conversations: fetched } = await fetchConversations(token);
    setConversations(fetched.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
  }, [token]);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.userId}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<EmptyState label="No conversations yet" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ChatThread', { userId: item.userId, name: item.name })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.time}>{new Date(item.lastMessageAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessageSenderRole === 'admin' ? 'You: ' : ''}
                {item.lastMessageBody ?? (item.lastMessageAttachmentType ? '📎 Attachment' : '')}
              </Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{item.unreadCount}</Text></View>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
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
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.emerald600, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 13.5, fontWeight: '800', color: colors.slate900, flex: 1 },
  time: { fontSize: 10.5, color: colors.slate400, fontWeight: '600' },
  preview: { fontSize: 12.5, color: colors.slate600, marginTop: 2 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.orange500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
});

export default AdminMessagesScreen;
