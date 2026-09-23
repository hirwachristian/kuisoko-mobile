import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PackageSearch, ChevronRight, Receipt, Clock, Truck, CheckCircle2 } from 'lucide-react-native';
import { fetchMyOrders } from '../api/customer';
import { Order, OrderStatus } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { StatusBadge, Button } from '../components/admin/ui';
import Pagination from '../components/Pagination';
import type { CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderHistory'>;

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const ORDERS_PER_PAGE = 4;
type OrderFilter = 'All' | 'Pending' | 'Shipped' | 'Delivered' | 'Processing';
const FILTERS: OrderFilter[] = ['All', 'Pending', 'Shipped', 'Delivered', 'Processing'];

const OrderHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { token } = useAuth();
  const { addToCart } = useCart();
  const styles = createStyles(colors);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'All'>('All');
  const [page, setPage] = useState(1);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      fetchMyOrders(token).then(({ orders: fetched }) => setOrders(fetched)).finally(() => setIsLoading(false));
    }, [token])
  );

  const counts = useMemo(() => ({
    Pending: orders.filter((o) => o.status === 'Pending').length,
    Processing: orders.filter((o) => o.status === 'Processing').length,
    Shipped: orders.filter((o) => o.status === 'Shipped').length,
    Delivered: orders.filter((o) => o.status === 'Delivered').length,
  }), [orders]);

  const statCards: { label: string; value: number; icon: typeof Receipt; color: string; bg: string }[] = [
    { label: 'Total', value: orders.length, icon: Receipt, color: colors.slate700, bg: colors.slate100 },
    { label: 'Pending', value: counts.Pending, icon: Clock, color: colors.amber800, bg: colors.amber50 },
    { label: 'Shipped', value: counts.Shipped, icon: Truck, color: colors.lime700, bg: colors.lime50 },
    { label: 'Delivered', value: counts.Delivered, icon: CheckCircle2, color: colors.accentText, bg: colors.emerald50 },
  ];

  const visibleFilters = FILTERS.filter((f) => f === 'All' || counts[f] > 0);
  const filteredOrders = activeFilter === 'All' ? orders : orders.filter((o) => o.status === activeFilter);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const pagedOrders = filteredOrders.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);

  const handleFilterChange = (filter: OrderStatus | 'All') => {
    setActiveFilter(filter);
    setPage(1);
  };

  // Ports OrderDetailScreen.handleBuyAgain onto the list row - a delivered order can be
  // re-ordered right from the list, not just from its own detail screen.
  const handleBuyAgain = async (order: Order) => {
    for (const item of order.items) {
      if (item.productId) {
        await addToCart(item.productId, item.quantity, item.selectedColor, item.selectedSize, item.price);
      }
    }
    navigation.navigate('Tabs', { screen: 'Cart' } as never);
  };

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
        data={pagedOrders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        ListHeaderComponent={
          orders.length > 0 ? (
            <>
              <View style={styles.statGrid}>
                {statCards.map((card) => (
                  <View key={card.label} style={styles.statCard}>
                    <View>
                      <Text style={styles.statLabel}>{card.label}</Text>
                      <Text style={styles.statValue}>{card.value}</Text>
                    </View>
                    <View style={[styles.statIconWrap, { backgroundColor: card.bg }]}>
                      <card.icon size={18} color={card.color} />
                    </View>
                  </View>
                ))}
              </View>
              <FlatList
                horizontal
                data={visibleFilters}
                keyExtractor={(f) => f}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={styles.filterList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.filterChip, activeFilter === item && styles.filterChipActive]}
                    onPress={() => handleFilterChange(item)}
                  >
                    <Text style={[styles.filterChipText, activeFilter === item && styles.filterChipTextActive]}>
                      {item} {item !== 'All' ? `(${counts[item]})` : `(${orders.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </>
          ) : null
        }
        ListFooterComponent={
          filteredOrders.length > 0 ? (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredOrders.length} itemsPerPage={ORDERS_PER_PAGE} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <PackageSearch size={32} color={colors.slate400} />
            </View>
            <Text style={styles.emptyTitle}>{t('mobile_no_orders_yet')}</Text>
            <Text style={styles.emptyHint}>{t('mobile_no_orders_hint')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNumber}>{t('mobile_order_number')} #{(item.orderNumber ?? item.id).slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.date}>{formatDate(item.date)}</Text>
              <View style={styles.rowBottom}>
                <StatusBadge status={item.status} />
                <Text style={styles.total}>{formatPrice(item.total)}</Text>
              </View>
              {item.status === 'Delivered' && (
                <Button label={t('mobile_buy_again')} variant="orange" onPress={() => handleBuyAgain(item)} style={styles.buyAgainButton} />
              )}
            </View>
            {item.status !== 'Delivered' && <ChevronRight size={18} color={colors.slate400} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.slate900 },
  emptyHint: { fontSize: 13, color: colors.slate600, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: {
    flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate100, padding: 14,
  },
  statLabel: { fontSize: 10.5, fontWeight: '700', color: colors.slate600, textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.slate900, marginTop: 2 },
  statIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterList: { flexGrow: 0, marginBottom: 12, marginHorizontal: -16 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate200, justifyContent: 'center', alignItems: 'center',
  },
  filterChipActive: { backgroundColor: colors.orange500, borderColor: colors.orange500 },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.slate700 },
  filterChipTextActive: { color: colors.white },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.slate100,
  },
  orderNumber: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  date: { fontSize: 12, color: colors.slate400, marginTop: 2 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  total: { fontSize: 14, fontWeight: '900', color: colors.slate900 },
  buyAgainButton: { marginTop: 12, paddingVertical: 10 },
});

export default OrderHistoryScreen;
