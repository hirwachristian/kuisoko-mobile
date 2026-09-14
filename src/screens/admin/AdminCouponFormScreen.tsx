import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../api/admin';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, FieldLabel, TextField, Button } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'CouponForm'>;

const AdminCouponFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { couponId } = route.params;
  const isEditing = !!couponId;
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!couponId || !token) return;
    fetchCoupons(token).then(({ coupons }) => {
      const c = coupons.find((x) => x.id === couponId);
      if (c) {
        setCode(c.code);
        setDiscountType(c.discountType);
        setDiscountValue(String(c.discountValue));
        setMinOrderAmount(String(c.minOrderAmount));
        setUsageLimit(c.usageLimit ? String(c.usageLimit) : '');
        setExpiresAt(c.expiresAt ? new Date(c.expiresAt) : null);
        setIsActive(c.isActive);
      }
      setIsLoading(false);
    });
  }, [couponId, token]);

  const handleSave = async () => {
    if (!token || !code.trim() || !discountValue) {
      Alert.alert('Missing fields', 'Code and discount value are required.');
      return;
    }
    setIsSaving(true);
    const payload = {
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      isActive,
    };
    try {
      if (isEditing) await updateCoupon(couponId!, payload, token);
      else await createCoupon(payload, token);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save coupon.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete coupon', 'Delete this coupon permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (!token || !couponId) return; await deleteCoupon(couponId, token); navigation.goBack(); } },
    ]);
  };

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
        <FieldLabel>Code</FieldLabel>
        <TextField value={code} onChangeText={setCode} placeholder="SAVE10" autoCapitalize="characters" />

        <FieldLabel>Discount Type</FieldLabel>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={discountType} onValueChange={setDiscountType}>
            <Picker.Item label="Percentage" value="percentage" />
            <Picker.Item label="Fixed Amount" value="fixed" />
          </Picker>
        </View>

        <FieldLabel>{discountType === 'percentage' ? 'Discount %' : 'Discount Amount (RWF)'}</FieldLabel>
        <TextField value={discountValue} onChangeText={setDiscountValue} placeholder="0" keyboardType="numeric" />

        <FieldLabel>Minimum Order Amount (RWF)</FieldLabel>
        <TextField value={minOrderAmount} onChangeText={setMinOrderAmount} placeholder="0" keyboardType="numeric" />

        <FieldLabel>Usage Limit (leave blank for unlimited)</FieldLabel>
        <TextField value={usageLimit} onChangeText={setUsageLimit} placeholder="Unlimited" keyboardType="numeric" />

        <FieldLabel>Expiry Date</FieldLabel>
        <Button
          label={expiresAt ? expiresAt.toLocaleDateString() : 'No expiry set'}
          variant="secondary"
          onPress={() => setShowDatePicker(true)}
        />
        {showDatePicker && (
          <DateTimePicker
            value={expiresAt ?? new Date()}
            mode="date"
            onChange={(_, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setExpiresAt(date);
            }}
          />
        )}
        {expiresAt && <Button label="Clear Expiry" variant="secondary" onPress={() => setExpiresAt(null)} style={{ marginTop: 8 }} />}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.emerald800, false: colors.slate200 }} />
        </View>
      </Card>

      <Button label={isEditing ? 'Save Changes' : 'Create Coupon'} onPress={handleSave} loading={isSaving} style={{ marginTop: 24 }} />
      {isEditing && <Button label="Delete Coupon" variant="danger" onPress={handleDelete} style={{ marginTop: 12 }} />}
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

export default AdminCouponFormScreen;
