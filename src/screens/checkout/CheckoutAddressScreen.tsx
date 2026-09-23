import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Truck, User, MapPin, ShoppingBag } from 'lucide-react-native';
import { apiFetch } from '../../api/client';
import { calculateShipping, fetchAddresses } from '../../api/customer';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useGuestMode } from '../../context/GuestModeContext';
import { useCart } from '../../context/CartContext';
import { DeliveryAddress, Product } from '../../types';
import CheckoutStepper from '../../components/customer/CheckoutStepper';
import type { CustomerStackParamList } from '../../navigation/CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CheckoutAddress'>;

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

const CheckoutAddressScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const { requestSignIn } = useGuestMode();
  const { items } = useCart();
  const directBuyItem = route.params?.directBuyItem;
  const styles = createStyles(colors);
  // Ports frontend/pages/CartCheckout.tsx's `showContactCard` gate: a signed-out visitor tapping
  // "Proceed to Checkout" (or "Buy Now") sees a Sign In / Continue as Guest choice before the
  // address form, exactly like the website - browsing the storefront itself stays gate-free
  // (GuestModeContext defaults to the Welcome screen only at first launch, not here).
  const [guestGateDismissed, setGuestGateDismissed] = useState(false);

  const [form, setForm] = useState<DeliveryAddress>({
    fullName: user?.name ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    email: user?.email ?? '',
    country: 'Rwanda',
    cityTown: '',
    district: '',
    streetAddress: '',
    houseBuildingNumber: '',
    additionalInfo: '',
  });
  // Ports frontend/components/AddressForm.tsx's autofill effect: pre-fill from the customer's
  // default Address Book entry the moment this screen mounts, but only into fields still empty -
  // never overwrite something the shopper already typed. Guests (no token) get the blank form
  // exactly as before.
  const hasAutofilledRef = useRef(false);
  useEffect(() => {
    if (!token || hasAutofilledRef.current) return;
    (async () => {
      try {
        const { addresses } = await fetchAddresses(token);
        const defaultAddress = addresses.find((a) => a.isDefault);
        if (!defaultAddress || hasAutofilledRef.current) return;
        hasAutofilledRef.current = true;
        setForm((prev) => ({
          ...prev,
          phoneNumber: prev.phoneNumber || defaultAddress.phoneNumber,
          country: prev.country || defaultAddress.country,
          cityTown: prev.cityTown || defaultAddress.cityTown,
          district: prev.district || defaultAddress.district,
          streetAddress: prev.streetAddress || defaultAddress.streetAddress,
          houseBuildingNumber: prev.houseBuildingNumber || defaultAddress.houseBuildingNumber || '',
          additionalInfo: prev.additionalInfo || defaultAddress.additionalInfo || '',
        }));
      } catch {
        // no saved address, or fetch failed - leave the form blank, same as before this feature
      }
    })();
  }, [token]);

  const [subtotal, setSubtotal] = useState(0);
  const [shipping, setShipping] = useState<{ fee: number; zoneName: string; isFreeShipping: boolean } | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ports frontend/pages/ProductDetail.tsx's Buy Now: it bypasses the cart entirely and checks
  // out a single item directly (CartCheckout.tsx reads `directBuyProduct` from router state
  // instead of the cart) - directBuyItem plays the same role here, carried through route params
  // since there's no navigation "location.state" equivalent in React Navigation.
  useEffect(() => {
    if (directBuyItem) {
      setSubtotal(directBuyItem.price * directBuyItem.quantity);
      return;
    }
    apiFetch<{ products: Product[] }>('/products').then(({ products }) => {
      const total = items.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.productId);
        const price = line.unitPrice ?? product?.price ?? 0;
        return sum + price * line.quantity;
      }, 0);
      setSubtotal(total);
    });
  }, [items, directBuyItem]);

  // Ports frontend/pages/CartCheckout.tsx: shipping is calculated live the moment a district is
  // picked (debounced here since this is free text, not a dropdown) - matches POST
  // /shipping/calculate's {district, subtotal} -> {fee, zoneName, isFreeShipping} shape exactly.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!form.district.trim() || subtotal <= 0) {
      setShipping(null);
      return;
    }
    setIsCalculatingShipping(true);
    debounceRef.current = setTimeout(() => {
      calculateShipping(form.district.trim(), subtotal)
        .then(setShipping)
        .catch(() => setShipping(null))
        .finally(() => setIsCalculatingShipping(false));
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.district, subtotal]);

  const set = (key: keyof DeliveryAddress) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const isValid =
    form.fullName.trim() && form.phoneNumber.trim() && form.email.trim() &&
    form.country.trim() && form.cityTown.trim() && form.district.trim() && form.streetAddress.trim();

  const contactFields: { key: keyof DeliveryAddress; label: string; keyboardType?: 'phone-pad' | 'email-address'; required?: boolean }[] = [
    { key: 'fullName', label: t('mobile_full_name'), required: true },
    { key: 'phoneNumber', label: t('mobile_phone_number'), keyboardType: 'phone-pad', required: true },
    { key: 'email', label: t('mobile_email'), keyboardType: 'email-address', required: true },
  ];
  const addressFields: { key: keyof DeliveryAddress; label: string; required?: boolean }[] = [
    { key: 'country', label: t('mobile_country'), required: true },
    { key: 'cityTown', label: t('mobile_city_town'), required: true },
    { key: 'district', label: t('mobile_district'), required: true },
    { key: 'streetAddress', label: t('mobile_street_address'), required: true },
    { key: 'houseBuildingNumber', label: t('mobile_house_number') },
    { key: 'additionalInfo', label: t('mobile_additional_info') },
  ];
  const itemCount = directBuyItem ? directBuyItem.quantity : items.reduce((sum, line) => sum + line.quantity, 0);

  if (!user && !guestGateDismissed) {
    return (
      <SafeAreaView style={styles.container}>
        <CheckoutStepper currentStep={2} />
        <View style={styles.guestGateWrap}>
          <View style={styles.guestGateCard}>
            <Text style={styles.guestGateHeading}>{t('mobile_sign_in_to_checkout')}</Text>
            <TouchableOpacity style={styles.guestGateSignInButton} onPress={requestSignIn} activeOpacity={0.85}>
              <Text style={styles.guestGateSignInText}>{t('mobile_sign_in')}</Text>
            </TouchableOpacity>
            <View style={styles.guestGateDivider}>
              <View style={styles.guestGateDividerLine} />
              <Text style={styles.guestGateDividerText}>{t('mobile_or')}</Text>
              <View style={styles.guestGateDividerLine} />
            </View>
            <TouchableOpacity style={styles.guestGateGuestButton} onPress={() => setGuestGateDismissed(true)} activeOpacity={0.85}>
              <Text style={styles.guestGateGuestText}>{t('mobile_continue_as_guest')}</Text>
            </TouchableOpacity>
            <Text style={styles.guestGateHint}>💡 {t('mobile_guest_checkout_hint')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CheckoutStepper currentStep={2} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.summaryBar}>
            <ShoppingBag size={15} color={colors.accentText} />
            <Text style={styles.summaryBarText}>{itemCount} {itemCount === 1 ? 'item' : 'items'} · Subtotal {formatPrice(subtotal)}</Text>
          </View>

          <View style={styles.sectionHeader}>
            <User size={15} color={colors.slate400} />
            <Text style={styles.sectionHeaderText}>{t('mobile_contact_info')}</Text>
          </View>
          <View style={styles.card}>
            {contactFields.map((field, i) => (
              <View key={field.key} style={[styles.fieldWrap, i === contactFields.length - 1 && { marginBottom: 0 }]}>
                <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
                <TextInput
                  style={styles.input}
                  value={form[field.key] as string}
                  onChangeText={set(field.key)}
                  keyboardType={field.keyboardType}
                  autoCapitalize={field.keyboardType === 'email-address' ? 'none' : 'words'}
                  placeholderTextColor={colors.slate400}
                />
              </View>
            ))}
          </View>

          <View style={[styles.sectionHeader, { marginTop: 20 }]}>
            <MapPin size={15} color={colors.slate400} />
            <Text style={styles.sectionHeaderText}>{t('mobile_delivery_address')}</Text>
          </View>
          <View style={styles.card}>
            {addressFields.map((field, i) => (
              <View key={field.key}>
                <View style={[styles.fieldWrap, i === addressFields.length - 1 && { marginBottom: 0 }]}>
                  <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[field.key] as string}
                    onChangeText={set(field.key)}
                    autoCapitalize="words"
                    placeholderTextColor={colors.slate400}
                  />
                </View>
                {field.key === 'district' && (isCalculatingShipping || shipping) && (
                  <View style={styles.shippingCard}>
                    <Truck size={16} color={colors.accentText} />
                    {isCalculatingShipping ? (
                      <ActivityIndicator size="small" color={colors.accentText} />
                    ) : shipping ? (
                      <Text style={styles.shippingText}>
                        {shipping.zoneName}: {shipping.isFreeShipping ? 'Free shipping' : formatPrice(shipping.fee)}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            disabled={!isValid}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CheckoutPayment', { addressData: form, shippingFee: shipping?.fee ?? 0, shippingZoneName: shipping?.zoneName, directBuyItem })}
          >
            <Text style={styles.buttonText}>{t('mobile_continue')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  guestGateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  guestGateCard: {
    width: '100%', backgroundColor: colors.emerald50, borderWidth: 1, borderColor: colors.emerald100,
    borderRadius: 20, padding: 24, alignItems: 'stretch',
  },
  guestGateHeading: { fontSize: 17, fontWeight: '900', color: colors.slate900, textAlign: 'center', marginBottom: 20 },
  guestGateSignInButton: {
    borderWidth: 1.5, borderColor: colors.emerald800, backgroundColor: colors.white, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  guestGateSignInText: { color: colors.emerald800, fontSize: 14.5, fontWeight: '800' },
  guestGateDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  guestGateDividerLine: { flex: 1, height: 1, backgroundColor: colors.emerald100 },
  guestGateDividerText: { fontSize: 12, fontWeight: '800', color: colors.slate400 },
  guestGateGuestButton: {
    borderWidth: 2, borderColor: colors.emerald800, backgroundColor: colors.white, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  guestGateGuestText: { color: colors.slate900, fontSize: 15, fontWeight: '800' },
  guestGateHint: { fontSize: 11.5, color: colors.slate600, textAlign: 'center', marginTop: 14 },
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.emerald50, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20,
  },
  summaryBarText: { fontSize: 12.5, fontWeight: '700', color: colors.accentText },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionHeaderText: { fontSize: 12.5, fontWeight: '800', color: colors.slate600, textTransform: 'uppercase', letterSpacing: 0.4 },
  card: {
    backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.slate100, padding: 16,
  },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: colors.slate700, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.slate900,
  },
  shippingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.emerald50, borderRadius: 12,
    padding: 12, marginBottom: 14,
  },
  shippingText: { fontSize: 13, fontWeight: '700', color: colors.accentText, flex: 1 },
  button: { backgroundColor: colors.emerald800, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});

export default CheckoutAddressScreen;
