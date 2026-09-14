import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchReturns } from '../../api/admin';
import { ReturnRequest } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { EmptyState, StatusBadge } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'Returns'>;

const AdminReturnsScreen: React.FC<Props> = ({ navigation }) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const { returnRequests } = await fetchReturns(token);
    setReturns(returnRequests);
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
        data={returns}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<EmptyState label="No return requests" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('ReturnDetail', { returnId: item.id })}>
            <View style={styles.cardTop}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
            {item.unread && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  card: { position: 'relative', backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate100, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { fontSize: 14, fontWeight: '900', color: colors.slate900 },
  customerName: { fontSize: 12.5, color: colors.slate600, fontWeight: '600', marginBottom: 4 },
  reason: { fontSize: 12.5, color: colors.slate600 },
  unreadDot: { position: 'absolute', top: 14, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose500 },
});

export default AdminReturnsScreen;
