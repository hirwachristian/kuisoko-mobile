import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, SafeAreaView, Image } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Wallet, CreditCard, Banknote, Check, Tag, X, ShoppingBag, ChevronLeft } from 'lucide-react-native';
import { apiFetch } from '../../api/client';
import {
  requestCheckoutVerification, verifyCheckoutCode, placeOrder, requestMomoPayment, fetchMomoStatus, validateCoupon, PlaceOrderItem,
  fetchWallet,
} from '../../api/customer';
import { fetchPaymentMethods } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Product } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { getLineImage } from '../../utils/productImage';
import CheckoutStepper from '../../components/customer/CheckoutStepper';
import type { CustomerStackParamList } from '../../navigation/CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CheckoutPayment'>;

type PaymentMethod = 'Cash on Delivery' | 'MTN MoMo' | 'Wallet';
type Stage = 'method' | 'verify' | 'momoPhone' | 'momoWait' | 'placing';

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

const CheckoutPaymentScreen: React.FC<Props> = ({ route, navigation }) => {
  const { addressData, shippingFee = 0, shippingZoneName, directBuyItem } = route.params;
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { token } = useAuth();
  const { items, clear } = useCart();
  const styles = createStyles(colors);

  const [products, setProducts] = useState<Product[]>([]);
  const [stage, setStage] = useState<Stage>('method');
  const [method, setMethod] = useState<PaymentMethod>('Cash on Delivery');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [momoPhone, setMomoPhone] = useState(addressData.phoneNumber ?? '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const pollAttempts = useRef(0);

  // "Wallet" only shows up as a selectable method when the admin has actually enabled it in
  // Payment Settings - same admin-configurable payment_methods list the website's checkout reads,
  // even though this screen's Cash on Delivery/MTN MoMo options predate that list and stay
  // hardcoded (a pre-existing gap, not something this wallet port is meant to fix).
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ products: Product[] }>('/products').then(({ products: fetched }) => setProducts(fetched));
      fetchPaymentMethods()
        .then(({ paymentMethods }) => setWalletEnabled(paymentMethods.some((m) => m.enabled && /wallet/i.test(m.name))))
        .catch(() => {});
      if (token) fetchWallet(token).then((r) => setWalletBalance(r.balance)).catch(() => {});
    }, [token])
  );

  // Buy Now (directBuyItem) checks out a single item standalone, matching the website exactly -
  // it never touched the persistent cart, so this screen must neither read from nor clear it.
  const cartItems: PlaceOrderItem[] = directBuyItem
    ? [directBuyItem]
    : items
        .map((line): PlaceOrderItem | null => {
          const product = products.find((p) => p.id === line.productId);
          if (!product) return null;
          return {
            productId: product.id,
            name: product.name,
            image: getLineImage(product, line.selectedImage, line.selectedColor),
            price: line.unitPrice ?? product.price,
            quantity: line.quantity,
            selectedColor: line.selectedColor ?? undefined,
            selectedSize: line.selectedSize ?? undefined,
          };
        })
        .filter((i): i is PlaceOrderItem => i !== null);

  const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const total = Math.max(0, subtotal + shippingFee - discountAmount);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError('');
    try {
      const result = await validateCoupon(couponInput.trim(), subtotal);
      setAppliedCoupon(result);
    } catch (e) {
      setAppliedCoupon(null);
      setCouponError(e instanceof ApiError ? e.message : 'Invalid coupon code.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleSendCode = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await requestCheckoutVerification(addressData.email, addressData.fullName);
      setCodeSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const { token: vToken } = await verifyCheckoutCode(addressData.email, code.trim());
      setVerificationToken(vToken);
      if (method === 'MTN MoMo') setStage('momoPhone');
      else await finalizeOrder(vToken);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invalid or expired code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalizeOrder = async (vToken: string, paymentMethod?: PaymentMethod) => {
    setStage('placing');
    setError('');
    try {
      const { order } = await placeOrder(
        {
          customerName: addressData.fullName,
          deliveryAddress: addressData,
          items: cartItems,
          verificationToken: vToken,
          couponCode: appliedCoupon?.code,
          paymentMethod: paymentMethod === 'MTN MoMo' ? undefined : (paymentMethod ?? method),
        },
        token
      );
      if (paymentMethod === 'MTN MoMo' || (!paymentMethod && method === 'MTN MoMo')) {
        const { referenceId } = await requestMomoPayment(order.id, momoPhone.trim());
        setStage('momoWait');
        pollAttempts.current = 0;
        pollMomoStatus(referenceId, order.id);
      } else {
        if (!directBuyItem) await clear();
        navigation.replace('CheckoutConfirmation', { orderId: order.id });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not place your order.');
      setStage(method === 'MTN MoMo' && verificationToken ? 'momoPhone' : 'method');
    }
  };

  const pollMomoStatus = (referenceId: string, orderId: string) => {
    const interval = setInterval(async () => {
      pollAttempts.current += 1;
      try {
        const { status } = await fetchMomoStatus(referenceId);
        if (status === 'SUCCESSFUL') {
          clearInterval(interval);
          if (!directBuyItem) await clear();
          navigation.replace('CheckoutConfirmation', { orderId });
        } else if (status === 'FAILED') {
          clearInterval(interval);
          setError('MoMo payment failed or was declined.');
          setStage('momoPhone');
        } else if (pollAttempts.current >= 40) {
          clearInterval(interval);
          setError('Payment confirmation timed out. Please try again.');
          setStage('momoPhone');
        }
      } catch {
        // transient network error - keep polling until attempt cap
      }
    }, 3000);
  };

  const handleContinueFromMethod = () => {
    if (verificationToken) {
      if (method === 'MTN MoMo') setStage('momoPhone');
      else finalizeOrder(verificationToken);
    } else {
      setStage('verify');
    }
  };

  const handlePayWithMomo = () => {
    if (!momoPhone.trim()) return;
    if (verificationToken) finalizeOrder(verificationToken, 'MTN MoMo');
  };

  if (stage === 'placing' || stage === 'momoWait') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
        {stage === 'momoWait' && <Text style={styles.waitingText}>{t('mobile_waiting_for_momo')}</Text>}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CheckoutStepper currentStep={3} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <ShoppingBag size={16} color={colors.accentText} />
            <Text style={styles.summaryHeading}>Order Summary</Text>
          </View>

          <View style={styles.summaryItemsList}>
            {cartItems.map((item, i) => (
              <View key={`${item.productId ?? i}-${item.selectedColor ?? ''}-${item.selectedSize ?? ''}`} style={styles.summaryItemRow}>
                <Image source={{ uri: item.image }} style={styles.summaryItemImage} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryItemName} numberOfLines={2}>{item.name}</Text>
                  {(item.selectedColor || item.selectedSize) && (
                    <Text style={styles.summaryItemVariant}>{[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')}</Text>
                  )}
                  <Text style={styles.summaryItemQty}>Qty {item.quantity} × {formatPrice(item.price)}</Text>
                </View>
                <Text style={styles.summaryItemLineTotal}>{formatPrice(item.price * item.quantity)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('mobile_subtotal')} ({itemCount} {itemCount === 1 ? 'item' : 'items'})</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
          </View>
          {shippingFee > 0 || shippingZoneName ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping{shippingZoneName ? ` (${shippingZoneName})` : ''}</Text>
              <Text style={styles.summaryValue}>{shippingFee > 0 ? formatPrice(shippingFee) : 'Free'}</Text>
            </View>
          ) : null}
          {appliedCoupon && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelDiscount}>Coupon ({appliedCoupon.code})</Text>
              <Text style={styles.summaryValueDiscount}>-{formatPrice(appliedCoupon.discountAmount)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{formatPrice(total)}</Text>
          </View>
        </View>

        {stage === 'method' && (
          <>
            <View style={styles.couponRow}>
              <View style={styles.couponInputWrap}>
                <Tag size={15} color={colors.slate400} />
                <TextInput
                  style={styles.couponInput}
                  value={couponInput}
                  onChangeText={setCouponInput}
                  placeholder="Coupon code"
                  autoCapitalize="characters"
                  placeholderTextColor={colors.slate400}
                  editable={!appliedCoupon}
                />
                {appliedCoupon && (
                  <TouchableOpacity onPress={() => { setAppliedCoupon(null); setCouponInput(''); }}>
                    <X size={16} color={colors.slate400} />
                  </TouchableOpacity>
                )}
              </View>
              {!appliedCoupon && (
                <TouchableOpacity style={styles.couponApplyButton} onPress={handleApplyCoupon} disabled={isApplyingCoupon || !couponInput.trim()}>
                  {isApplyingCoupon ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.couponApplyText}>Apply</Text>}
                </TouchableOpacity>
              )}
            </View>
            {couponError ? <Text style={styles.error}>{couponError}</Text> : null}

            <Text style={styles.heading}>{t('mobile_payment_method')}</Text>
            {([
              ['Cash on Delivery', Banknote],
              ['MTN MoMo', Wallet],
              ...(walletEnabled && token ? [['Wallet', CreditCard] as [PaymentMethod, typeof Banknote]] : []),
            ] as [PaymentMethod, typeof Banknote][]).map(([value, Icon]) => (
              <TouchableOpacity
                key={value}
                style={[styles.methodRow, method === value && styles.methodRowActive]}
                onPress={() => setMethod(value)}
                activeOpacity={0.8}
              >
                <Icon size={20} color={method === value ? colors.accentText : colors.slate600} />
                <Text style={[styles.methodLabel, method === value && styles.methodLabelActive]}>
                  {value === 'Cash on Delivery' ? t('mobile_cash_on_delivery') : value === 'MTN MoMo' ? t('mobile_momo_pay') : t('mobile_wallet_pay')}
                  {value === 'Wallet' && walletBalance !== null ? ` (${formatPrice(walletBalance)} ${t('mobile_wallet_available_suffix')})` : ''}
                </Text>
                {method === value && <Check size={18} color={colors.accentText} />}
              </TouchableOpacity>
            ))}
            {method === 'Wallet' && walletBalance !== null && walletBalance < total && (
              <Text style={styles.error}>{t('mobile_wallet_insufficient', { balance: formatPrice(walletBalance), total: formatPrice(total) })}</Text>
            )}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <ChevronLeft size={16} color={colors.slate600} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { flex: 1, marginTop: 0 }, method === 'Wallet' && walletBalance !== null && walletBalance < total && styles.buttonDisabled]}
                onPress={handleContinueFromMethod}
                activeOpacity={0.85}
                disabled={method === 'Wallet' && walletBalance !== null && walletBalance < total}
              >
                <Text style={styles.buttonText}>{t('mobile_continue')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {stage === 'verify' && (
          <>
            <Text style={styles.heading}>{t('mobile_verify_your_email')}</Text>
            <Text style={styles.hint}>{t('mobile_verify_email_hint')}</Text>
            {!codeSent ? (
              <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('mobile_send_verification_code')}</Text>}
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.label}>{t('mobile_enter_code_sent_to', { email: addressData.email })}</Text>
                <TextInput
                  style={styles.codeInput}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                  placeholder="0000"
                  placeholderTextColor={colors.slate400}
                />
                <TouchableOpacity
                  style={[styles.button, (isSubmitting || code.length !== 4) && styles.buttonDisabled]}
                  onPress={handleVerifyCode}
                  disabled={isSubmitting || code.length !== 4}
                >
                  {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('mobile_verify')}</Text>}
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {stage === 'momoPhone' && (
          <>
            <Text style={styles.heading}>{t('mobile_momo_phone_number')}</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={momoPhone}
              onChangeText={setMomoPhone}
              placeholderTextColor={colors.slate400}
            />
            <TouchableOpacity style={[styles.button, !momoPhone.trim() && styles.buttonDisabled]} disabled={!momoPhone.trim()} onPress={handlePayWithMomo}>
              <Text style={styles.buttonText}>{t('mobile_place_order')}</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, gap: 16 },
  waitingText: { fontSize: 14, color: colors.slate600, textAlign: 'center', paddingHorizontal: 40 },
  summaryCard: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.slate100,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  summaryHeading: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  summaryItemsList: { borderBottomWidth: 1, borderBottomColor: colors.slate100, marginBottom: 10, paddingBottom: 4 },
  summaryItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  summaryItemImage: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate100 },
  summaryItemName: { fontSize: 12.5, fontWeight: '700', color: colors.slate900 },
  summaryItemVariant: { fontSize: 11, color: colors.slate600, marginTop: 1 },
  summaryItemQty: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginTop: 1 },
  summaryItemLineTotal: { fontSize: 12.5, fontWeight: '800', color: colors.slate900 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 8 },
  summaryLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.slate600 },
  summaryValue: { fontSize: 13, fontWeight: '800', color: colors.slate900 },
  summaryLabelDiscount: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.accentText },
  summaryValueDiscount: { fontSize: 13, fontWeight: '800', color: colors.accentText },
  summaryTotalRow: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.slate100 },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.slate600 },
  summaryTotalValue: { fontSize: 17, fontWeight: '900', color: colors.slate900 },
  couponRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  couponInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.slate200,
    backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 12,
  },
  couponInput: { flex: 1, paddingVertical: 12, fontSize: 13, color: colors.slate900 },
  couponApplyButton: { backgroundColor: colors.emerald800, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  couponApplyText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  heading: { fontSize: 18, fontWeight: '900', color: colors.slate900, marginBottom: 12 },
  hint: { fontSize: 13, color: colors.slate600, marginBottom: 16, lineHeight: 19 },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.slate100, padding: 16, marginBottom: 10,
  },
  methodRowActive: { borderColor: colors.emerald600, backgroundColor: colors.emerald50 },
  methodLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.slate700 },
  methodLabelActive: { color: colors.accentText },
  label: { fontSize: 13, fontWeight: '700', color: colors.slate700, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.slate900, marginBottom: 16,
  },
  codeInput: {
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14,
    paddingVertical: 16, fontSize: 24, letterSpacing: 12, textAlign: 'center', color: colors.slate900,
    fontWeight: '700', marginBottom: 16,
  },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  backButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 16,
    borderRadius: 16, borderWidth: 1.5, borderColor: colors.slate200,
  },
  backButtonText: { color: colors.slate600, fontSize: 14, fontWeight: '800' },
  button: { backgroundColor: colors.emerald800, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  error: { color: colors.rose600, fontSize: 13, marginTop: 14, textAlign: 'center' },
});

export default CheckoutPaymentScreen;
