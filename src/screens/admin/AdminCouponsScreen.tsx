import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, Trash2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { fetchCoupons, deleteCoupon } from '../../api/admin';
import { Coupon } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { EmptyState, StatusBadge } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'Coupons'>;

const AdminCouponsScreen: React.FC<Props> = ({ navigation }) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const { coupons: fetched } = await fetchCoupons(token);
    setCoupons(fetched);
  }, [token]);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  const handleDelete = (id: string, code: string) => {
    Alert.alert('Delete coupon', `Delete "${code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (!token) return; await deleteCoupon(id, token); await load(); } },
    ]);
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
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CouponForm', {})}>
          <Plus size={16} color={colors.white} />
          <Text style={styles.addButtonText}>Add Coupon</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={coupons}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        ListEmptyComponent={<EmptyState label="No coupons yet" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('CouponForm', { couponId: item.id })}>
            <View style={{ flex: 1 }}>
              <View style={styles.cardTop}>
                <Text style={styles.code}>{item.code}</Text>
                <StatusBadge status={item.isActive ? 'active' : 'inactive'} />
              </View>
              <Text style={styles.discount}>
                {item.discountType === 'percentage' ? `${item.discountValue}% off` : `RWF ${item.discountValue.toLocaleString()} off`}
                {item.minOrderAmount > 0 ? ` · min RWF ${item.minOrderAmount.toLocaleString()}` : ''}
              </Text>
              <Text style={styles.usage}>
                Used {item.usageCount}{item.usageLimit ? ` / ${item.usageLimit}` : ''} times
                {item.expiresAt ? ` · expires ${new Date(item.expiresAt).toLocaleDateString()}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id, item.code)} style={{ padding: 6 }}>
              <Trash2 size={16} color={colors.rose500} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  topBar: { padding: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  addButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.emerald800, borderRadius: 12, paddingVertical: 12 },
  addButtonText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  code: { fontSize: 15, fontWeight: '900', color: colors.slate900, letterSpacing: 0.5 },
  discount: { fontSize: 12.5, color: colors.accentText, fontWeight: '700' },
  usage: { fontSize: 11, color: colors.slate400, marginTop: 3, fontWeight: '600' },
});

export default AdminCouponsScreen;
