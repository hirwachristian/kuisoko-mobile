import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Trash2, Pencil } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  fetchShippingZones, createShippingZone, updateShippingZone, deleteShippingZone,
  fetchFreeShippingThreshold, updateFreeShippingThreshold,
} from '../../api/admin';
import { ShippingZone } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, SectionTitle, FieldLabel, TextField, Button, EmptyState } from '../../components/admin/ui';

const AdminStoreConfigScreen: React.FC = () => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [threshold, setThreshold] = useState('0');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [name, setName] = useState('');
  const [districts, setDistricts] = useState('');
  const [fee, setFee] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ zones: fetchedZones }, { freeShippingThreshold }] = await Promise.all([
      fetchShippingZones(),
      fetchFreeShippingThreshold(),
    ]);
    setZones(fetchedZones);
    setThreshold(String(freeShippingThreshold));
  }, []);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  const handleSaveThreshold = async () => {
    if (!token) return;
    setIsSavingThreshold(true);
    try {
      await updateFreeShippingThreshold(Number(threshold) || 0, token);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const openNewZone = () => {
    setEditingZone(null);
    setName('');
    setDistricts('');
    setFee('');
    setIsDefault(false);
    setModalVisible(true);
  };

  const openEditZone = (z: ShippingZone) => {
    setEditingZone(z);
    setName(z.name);
    setDistricts(z.districts.join(', '));
    setFee(String(z.fee));
    setIsDefault(z.isDefault);
    setModalVisible(true);
  };

  const handleSaveZone = async () => {
    if (!token || !name.trim() || !fee) return;
    setIsSaving(true);
    const payload = { name: name.trim(), districts: districts.split(',').map((d) => d.trim()).filter(Boolean), fee: Number(fee), isDefault };
    try {
      if (editingZone) await updateShippingZone(editingZone.id, payload, token);
      else await createShippingZone(payload, token);
      setModalVisible(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save zone.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteZone = (z: ShippingZone) => {
    Alert.alert('Delete zone', `Delete "${z.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (!token) return; await deleteShippingZone(z.id, token); await load(); } },
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
      <SectionTitle>Free Shipping Threshold</SectionTitle>
      <Card>
        <FieldLabel>Minimum order for free shipping (RWF)</FieldLabel>
        <TextField value={threshold} onChangeText={setThreshold} keyboardType="numeric" placeholder="0" />
        <Button label="Save Threshold" onPress={handleSaveThreshold} loading={isSavingThreshold} style={{ marginTop: 14 }} />
      </Card>

      <View style={styles.zonesHeader}>
        <SectionTitle style={{ marginBottom: 0 }}>Shipping Zones</SectionTitle>
        <TouchableOpacity onPress={openNewZone} style={styles.addIconButton}>
          <Plus size={16} color={colors.white} />
        </TouchableOpacity>
      </View>
      {zones.length === 0 ? (
        <Card><EmptyState label="No shipping zones yet" /></Card>
      ) : (
        zones.map((z) => (
          <Card key={z.id} style={{ marginBottom: 10 }}>
            <View style={styles.zoneTop}>
              <Text style={styles.zoneName}>{z.name}{z.isDefault ? '  (default)' : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <TouchableOpacity onPress={() => openEditZone(z)}><Pencil size={15} color={colors.slate600} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteZone(z)}><Trash2 size={15} color={colors.rose500} /></TouchableOpacity>
              </View>
            </View>
            <Text style={styles.zoneFee}>RWF {z.fee.toLocaleString()}</Text>
            {z.districts.length > 0 && <Text style={styles.zoneDistricts}>{z.districts.join(', ')}</Text>}
          </Card>
        ))
      )}

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingZone ? 'Edit Zone' : 'New Zone'}</Text>
            <FieldLabel>Name</FieldLabel>
            <TextField value={name} onChangeText={setName} placeholder="e.g. Kigali" />
            <FieldLabel>Districts (comma-separated)</FieldLabel>
            <TextField value={districts} onChangeText={setDistricts} placeholder="Gasabo, Kicukiro, Nyarugenge" />
            <FieldLabel>Fee (RWF)</FieldLabel>
            <TextField value={fee} onChangeText={setFee} keyboardType="numeric" placeholder="0" />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Default Zone</Text>
              <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: colors.emerald800, false: colors.slate200 }} />
            </View>
            <View style={styles.modalButtons}>
              <Button label="Cancel" variant="secondary" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
              <Button label="Save" onPress={handleSaveZone} loading={isSaving} style={{ flex: 1 }} />
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
  zonesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  addIconButton: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center' },
  zoneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  zoneName: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  zoneFee: { fontSize: 13, fontWeight: '700', color: colors.accentText },
  zoneDistricts: { fontSize: 11.5, color: colors.slate600, marginTop: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900, marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});

export default AdminStoreConfigScreen;
