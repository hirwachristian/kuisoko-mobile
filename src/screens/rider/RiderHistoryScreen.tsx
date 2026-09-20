import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { History } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { fetchMyDeliveryHistory, RiderHistoryOrder } from '../../api/rider';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

// Ports frontend/pages/RiderDashboard.tsx's history tab - a personal log of past completed
// deliveries, fetched once when this tab is first opened (matches the website's "only load on
// first visit" behavior, capped at 50 server-side).
const RiderHistoryScreen: React.FC = () => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [history, setHistory] = useState<RiderHistoryOrder[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (history !== null || !token) {
        setIsLoading(false);
        return;
      }
      fetchMyDeliveryHistory(token)
        .then(({ orders }) => setHistory(orders))
        .catch((e) => console.error('Could not load delivery history:', e))
        .finally(() => setIsLoading(false));
    }, [history, token])
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
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={history ?? []}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <History size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('mobile_rider_history_empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.title}>#{item.orderNumber} — {item.customerName}</Text>
              {item.deliveredAt && (
                <Text style={styles.date}>{new Date(item.deliveredAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
              )}
            </View>
            <Text style={styles.address}>{item.deliveryStreetAddress}, {item.deliveryCityTown}, {item.deliveryDistrict}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  date: { fontSize: 11, color: colors.textMuted },
  address: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 13, color: colors.textMuted },
});

export default RiderHistoryScreen;
