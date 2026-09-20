import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, TextInput, Linking, AppState, Alert } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Phone, LocateFixed, Navigation, KeyRound, CheckCircle2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePolling } from '../../hooks/usePolling';
import { ApiError } from '../../api/client';
import {
  fetchMyDeliveries, acceptDelivery, verifyDelivery, postRiderLocation, notifyRiderStoppedSharing,
  fetchReassignedNotices, RiderOrder,
} from '../../api/rider';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { EmptyState } from '../../components/admin/ui';

// Ports frontend/pages/RiderDashboard.tsx's active-deliveries tab. The website drives location
// sharing off the browser tab being open/visible; here it's the app being foregrounded (see the
// AppState listener below) - same "only while actually watching this screen" intent.
const LOCATION_POST_THROTTLE_MS = 5000;

const RiderActiveScreen: React.FC = () => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentAtRef = useRef(0);
  const shownReassignmentIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { orders: fetched } = await fetchMyDeliveries(token);
      setOrders(fetched);
    } catch (e) {
      console.error('Could not load assigned deliveries:', e);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  // Keeps the assigned-deliveries list fresh on its own, so an order the admin reassigns away
  // from this rider disappears (and the notice below fires) without a manual pull-to-refresh.
  usePolling(load, 15000);

  usePolling(useCallback(async () => {
    if (!token) return;
    try {
      const { notices } = await fetchReassignedNotices(token);
      for (const notice of notices) {
        if (shownReassignmentIdsRef.current.has(notice.id)) continue;
        shownReassignmentIdsRef.current.add(notice.id);
        // A real toast component doesn't exist on this screen's stack; a transient message
        // stitched into the load error slot would be misleading, so this uses the platform's
        // own alert - infrequent enough (only on an actual reassignment) not to feel heavy-handed.
        Alert.alert(t('mobile_rider_reassigned_title'), t('mobile_rider_reassigned_body', {
          orderNumber: notice.orderNumber,
          name: notice.newRiderName || t('mobile_rider_another_rider'),
        }));
      }
    } catch (e) {
      console.error('Could not check reassignment notices:', e);
    }
  }, [token, t]), 15000);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const stopSharing = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
      if (token) notifyRiderStoppedSharing(token).catch((e) => console.error('Could not notify stop-sharing:', e));
    }
    setIsSharing(false);
  }, [token]);

  const startSharing = useCallback(async () => {
    setLocationError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError(t('mobile_rider_location_permission_denied'));
      return;
    }
    if (!token) return;
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
      (position) => {
        const now = Date.now();
        if (now - lastSentAtRef.current < LOCATION_POST_THROTTLE_MS) return;
        lastSentAtRef.current = now;
        postRiderLocation(position.coords.latitude, position.coords.longitude, token)
          .catch((e) => console.error('Could not send location:', e));
      }
    );
    setIsSharing(true);
  }, [token, t]);

  const toggleSharing = () => (isSharing ? stopSharing() : startSharing());

  // Foreground-only tracking (no background location permission requested) - pausing when the
  // app leaves the foreground mirrors the website pausing when its tab loses visibility, and
  // avoids ever running location collection the rider can't see is happening.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && watchRef.current) stopSharing();
    });
    return () => {
      subscription.remove();
      if (watchRef.current) stopSharing();
    };
  }, [stopSharing]);

  const handleAccept = async (orderId: string) => {
    if (!token) return;
    setAcceptingId(orderId);
    try {
      await acceptDelivery(orderId, token);
      await load();
    } catch (e) {
      Alert.alert(t('mobile_rider_accept_failed_title'), e instanceof ApiError ? e.message : t('mobile_rider_accept_failed_body'));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleVerifyDelivery = async (orderId: string) => {
    if (!verifyCode.trim() || !token) return;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      await verifyDelivery(orderId, verifyCode.trim(), token);
      setVerifyCode('');
      stopSharing();
      await load();
    } catch (e) {
      setVerifyError(e instanceof ApiError ? e.message : t('mobile_rider_verify_failed'));
    } finally {
      setIsVerifying(false);
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  };

  const currentOrder = orders.find((o) => o.acceptedAt) ?? null;
  const queuedOrders = orders.filter((o) => o.id !== currentOrder?.id);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  if (currentOrder) {
    return (
      <SafeAreaView style={styles.container}>
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald800} />}
          data={queuedOrders}
          keyExtractor={(o) => o.id}
          ListHeaderComponent={
            <>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{t('mobile_rider_share_location_title')}</Text>
                    <Text style={styles.subtitle}>{t('mobile_rider_share_location_subtitle')}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.shareButton, isSharing ? styles.shareButtonActive : styles.shareButtonInactive]}
                    onPress={toggleSharing}
                  >
                    <LocateFixed size={16} color={colors.white} />
                    <Text style={styles.shareButtonText}>{isSharing ? t('mobile_rider_stop_sharing') : t('mobile_rider_start_sharing')}</Text>
                  </TouchableOpacity>
                </View>
                {locationError && <Text style={styles.errorText}>{locationError}</Text>}
              </View>

              <Text style={styles.sectionTitle}>{t('mobile_rider_current_delivery')}</Text>
              <View style={styles.card}>
                <Text style={styles.title}>#{currentOrder.orderNumber} — {currentOrder.customerName}</Text>
                <View style={styles.addressRow}>
                  <MapPin size={15} color={colors.textSecondary} style={{ marginTop: 2 }} />
                  <Text style={styles.address}>
                    {currentOrder.deliveryStreetAddress}, {currentOrder.deliveryCityTown}, {currentOrder.deliveryDistrict}
                    {currentOrder.deliveryAdditionalInfo ? ` — ${currentOrder.deliveryAdditionalInfo}` : ''}
                  </Text>
                </View>
                <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${currentOrder.deliveryPhoneNumber}`)}>
                  <Phone size={15} color={colors.accentText} />
                  <Text style={styles.phoneText}>{currentOrder.deliveryPhoneNumber}</Text>
                </TouchableOpacity>

                {currentOrder.destination && (
                  <TouchableOpacity
                    style={styles.mapsButton}
                    onPress={() => openInMaps(currentOrder.destination!.lat, currentOrder.destination!.lng)}
                  >
                    <Navigation size={16} color={colors.white} />
                    <Text style={styles.mapsButtonText}>{t('mobile_rider_open_in_maps')}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.verifyBlock}>
                  <View style={styles.verifyLabelRow}>
                    <KeyRound size={13} color={colors.textSecondary} />
                    <Text style={styles.verifyLabel}>{t('mobile_rider_verify_code_label')}</Text>
                  </View>
                  <View style={styles.verifyInputRow}>
                    <TextInput
                      value={verifyCode}
                      onChangeText={(v) => { setVerifyCode(v); setVerifyError(null); }}
                      placeholder={t('mobile_rider_verify_code_placeholder')}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      style={styles.verifyInput}
                    />
                    <TouchableOpacity
                      style={[styles.verifyButton, (!verifyCode.trim() || isVerifying) && styles.verifyButtonDisabled]}
                      disabled={!verifyCode.trim() || isVerifying}
                      onPress={() => handleVerifyDelivery(currentOrder.id)}
                    >
                      <CheckCircle2 size={16} color={colors.white} />
                      <Text style={styles.verifyButtonText}>{t('mobile_rider_verify_code_button')}</Text>
                    </TouchableOpacity>
                  </View>
                  {verifyError && <Text style={styles.errorText}>{verifyError}</Text>}
                </View>
              </View>

              {queuedOrders.length > 0 && <Text style={styles.sectionTitle}>{t('mobile_rider_up_next')}</Text>}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.queuedCard}>
              <Text style={styles.queuedText}>#{item.orderNumber} — {item.customerName}</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald800} />}
        data={orders}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={<Text style={styles.sectionTitle}>{t('mobile_rider_active_deliveries')}</Text>}
        ListEmptyComponent={<EmptyState label={t('mobile_rider_no_deliveries')} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>#{item.orderNumber} — {item.customerName}</Text>
            <View style={styles.addressRow}>
              <MapPin size={15} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <Text style={styles.address}>
                {item.deliveryStreetAddress}, {item.deliveryCityTown}, {item.deliveryDistrict}
                {item.deliveryAdditionalInfo ? ` — ${item.deliveryAdditionalInfo}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${item.deliveryPhoneNumber}`)}>
              <Phone size={15} color={colors.accentText} />
              <Text style={styles.phoneText}>{item.deliveryPhoneNumber}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptButton, acceptingId === item.id && styles.acceptButtonDisabled]}
              disabled={acceptingId === item.id}
              onPress={() => handleAccept(item.id)}
            >
              <Text style={styles.acceptButtonText}>{t('mobile_rider_accept_delivery')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  queuedCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  queuedText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  shareButtonActive: { backgroundColor: colors.rose600 },
  shareButtonInactive: { backgroundColor: colors.emerald700 },
  shareButtonText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  errorText: { fontSize: 12, color: colors.rose600, marginTop: 10 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  address: { flex: 1, fontSize: 13, color: colors.textSecondary },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  phoneText: { fontSize: 13, color: colors.accentText, fontWeight: '700' },
  mapsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.emerald700, borderRadius: 12, paddingVertical: 11, marginTop: 12 },
  mapsButtonText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  verifyBlock: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  verifyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  verifyLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  verifyInputRow: { flexDirection: 'row', gap: 8 },
  verifyInput: { flex: 1, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: colors.textPrimary },
  verifyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.emerald700, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  verifyButtonDisabled: { opacity: 0.5 },
  verifyButtonText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  acceptButton: { backgroundColor: colors.emerald700, borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  acceptButtonDisabled: { opacity: 0.5 },
  acceptButtonText: { color: colors.white, fontWeight: '800', fontSize: 13 },
});

export default RiderActiveScreen;
