import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchReturns, markReturnRead, approveReturn, rejectReturn } from '../../api/admin';
import { ReturnRequest } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, SectionTitle, StatusBadge, Button, TextField, FieldLabel } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'ReturnDetail'>;

// The store deals exclusively in RWF - item.currency is a nullable DB column that's rarely
// actually set, and a default parameter can't rescue an explicit `null` (only `undefined`), so
// this hardcodes the label instead of trusting that column (see AdminOrderDetailScreen.tsx).
const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

const AdminReturnDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { returnId } = route.params;
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [item, setItem] = useState<ReturnRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const { returnRequests } = await fetchReturns(token);
    const found = returnRequests.find((r) => r.id === returnId) ?? null;
    setItem(found);
    if (found?.unread) await markReturnRead(returnId, token);
  }, [returnId, token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApprove = () => {
    Alert.alert('Approve Return', 'This will mark the order as Returned and restore stock. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve', onPress: async () => {
          if (!token) return;
          setIsSaving(true);
          try {
            const { returnRequest } = await approveReturn(returnId, token);
            setItem(returnRequest);
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not approve return.');
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const handleReject = async () => {
    if (!token || !note.trim()) {
      Alert.alert('Note required', 'Please explain why this return is rejected.');
      return;
    }
    setIsSaving(true);
    try {
      const { returnRequest } = await rejectReturn(returnId, note.trim(), token);
      setItem(returnRequest);
      setRejectModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not reject return.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!item) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  const isResolved = item.status !== 'pending';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.topRow}>
        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.date}>Requested {new Date(item.requestedAt).toLocaleString()}</Text>

      <SectionTitle style={{ marginTop: 20 }}>Customer</SectionTitle>
      <Card>
        <Text style={styles.fieldValue}>{item.customerName}</Text>
        {item.customerEmail && <Text style={styles.fieldSub}>{item.customerEmail}</Text>}
        <Text style={[styles.fieldSub, { marginTop: 6 }]}>Order total: {formatPrice(item.total)}</Text>
      </Card>

      <SectionTitle style={{ marginTop: 20 }}>Reason</SectionTitle>
      <Card><Text style={styles.reasonText}>{item.reason}</Text></Card>

      {item.adminNote && (
        <>
          <SectionTitle style={{ marginTop: 20 }}>Admin Note</SectionTitle>
          <Card><Text style={styles.reasonText}>{item.adminNote}</Text></Card>
        </>
      )}

      {!isResolved && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
          <Button label="Reject" variant="danger" onPress={() => setRejectModalVisible(true)} style={{ flex: 1 }} loading={isSaving} />
          <Button label="Approve" onPress={handleApprove} style={{ flex: 1 }} loading={isSaving} />
        </View>
      )}

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Return</Text>
            <FieldLabel>Note to customer</FieldLabel>
            <TextField value={note} onChangeText={setNote} placeholder="Explain why this is rejected" multiline numberOfLines={3} style={{ height: 80, textAlignVertical: 'top' }} />
            <View style={styles.modalButtons}>
              <Button label="Cancel" variant="secondary" onPress={() => setRejectModalVisible(false)} style={{ flex: 1 }} />
              <Button label="Reject" variant="danger" onPress={handleReject} loading={isSaving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 20, fontWeight: '900', color: colors.slate900 },
  date: { fontSize: 12.5, color: colors.slate600, marginTop: 4, fontWeight: '600' },
  fieldValue: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  fieldSub: { fontSize: 12.5, color: colors.slate600, marginTop: 2 },
  reasonText: { fontSize: 13.5, color: colors.slate700, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900, marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});

export default AdminReturnDetailScreen;
