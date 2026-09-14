import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, SafeAreaView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell, X, ShoppingCart, User as UserIcon, Star, Mail, MapPinOff, PackageCheck, AlertTriangle, RotateCcw, CheckCheck,
  CheckSquare, Square, Trash2, ListChecks,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import {
  fetchOrders, fetchUsers, fetchProducts, fetchReturns, fetchReviews, fetchSubscribers,
  markOrderRead, markUserRead, markReviewRead, markSubscriberRead, markReturnRead,
  acknowledgeRiderStop, acknowledgeDelivery, fetchDismissedNotificationIds, dismissNotifications,
} from '../../api/admin';
import { AppColors } from '../../theme';
import SwipeableRow from './SwipeableRow';

const LOW_STOCK_THRESHOLD = 10;

type NotifType = 'order' | 'user' | 'review' | 'subscriber' | 'rider-stopped' | 'delivered' | 'low-stock' | 'return-request';

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  timestamp: string;
  unread: boolean;
  onPress: () => Promise<void> | void;
}

const ICONS: Record<NotifType, any> = {
  order: ShoppingCart, user: UserIcon, review: Star, subscriber: Mail,
  'rider-stopped': MapPinOff, delivered: PackageCheck, 'low-stock': AlertTriangle, 'return-request': RotateCcw,
};

const formatTime = (dateString: string) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

// Ports frontend/components/NotificationPanel.tsx's feed - built client-side from data already
// exposed by existing endpoints (orders/users/products/returns/reviews/subscribers), same as the
// website (there's no dedicated "notifications" table). Rendered as a modal sheet rather than the
// website's slide-out panel, since that's the natural mobile equivalent.
const NotificationBell: React.FC = () => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [visible, setVisible] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) return;
    const [ordersRes, usersRes, productsRes, returnsRes, reviewsRes, subsRes, dismissedRes] = await Promise.all([
      fetchOrders(token), fetchUsers(token), fetchProducts(), fetchReturns(token),
      fetchReviews(token).catch(() => ({ reviews: [] })),
      fetchSubscribers(token).catch(() => ({ subscribers: [] })),
      fetchDismissedNotificationIds(token).catch(() => ({ ids: [] as string[] })),
    ]);
    const dismissedIds = new Set(dismissedRes.ids);

    const list: Notif[] = [
      ...ordersRes.orders.map((order): Notif => ({
        id: `order-${order.id}`,
        type: 'order',
        title: 'New Order Received',
        body: `#${order.orderNumber || order.id} from ${order.customerName}. Total: ${formatPrice(order.total)}`,
        timestamp: formatTime(order.date),
        unread: order.unread ?? true,
        onPress: async () => { await markOrderRead(order.id, token); },
      })),
      ...usersRes.users.map((u): Notif => ({
        id: `user-${u.id}`,
        type: 'user',
        title: 'New Registration',
        body: `${u.name} just joined KuISOKO.`,
        timestamp: formatTime(u.registrationDate ?? ''),
        unread: u.unread ?? true,
        onPress: async () => { await markUserRead(u.id, token); },
      })),
      ...reviewsRes.reviews.map((r): Notif => ({
        id: `review-${r.id}`,
        type: 'review',
        title: 'New Product Review',
        body: `${r.userName} rated "${r.productName}" ${r.rating}★${r.comment ? `: "${r.comment}"` : ''}`,
        timestamp: formatTime(r.date),
        unread: r.unread,
        onPress: async () => { await markReviewRead(r.id, token); },
      })),
      ...subsRes.subscribers.map((s): Notif => ({
        id: `subscriber-${s.id}`,
        type: 'subscriber',
        title: 'New Newsletter Subscriber',
        body: `${s.email} joined the inner circle.`,
        timestamp: formatTime(s.subscribedAt),
        unread: s.unread,
        onPress: async () => { await markSubscriberRead(s.id, token); },
      })),
      ...ordersRes.orders.filter((o) => o.riderStopAlertAt).map((o): Notif => ({
        id: `rider-stop-${o.id}`,
        type: 'rider-stopped',
        title: o.riderName ? `${o.riderName} Stopped Sharing Location` : 'Rider Stopped Sharing Location',
        body: `${o.riderName ?? 'The rider'} stopped sharing their location for #${o.orderNumber ?? o.id} before it was delivered.`,
        timestamp: formatTime(o.riderStopAlertAt!),
        unread: o.riderStopAlertUnread ?? false,
        onPress: async () => { await acknowledgeRiderStop(o.id, token); },
      })),
      ...ordersRes.orders.filter((o) => o.deliveryConfirmedAt).map((o): Notif => ({
        id: `delivered-${o.id}`,
        type: 'delivered',
        title: 'Order Delivered',
        body: `#${o.orderNumber ?? o.id} for ${o.customerName} was delivered by ${o.riderName ?? 'the rider'}. Total: ${formatPrice(o.total)}.`,
        timestamp: formatTime(o.deliveryConfirmedAt!),
        unread: o.deliveryConfirmedUnread ?? false,
        onPress: async () => { await acknowledgeDelivery(o.id, token); },
      })),
      ...productsRes.products.filter((p) => p.stock < LOW_STOCK_THRESHOLD).map((p): Notif => ({
        id: `low-stock-${p.id}`,
        type: 'low-stock',
        title: p.stock <= 0 ? 'Out of Stock' : 'Low Stock',
        body: p.stock <= 0 ? `"${p.name}" is out of stock.` : `"${p.name}" has only ${p.stock} left in stock.`,
        timestamp: '',
        unread: true,
        onPress: () => {},
      })),
      ...returnsRes.returnRequests.map((rr): Notif => ({
        id: `return-request-${rr.id}`,
        type: 'return-request',
        title: rr.status === 'pending' ? 'New Return Request' : `Return Request ${rr.status === 'approved' ? 'Approved' : 'Rejected'}`,
        body: `${rr.customerName} on #${rr.orderNumber}: "${rr.reason}"`,
        timestamp: formatTime(rr.requestedAt),
        unread: rr.unread,
        onPress: async () => { await markReturnRead(rr.id, token); },
      })),
    ]
      .filter((n) => !dismissedIds.has(n.id))
      .sort((a, b) => (a.unread === b.unread ? 0 : a.unread ? -1 : 1));

    setNotifications(list);
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openPanel = async () => {
    setVisible(true);
    setIsLoading(true);
    await load();
    setIsLoading(false);
  };

  const handlePressItem = async (n: Notif) => {
    await n.onPress();
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
  };

  // Ports frontend/components/NotificationPanel.tsx's hideNotification/bulkHideNotifications:
  // dismissal is persisted server-side (POST /notifications/dismissed) against the same composite
  // ids the website builds ("order-<id>", "user-<id>", ...), so a notification dismissed here also
  // disappears from the website's panel and vice versa.
  const handleDismissOne = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (token) await dismissNotifications([id], token).catch(() => {});
  };

  const closeSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      'Delete notifications',
      `Delete ${ids.length} selected notification${ids.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
            closeSelectionMode();
            if (token) await dismissNotifications(ids, token).catch(() => {});
          },
        },
      ]
    );
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <>
      <TouchableOpacity style={styles.bellButton} onPress={openPanel}>
        <Bell size={20} color={colors.slate700} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => { setVisible(false); closeSelectionMode(); }} style={styles.closeButton}>
              <X size={20} color={colors.slate700} />
            </TouchableOpacity>
          </View>

          {notifications.length > 0 && (
            <View style={styles.actionRow}>
              {isSelectionMode ? (
                <>
                  <TouchableOpacity style={styles.actionLink} onPress={closeSelectionMode}>
                    <Text style={styles.actionLinkText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionLink, selectedIds.size === 0 && { opacity: 0.4 }]}
                    onPress={handleDeleteSelected}
                    disabled={selectedIds.size === 0}
                  >
                    <Trash2 size={14} color={colors.rose600} />
                    <Text style={[styles.actionLinkText, { color: colors.rose600 }]}>Delete ({selectedIds.size})</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.actionLink} onPress={() => setIsSelectionMode(true)}>
                  <ListChecks size={14} color={colors.accentText} />
                  <Text style={[styles.actionLinkText, { color: colors.accentText }]}>Select</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <FlatList
            data={notifications}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ padding: 16 }}
            refreshing={isLoading}
            onRefresh={load}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <CheckCheck size={32} color={colors.slate400} />
                <Text style={styles.emptyText}>You're all caught up</Text>
              </View>
            }
            renderItem={({ item }) => {
              const Icon = ICONS[item.type];
              const isSelected = selectedIds.has(item.id);
              const rowContent = (
                <TouchableOpacity
                  style={[styles.notifRow, item.unread && styles.notifRowUnread]}
                  onPress={() => (isSelectionMode ? toggleSelected(item.id) : handlePressItem(item))}
                  activeOpacity={0.7}
                >
                  {isSelectionMode && (
                    isSelected
                      ? <CheckSquare size={20} color={colors.accentText} style={{ marginRight: 2 }} />
                      : <Square size={20} color={colors.slate200} style={{ marginRight: 2 }} />
                  )}
                  <View style={styles.notifIconWrap}>
                    <Icon size={16} color={colors.accentText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                    {item.timestamp ? <Text style={styles.notifTime}>{item.timestamp}</Text> : null}
                  </View>
                  {item.unread && !isSelectionMode && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
              if (isSelectionMode) return <View style={{ marginBottom: 10 }}>{rowContent}</View>;
              return (
                <SwipeableRow onDelete={() => handleDismissOne(item.id)}>
                  {rowContent}
                </SwipeableRow>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  bellButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.rose500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.slate100, backgroundColor: colors.white },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.slate900 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  actionLinkText: { fontSize: 12, fontWeight: '800', color: colors.slate700 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  emptyText: { color: colors.slate400, fontSize: 13, fontWeight: '600' },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate100, padding: 14 },
  notifRowUnread: { borderColor: colors.emerald100 },
  notifIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900 },
  notifBody: { fontSize: 12, color: colors.slate600, marginTop: 2 },
  notifTime: { fontSize: 10.5, color: colors.slate400, marginTop: 4, fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange500, alignSelf: 'flex-start', marginTop: 4 },
});

export default NotificationBell;
