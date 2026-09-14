import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ClipboardList, Truck, MapPin, Package, FileText, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useAdminNotifications } from '../../context/AdminNotificationsContext';
import { fetchOrder, updateOrderStatus, confirmOrderPayment, assignOrderRider, deleteOrder, fetchUsers, sendInvoice, markOrderRead } from '../../api/admin';
import { buildInvoiceHtml } from '../../utils/invoice';
import { Order, OrderStatus, User } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, SectionTitle, FieldLabel, StatusBadge, Button } from '../../components/admin/ui';
import type { AdminOrdersStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminOrdersStackParamList, 'OrderDetail'>;

// The store deals exclusively in RWF - order.currency is a nullable free-text DB column that's
// almost never actually set at order-creation time, so a default parameter can't rescue it (only
// `undefined` falls through to a default, and this column comes back as an explicit `null`). That
// mismatch was rendering literal "null 12,000" instead of "RWF 12,000" on this screen.
const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const statuses: OrderStatus[] = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

const AdminOrderDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const { token, user: currentUser } = useAuth();
  const { colors } = useAppTheme();
  const { refresh: refreshAdminNotifications } = useAdminNotifications();
  const styles = createStyles(colors);
  const [order, setOrder] = useState<Order | null>(null);
  const [riders, setRiders] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  // Ports frontend/pages/AdminManageOrders.tsx's handleViewDetails: opening an order always marks
  // it read (clears the bell), and a still-Pending order is bumped to Processing - it's that status
  // change, not the read flag, that decrements the Orders tab's badge (which counts Pending orders).
  const load = useCallback(async () => {
    if (!token) return;
    const [{ order: o }, { users }] = await Promise.all([fetchOrder(orderId, token), fetchUsers(token)]);
    setRiders(users.filter((u) => u.role === 'rider'));
    markOrderRead(orderId, token).catch(() => {});
    if (o.status === 'Pending') {
      const { order: updated } = await updateOrderStatus(orderId, 'Processing', token);
      setOrder(updated);
    } else {
      setOrder(o);
    }
    refreshAdminNotifications();
  }, [orderId, token, refreshAdminNotifications]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (status: OrderStatus) => {
    if (!token || !order || status === order.status) return;
    setIsSaving(true);
    try {
      const { order: updated } = await updateOrderStatus(order.id, status, token);
      setOrder(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update status.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!token || !order) return;
    setIsSaving(true);
    try {
      const { order: updated } = await confirmOrderPayment(order.id, token);
      setOrder(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not confirm payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignRider = async (riderId: string | null) => {
    if (!token || !order) return;
    setIsSaving(true);
    try {
      const { order: updated } = await assignOrderRider(order.id, riderId, token);
      setOrder(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not assign rider.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsGeneratingInvoice(true);
    try {
      const html = await buildInvoiceHtml(order, currentUser?.name ?? 'Admin', currentUser?.email ?? 'admin@example.com');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice-${order.orderNumber ?? order.id}` });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not generate invoice.');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!token || !order) return;
    setIsSendingInvoice(true);
    try {
      const html = await buildInvoiceHtml(order, currentUser?.name ?? 'Admin', currentUser?.email ?? 'admin@example.com');
      const { base64 } = await Print.printToFileAsync({ html, base64: true });
      if (!base64) throw new Error('Could not generate invoice PDF.');
      await sendInvoice(order.id, base64, token);
      Alert.alert('Sent', `Invoice emailed to ${order.deliveryAddress.email}.`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send invoice.');
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete order', 'This cannot be undone. Delete this order permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!token || !order) return;
          await deleteOrder(order.id, token);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!order) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  const itemsSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Summary card: everything an admin needs at a glance (order id, when, status, total,
          payment) without scrolling - mirrors how the website's order modal opens with this same
          info before the editable sections below it. */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber} numberOfLines={1}>#{order.orderNumber ?? order.id.slice(0, 8)}</Text>
            <Text style={styles.orderDate}>{new Date(order.date).toLocaleString()}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatLabel}>Total</Text>
            <Text style={styles.summaryStatValue}>{formatPrice(order.total)}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatLabel}>Payment</Text>
            <StatusBadge status={order.paymentStatus ?? 'unpaid'} />
          </View>
          <View style={[styles.summaryStat, { alignItems: 'flex-end' }]}>
            <Text style={styles.summaryStatLabel}>Items</Text>
            <Text style={styles.summaryStatValue}>{order.items.length}</Text>
          </View>
        </View>
        {order.paymentStatus !== 'paid' && (
          <Button label="Confirm Payment Received" variant="secondary" onPress={handleConfirmPayment} loading={isSaving} style={{ marginTop: 14 }} />
        )}
      </Card>

      <SectionTitle icon={ClipboardList} style={{ marginTop: 20 }}>Order Status</SectionTitle>
      <Card>
        <FieldLabel>Current status</FieldLabel>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={order.status} onValueChange={handleStatusChange} enabled={!isSaving} mode="dropdown">
            {statuses.map((s) => <Picker.Item key={s} label={s} value={s} />)}
          </Picker>
        </View>
      </Card>

      <SectionTitle icon={Truck} style={{ marginTop: 20 }}>Assign Rider</SectionTitle>
      <Card>
        <FieldLabel>Delivery rider</FieldLabel>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={order.riderId ?? ''} onValueChange={(v) => handleAssignRider(v || null)} enabled={!isSaving} mode="dropdown">
            <Picker.Item label="Unassigned" value="" />
            {riders.map((r) => <Picker.Item key={r.id} label={r.name} value={r.id} />)}
          </Picker>
        </View>
      </Card>

      <SectionTitle icon={MapPin} style={{ marginTop: 20 }}>Customer & Delivery</SectionTitle>
      <Card>
        <Text style={styles.fieldValue}>{order.deliveryAddress.fullName}</Text>
        <Text style={styles.fieldSub}>{order.deliveryAddress.phoneNumber}</Text>
        <Text style={styles.fieldSub}>{order.deliveryAddress.email}</Text>
        <View style={styles.addressDivider} />
        <Text style={styles.fieldSub}>
          {[order.deliveryAddress.streetAddress, order.deliveryAddress.cityTown, order.deliveryAddress.district].filter(Boolean).join(', ')}
        </Text>
      </Card>

      <SectionTitle icon={Package} style={{ marginTop: 20 }}>Order Items ({order.items.length})</SectionTitle>
      <Card>
        {order.items.map((item, i) => (
          <View key={item.id} style={[styles.itemRow, i === order.items.length - 1 && { borderBottomWidth: 0 }]}>
            <Image source={{ uri: item.images[0] }} style={styles.itemImage} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              {(item.selectedColor || item.selectedSize) && (
                <Text style={styles.fieldSub}>{[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')}</Text>
              )}
              <Text style={styles.fieldSub}>Qty {item.quantity} × {formatPrice(item.price)}</Text>
            </View>
            <Text style={styles.itemLineTotal}>{formatPrice(item.price * item.quantity)}</Text>
          </View>
        ))}
        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Subtotal</Text>
            <Text style={styles.breakdownValue}>{formatPrice(order.subtotal ?? itemsSubtotal)}</Text>
          </View>
          {!!order.discountAmount && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</Text>
              <Text style={[styles.breakdownValue, { color: colors.rose600 }]}>-{formatPrice(order.discountAmount)}</Text>
            </View>
          )}
          {order.shippingFee != null && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Shipping</Text>
              <Text style={styles.breakdownValue}>{formatPrice(order.shippingFee)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
        </View>
      </Card>

      {order.trackingHistory && order.trackingHistory.length > 0 && (
        <>
          <SectionTitle icon={Truck} style={{ marginTop: 20 }}>Tracking History</SectionTitle>
          <Card>
            {order.trackingHistory.map((t, i) => (
              <View key={t.id ?? i} style={[styles.itemRow, i === order.trackingHistory!.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{t.status}</Text>
                  <Text style={styles.fieldSub}>{t.description}</Text>
                  <Text style={styles.fieldSub}>{new Date(t.date).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionTitle icon={FileText} style={{ marginTop: 20 }}>Invoice</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Download" variant="secondary" onPress={handleDownloadInvoice} loading={isGeneratingInvoice} style={{ flex: 1 }} />
        <Button label="Send to Customer" onPress={handleSendInvoice} loading={isSendingInvoice} style={{ flex: 1 }} />
      </View>

      <TouchableOpacity style={styles.deleteRow} onPress={handleDelete} activeOpacity={0.7}>
        <Trash2 size={15} color={colors.rose600} />
        <Text style={styles.deleteText}>Delete Order</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  summaryCard: { backgroundColor: colors.white },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  orderNumber: { fontSize: 19, fontWeight: '900', color: colors.slate900 },
  orderDate: { fontSize: 12, color: colors.slate600, marginTop: 3, fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: colors.slate100, marginVertical: 14 },
  summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryStat: { flex: 1, gap: 6 },
  summaryStatLabel: { fontSize: 10.5, fontWeight: '800', color: colors.slate400, textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryStatValue: { fontSize: 17, fontWeight: '900', color: colors.accentText },
  pickerWrap: { marginHorizontal: -8, marginBottom: -8 },
  fieldValue: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  fieldSub: { fontSize: 12.5, color: colors.slate600, marginTop: 2 },
  addressDivider: { height: 1, backgroundColor: colors.slate100, marginVertical: 10 },
  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.slate100, alignItems: 'center' },
  itemImage: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.slate50 },
  itemName: { fontSize: 13, fontWeight: '700', color: colors.slate900 },
  itemLineTotal: { fontSize: 13, fontWeight: '800', color: colors.slate900 },
  breakdown: { paddingTop: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  breakdownLabel: { fontSize: 12.5, color: colors.slate600, fontWeight: '600' },
  breakdownValue: { fontSize: 12.5, color: colors.slate700, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.slate100 },
  totalLabel: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  totalValue: { fontSize: 16, fontWeight: '900', color: colors.accentText },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.rose50 },
  deleteText: { color: colors.rose600, fontSize: 14, fontWeight: '800' },
});

export default AdminOrderDetailScreen;
