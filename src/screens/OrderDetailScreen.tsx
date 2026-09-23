import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, SafeAreaView, Modal, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Truck, X, KeyRound } from 'lucide-react-native';
import {
  fetchMyOrder, fetchRiderLocation, fetchStoreLocation, requestReturn, acknowledgeReturnResolution,
} from '../api/customer';
import DeliveryTrackingMap from '../components/customer/DeliveryTrackingMap';
import OrderProgressStepper from '../components/customer/OrderProgressStepper';
import { Order } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { StatusBadge, Button, getStatusPalette } from '../components/admin/ui';
import type { CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderDetail'>;

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const screenWidth = Dimensions.get('window').width;

interface RiderLocationState {
  lat: number; lng: number; updatedAt: string;
  destination: { lat: number; lng: number } | null;
  riderName: string | null;
}

const OrderDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { token } = useAuth();
  const { addToCart } = useCart();
  const styles = createStyles(colors);

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [riderLocation, setRiderLocation] = useState<RiderLocationState | null>(null);
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const acknowledgedRef = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    const { order: fetched } = await fetchMyOrder(orderId, token);
    setOrder(fetched);
    if (fetched.returnRequest?.customerUnread && !acknowledgedRef.current) {
      acknowledgedRef.current = true;
      acknowledgeReturnResolution(orderId, token).catch(() => {});
    }
  }, [orderId, token]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  // Rider live location only exists while status === 'Shipped' - polls every 6s, matching the
  // website; a fix older than 30s is treated as stale/paused even if isSharing is still true.
  useEffect(() => {
    if (!token || order?.status !== 'Shipped') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchRiderLocation(orderId, token);
        if (!cancelled && data.location) {
          setRiderLocation({ lat: data.location.lat, lng: data.location.lng, updatedAt: data.location.updatedAt, destination: data.destination, riderName: data.riderName });
        }
      } catch {
        // ignore transient errors, keep polling
      }
    };
    poll();
    const interval = setInterval(poll, 6000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, order?.status, orderId]);

  // The store's own fixed location (for the static store marker + route line) - matches
  // frontend/components/RiderLocationMap.tsx reading the same two fields off footer settings.
  useEffect(() => {
    if (order?.status !== 'Shipped') return;
    fetchStoreLocation()
      .then(({ storeLat, storeLng }) => {
        if (storeLat != null && storeLng != null) setStoreLocation({ lat: storeLat, lng: storeLng });
      })
      .catch(() => {});
  }, [order?.status]);

  const isRiderLocationStale = riderLocation ? Date.now() - new Date(riderLocation.updatedAt).getTime() > 30000 : false;

  const handleSubmitReturn = async () => {
    if (!token || !returnReason.trim()) return;
    setIsSubmittingReturn(true);
    try {
      await requestReturn(orderId, returnReason.trim(), token);
      setReturnModalVisible(false);
      setReturnReason('');
      await load();
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleBuyAgain = async () => {
    if (!order) return;
    for (const item of order.items) {
      if (item.productId) {
        await addToCart(item.productId, item.quantity, item.selectedColor, item.selectedSize, item.price);
      }
    }
    navigation.navigate('Tabs', { screen: 'Cart' } as never);
  };

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  const canRequestReturn = order.status === 'Delivered' && !order.returnRequest;
  const statusPalette = getStatusPalette(colors)[order.status] ?? { bg: colors.slate100, fg: colors.slate700 };
  const statusBanner = ((): { title: string; subtitle: string } => {
    switch (order.status) {
      case 'Pending':
        return { title: 'Your order has been placed', subtitle: "We're getting it ready for processing." };
      case 'Processing':
        return { title: 'Your order is being processed', subtitle: "We're preparing your items for shipment." };
      case 'Shipped':
        return { title: 'Your order is on its way', subtitle: order.riderName ? `Being delivered by ${order.riderName}.` : 'A rider will be assigned to your delivery shortly.' };
      case 'Delivered':
        return { title: 'Your order has been delivered', subtitle: order.deliveryConfirmedAt ? `Delivered on ${formatDate(order.deliveryConfirmedAt)}.` : 'Enjoy your purchase!' };
      case 'Cancelled':
        return { title: 'This order was cancelled', subtitle: "If this wasn't expected, please contact support." };
      case 'Returned':
      default:
        return { title: 'This order was returned', subtitle: 'Your return has been processed.' };
    }
  })();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.orderNumber}>{t('mobile_order_number')} #{(order.orderNumber ?? order.id).slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.date}>{formatDate(order.date)}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>

        <View style={[styles.statusBanner, { backgroundColor: statusPalette.bg }]}>
          <Text style={[styles.statusBannerTitle, { color: statusPalette.fg }]}>{statusBanner.title}</Text>
          <Text style={styles.statusBannerSubtitle}>{statusBanner.subtitle}</Text>
        </View>

        <OrderProgressStepper status={order.status} />

        {/* Ports frontend/pages/UserDashboard.tsx: appears automatically the moment an order's
            status reaches Shipped (the backend generates a 4-digit code right then, no "get code"
            action needed) - the customer reads this aloud to the rider in person, who types it
            into their own (website-only - riders have no mobile app) dashboard to mark the order
            Delivered. Nothing to fetch specially for this: fetchMyOrder already returns
            deliveryVerificationCode on every order, it just wasn't typed/rendered here before. */}
        {order.status === 'Shipped' && order.deliveryVerificationCode && (
          <View style={styles.codeCard}>
            <View style={styles.codeIconWrap}>
              <KeyRound size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeTitle}>{t('mobile_verification_code_title')}</Text>
              <Text style={styles.codeSubtitle}>{t('mobile_verification_code_subtitle')}</Text>
              <Text style={styles.codeValue}>{order.deliveryVerificationCode}</Text>
            </View>
          </View>
        )}

        {order.status === 'Shipped' && (
          <View style={styles.mapCard}>
            <View style={styles.mapCardHeader}>
              <Truck size={16} color={colors.accentText} />
              <Text style={styles.mapCardTitle}>{t('mobile_rider_location')}</Text>
              {isRiderLocationStale && <Text style={styles.staleTag}>Paused</Text>}
            </View>
            {riderLocation ? (
              <DeliveryTrackingMap
                style={styles.map}
                riderLat={riderLocation.lat}
                riderLng={riderLocation.lng}
                isStale={isRiderLocationStale}
                destination={riderLocation.destination}
                store={storeLocation}
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPlaceholderText}>Waiting for the rider to start sharing location...</Text>
              </View>
            )}
          </View>
        )}

        {order.trackingHistory && order.trackingHistory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('mobile_tracking')}</Text>
            {order.trackingHistory.map((event, i) => (
              <View key={event.id ?? i} style={styles.timelineRow}>
                <View style={styles.timelineDotWrap}>
                  <View style={[styles.timelineDot, { backgroundColor: getStatusPalette(colors)[event.status]?.fg ?? colors.emerald600 }]} />
                  {i < order.trackingHistory!.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <Text style={styles.timelineStatus}>{event.status}</Text>
                  <Text style={styles.timelineDescription}>{event.description}</Text>
                  <Text style={styles.timelineDate}>{formatDate(event.date)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Image source={{ uri: item.images[0] }} style={styles.itemImage} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                {(item.selectedColor || item.selectedSize) && (
                  <Text style={styles.itemVariant}>{[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')}</Text>
                )}
                <Text style={styles.itemMeta}>{item.quantity} x {formatPrice(item.price)}</Text>
              </View>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('mobile_delivery_address')}</Text>
          <Text style={styles.addressText}>{order.deliveryAddress.fullName}</Text>
          <Text style={styles.addressText}>{order.deliveryAddress.phoneNumber}</Text>
          <Text style={styles.addressText}>
            {order.deliveryAddress.streetAddress}, {order.deliveryAddress.cityTown}, {order.deliveryAddress.district}
          </Text>
        </View>

        {order.returnRequest && (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>{t('mobile_request_return')}</Text>
              <StatusBadge status={order.returnRequest.status} />
            </View>
            <Text style={styles.addressText}>{order.returnRequest.reason}</Text>
            {order.returnRequest.adminNote && <Text style={styles.adminNote}>{order.returnRequest.adminNote}</Text>}
          </View>
        )}

        {canRequestReturn && (
          <Button label={t('mobile_request_return')} variant="secondary" onPress={() => setReturnModalVisible(true)} style={{ marginTop: 16 }} />
        )}
        <Button label={t('mobile_buy_again')} onPress={handleBuyAgain} style={{ marginTop: 12 }} />
      </ScrollView>

      <Modal visible={returnModalVisible} transparent animationType="fade" onRequestClose={() => setReturnModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.sectionTitle}>{t('mobile_request_return')}</Text>
              <TouchableOpacity onPress={() => setReturnModalVisible(false)}><X size={20} color={colors.slate600} /></TouchableOpacity>
            </View>
            <TextInput
              style={styles.reasonInput}
              multiline
              numberOfLines={4}
              placeholder={t('mobile_return_reason')}
              placeholderTextColor={colors.slate400}
              value={returnReason}
              onChangeText={setReturnReason}
            />
            <Button
              label={t('mobile_submit_return_request')}
              onPress={handleSubmitReturn}
              disabled={!returnReason.trim()}
              loading={isSubmittingReturn}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusBanner: { borderRadius: 16, padding: 16, marginBottom: 16 },
  statusBannerTitle: { fontSize: 14.5, fontWeight: '800' },
  statusBannerSubtitle: { fontSize: 12.5, color: colors.slate600, marginTop: 4, lineHeight: 18 },
  orderNumber: { fontSize: 16, fontWeight: '900', color: colors.slate900 },
  date: { fontSize: 12, color: colors.slate400, marginTop: 2 },
  codeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.emerald50, borderWidth: 1,
    borderColor: colors.emerald100, borderRadius: 18, padding: 16, marginBottom: 16,
  },
  codeIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.emerald700, alignItems: 'center', justifyContent: 'center' },
  codeTitle: { fontSize: 13.5, fontWeight: '800', color: colors.slate900 },
  codeSubtitle: { fontSize: 11.5, color: colors.slate600, marginTop: 2, lineHeight: 16 },
  codeValue: { fontSize: 24, fontWeight: '900', color: colors.emerald800, letterSpacing: 8, marginTop: 6 },
  mapCard: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.slate100, overflow: 'hidden', marginBottom: 16 },
  mapCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  mapCardTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, flex: 1 },
  staleTag: { fontSize: 10, fontWeight: '800', color: colors.amber800, backgroundColor: colors.amber50, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  map: { width: screenWidth - 32, height: 220 },
  mapPlaceholder: { width: screenWidth - 32, height: 140, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  mapPlaceholderText: { fontSize: 12, color: colors.slate600, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.slate100, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineDotWrap: { alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.emerald600 },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.slate100, marginTop: 2 },
  timelineStatus: { fontSize: 13, fontWeight: '800', color: colors.slate900 },
  timelineDescription: { fontSize: 12, color: colors.slate600, marginTop: 2 },
  timelineDate: { fontSize: 11, color: colors.slate400, marginTop: 4 },
  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.slate50 },
  itemImage: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.slate50 },
  itemName: { fontSize: 13, fontWeight: '700', color: colors.slate900 },
  itemVariant: { fontSize: 11, color: colors.slate600, marginTop: 2 },
  itemMeta: { fontSize: 12, color: colors.slate600, marginTop: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.slate100 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.slate600 },
  totalValue: { fontSize: 16, fontWeight: '900', color: colors.slate900 },
  addressText: { fontSize: 13, color: colors.slate700, lineHeight: 20 },
  adminNote: { fontSize: 12, color: colors.slate600, marginTop: 8, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  reasonInput: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: 12, padding: 12, fontSize: 14,
    color: colors.slate900, minHeight: 90, textAlignVertical: 'top',
  },
});

export default OrderDetailScreen;
