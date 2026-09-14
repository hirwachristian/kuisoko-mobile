import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PackageSearch, ChevronRight } from 'lucide-react-native';
import { fetchMyOrders } from '../api/customer';
import { Order } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/admin/ui';
import type { CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderHistory'>;

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const OrderHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { token } = useAuth();
  const styles = createStyles(colors);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      fetchMyOrders(token).then(({ orders: fetched }) => setOrders(fetched)).finally(() => setIsLoading(false));
    }, [token])
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
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
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
            </View>
            <ChevronRight size={18} color={colors.slate400} />
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
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.slate100,
  },
  orderNumber: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  date: { fontSize: 12, color: colors.slate400, marginTop: 2 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  total: { fontSize: 14, fontWeight: '900', color: colors.slate900 },
});

export default OrderHistoryScreen;
