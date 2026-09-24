import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ActivityIndicator, ScrollView, SafeAreaView, Share } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Users, Share2 } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { startGroupOrder, fetchGroupOrderStatus, joinGroupOrder } from '../api/customer';
import { Product, GroupOrderStatusResponse, DeliveryAddress } from '../types';
import { getProductThumbnail } from '../utils/productImage';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button, TextField, FieldLabel } from '../components/admin/ui';
import type { CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'GroupOrder'>;

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const emptyAddress = (): DeliveryAddress => ({
  fullName: '', phoneNumber: '', email: '', country: 'Rwanda', cityTown: '', district: '', streetAddress: '',
});

const GroupOrderScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const styles = createStyles(colors);

  const [code, setCode] = useState<string | undefined>(route.params?.code);
  const [status, setStatus] = useState<GroupOrderStatusResponse | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [address, setAddress] = useState<DeliveryAddress>({ ...emptyAddress(), fullName: user?.name ?? '', phoneNumber: user?.phoneNumber ?? '', email: user?.email ?? '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!route.params?.productId) return;
    apiFetch<{ product: Product }>(`/products/${route.params.productId}`).then(({ product: p }) => setProduct(p)).finally(() => setIsLoading(false));
  }, [route.params?.productId]);

  const pollStatus = useCallback((groupCode: string) => {
    const poll = () => fetchGroupOrderStatus(groupCode).then(setStatus).catch(() => {});
    poll();
    pollRef.current = setInterval(poll, 8000);
  }, []);

  useEffect(() => {
    if (code) {
      setIsLoading(true);
      pollStatus(code);
      setIsLoading(false);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [code, pollStatus]);

  const isValid = address.fullName.trim() && address.phoneNumber.trim() && address.email.trim() && address.cityTown.trim() && address.district.trim() && address.streetAddress.trim();

  const handleStart = async () => {
    if (!product || !isValid) return;
    setIsSubmitting(true);
    setError('');
    try {
      const { code: newCode } = await startGroupOrder({ productId: product.id, customerName: address.fullName, deliveryAddress: address });
      setCode(newCode);
      navigation.setOptions({ title: 'Group Order' });
    } catch {
      setError('Could not start the group order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!code || !isValid) return;
    setIsSubmitting(true);
    setError('');
    try {
      await joinGroupOrder(code, { customerName: address.fullName, deliveryAddress: address });
      await fetchGroupOrderStatus(code).then(setStatus);
    } catch {
      setError('Could not join this group order. It may be full or expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = () => {
    if (!code) return;
    Share.share({ message: `Join my KuISOKO group order for ${status?.product.name ?? 'this product'}! Use code: ${code}` });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  // View mode: a code exists (either passed in, or just created) - show live progress + join form.
  if (code) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {status ? (
            <>
              <View style={styles.productCard}>
                <Image source={{ uri: status.product.image }} style={styles.productImage} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={2}>{status.product.name}</Text>
                  <Text style={styles.productPrice}>{formatPrice(status.product.price)}</Text>
                </View>
              </View>

              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Users size={16} color={colors.accentText} />
                  <Text style={styles.progressTitle}>{t('mobile_group_order_progress')}</Text>
                </View>
                <Text style={styles.participantCount}>{status.participantCount} / {status.maxParticipants} joined</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (status.participantCount / status.maxParticipants) * 100)}%` }]} />
                </View>
                <Text style={styles.discountText}>Current discount: {status.currentDiscountPercent}%</Text>
                {status.tiers.map((tier) => (
                  <Text key={tier.minParticipants} style={styles.tierText}>
                    {tier.minParticipants}+ joiners get {tier.discountPercent}% off
                  </Text>
                ))}
              </View>

              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>Group code</Text>
                <Text style={styles.codeValue}>{code}</Text>
                <Text style={styles.shareHint}>{t('mobile_share_with_friends')}</Text>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                  <Share2 size={16} color={colors.white} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>

              {status.status === 'open' && (
                <View style={styles.formCard}>
                  <Text style={styles.sectionTitle}>{t('mobile_join_group_order')}</Text>
                  <FieldLabel>{t('mobile_full_name')}</FieldLabel>
                  <TextField value={address.fullName} onChangeText={(v) => setAddress((a) => ({ ...a, fullName: v }))} />
                  <FieldLabel>{t('mobile_phone_number')}</FieldLabel>
                  <TextField value={address.phoneNumber} onChangeText={(v) => setAddress((a) => ({ ...a, phoneNumber: v }))} keyboardType="phone-pad" />
                  <FieldLabel>{t('mobile_email')}</FieldLabel>
                  <TextField value={address.email} onChangeText={(v) => setAddress((a) => ({ ...a, email: v }))} autoCapitalize="none" keyboardType="email-address" />
                  <FieldLabel>{t('mobile_city_town')}</FieldLabel>
                  <TextField value={address.cityTown} onChangeText={(v) => setAddress((a) => ({ ...a, cityTown: v }))} />
                  <FieldLabel>{t('mobile_district')}</FieldLabel>
                  <TextField value={address.district} onChangeText={(v) => setAddress((a) => ({ ...a, district: v }))} />
                  <FieldLabel>{t('mobile_street_address')}</FieldLabel>
                  <TextField value={address.streetAddress} onChangeText={(v) => setAddress((a) => ({ ...a, streetAddress: v }))} />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <Button label={t('mobile_join_group_order')} onPress={handleJoin} disabled={!isValid} loading={isSubmitting} style={{ marginTop: 16 }} />
                </View>
              )}
            </>
          ) : (
            <ActivityIndicator size="large" color={colors.emerald800} />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Start mode: launched from a product's "Start Group Order" button, before a code exists.
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {product && (
          <View style={styles.productCard}>
            <Image source={{ uri: getProductThumbnail(product) }} style={styles.productImage} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
            </View>
          </View>
        )}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{t('mobile_start_group_order')}</Text>
          <FieldLabel>{t('mobile_full_name')}</FieldLabel>
          <TextField value={address.fullName} onChangeText={(v) => setAddress((a) => ({ ...a, fullName: v }))} />
          <FieldLabel>{t('mobile_phone_number')}</FieldLabel>
          <TextField value={address.phoneNumber} onChangeText={(v) => setAddress((a) => ({ ...a, phoneNumber: v }))} keyboardType="phone-pad" />
          <FieldLabel>{t('mobile_email')}</FieldLabel>
          <TextField value={address.email} onChangeText={(v) => setAddress((a) => ({ ...a, email: v }))} autoCapitalize="none" keyboardType="email-address" />
          <FieldLabel>{t('mobile_city_town')}</FieldLabel>
          <TextField value={address.cityTown} onChangeText={(v) => setAddress((a) => ({ ...a, cityTown: v }))} />
          <FieldLabel>{t('mobile_district')}</FieldLabel>
          <TextField value={address.district} onChangeText={(v) => setAddress((a) => ({ ...a, district: v }))} />
          <FieldLabel>{t('mobile_street_address')}</FieldLabel>
          <TextField value={address.streetAddress} onChangeText={(v) => setAddress((a) => ({ ...a, streetAddress: v }))} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={t('mobile_start_group_order')} onPress={handleStart} disabled={!isValid} loading={isSubmitting} style={{ marginTop: 16 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  productCard: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.slate100, marginBottom: 16, alignItems: 'center',
  },
  productImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.slate50 },
  productName: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  productPrice: { fontSize: 15, fontWeight: '900', color: colors.slate900, marginTop: 4 },
  progressCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.slate100, marginBottom: 16 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  progressTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900 },
  participantCount: { fontSize: 13, color: colors.slate600, marginBottom: 8 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: colors.slate100, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.emerald600, borderRadius: 5 },
  discountText: { fontSize: 14, fontWeight: '800', color: colors.accentText, marginTop: 12 },
  tierText: { fontSize: 12, color: colors.slate600, marginTop: 4 },
  codeCard: { backgroundColor: colors.emerald50, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16 },
  codeLabel: { fontSize: 11, fontWeight: '700', color: colors.accentText, textTransform: 'uppercase' },
  codeValue: { fontSize: 26, fontWeight: '900', color: colors.slate900, letterSpacing: 4, marginTop: 4 },
  shareHint: { fontSize: 12, color: colors.slate600, textAlign: 'center', marginTop: 10 },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.emerald800, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 },
  shareButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  formCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.slate100 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  error: { color: colors.rose600, fontSize: 13, marginTop: 14, textAlign: 'center' },
});

export default GroupOrderScreen;
