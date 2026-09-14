import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchOrders } from '../../api/admin';
import { Order, OrderStatus } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { StatusBadge, EmptyState } from '../../components/admin/ui';
import type { AdminOrdersStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminOrdersStackParamList, 'OrdersList'>;

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const filters: (OrderStatus | 'All')[] = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

const AdminOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'All'>('All');

  const load = useCallback(async () => {
    if (!token) return;
    const { orders: fetched } = await fetchOrders(token);
    setOrders(fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, [token]);

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

  const visibleOrders = activeFilter === 'All' ? orders : orders.filter((o) => o.status === activeFilter);

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
        horizontal
        data={filters}
        keyExtractor={(f) => f}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === item && styles.filterChipActive]}
            onPress={() => setActiveFilter(item)}
          >
            <Text style={[styles.filterChipText, activeFilter === item && styles.filterChipTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />
      <FlatList
        style={{ flex: 1 }}
        data={visibleOrders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald800} />}
        ListEmptyComponent={<EmptyState label="No orders match this filter" />}
        renderItem={({ item }) => {
          // Ports frontend/pages/AdminManageOrders.tsx's `isUnchecked` row highlight: an order that's
          // still unread OR still Pending gets a tinted card + a "New" pill, cleared once the admin
          // opens it (AdminOrderDetailScreen marks it read and bumps Pending -> Processing).
          const isUnchecked = item.unread || item.status === 'Pending';
          return (
            <TouchableOpacity
              style={[styles.card, isUnchecked && styles.cardUnchecked]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.orderNumberRow}>
                  {isUnchecked && (
                    <View style={styles.newPill}>
                      <View style={styles.newPillDot} />
                      <Text style={styles.newPillText}>New</Text>
                    </View>
                  )}
                  <Text style={styles.orderNumber}>{item.orderNumber ?? item.id.slice(0, 8)}</Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.customerName} numberOfLines={1}>{item.customerName}</Text>
              <View style={styles.cardBottom}>
                <Text style={styles.orderDate}>{new Date(item.date).toLocaleDateString()}</Text>
                <Text style={styles.orderTotal}>{formatPrice(item.total)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  filterList: { flexGrow: 0, height: 56, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  filterRow: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  filterChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.emerald800,
    borderColor: colors.emerald800,
    shadowColor: colors.emerald800,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.slate700 },
  filterChipTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: 14,
    marginBottom: 10,
  },
  cardUnchecked: { backgroundColor: colors.rose50, borderColor: colors.rose50 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.rose500, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  newPillDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.white },
  newPillText: { color: colors.white, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  orderNumber: { fontSize: 14, fontWeight: '900', color: colors.slate900 },
  customerName: { fontSize: 13, color: colors.slate600, marginBottom: 8, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.slate50, paddingTop: 8 },
  orderDate: { fontSize: 11.5, color: colors.slate400, fontWeight: '600' },
  orderTotal: { fontSize: 14, fontWeight: '900', color: colors.accentText },
});

export default AdminOrdersScreen;
