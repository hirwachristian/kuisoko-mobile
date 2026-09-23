import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MapPin, Home, Building2, Package, Phone, Pencil, Trash2, X as XIcon } from 'lucide-react-native';
import { fetchAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress, SavedAddressInput } from '../api/customer';
import { SavedAddress } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button, TextField, FieldLabel } from '../components/admin/ui';
import AddressMapPreview from '../components/customer/AddressMapPreview';

const EMPTY_FORM: SavedAddressInput = {
  label: '', fullName: '', phoneNumber: '', country: '', cityTown: '', district: '',
  streetAddress: '', houseBuildingNumber: '', additionalInfo: '', isDefault: false,
};

// A small, honest touch - pick an icon by what the free-text label actually says, rather than a
// generic pin for every card. Mirrors frontend/pages/UserDashboard.tsx's addressIconFor.
const iconFor = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes('home')) return Home;
  if (lower.includes('office') || lower.includes('work')) return Building2;
  if (lower.includes('warehouse') || lower.includes('shop') || lower.includes('store')) return Package;
  return MapPin;
};

// Ports frontend/pages/UserDashboard.tsx's Address Book tab - a real, brand-new mobile feature
// (there was no saved-addresses concept on mobile before this). Tapping a card shows its map below
// (only one at a time, hidden until tapped), matching the website exactly.
const AddressBookScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const styles = createStyles(colors);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SavedAddressInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const { addresses: fetched } = await fetchAddresses(token);
    setAddresses(fetched);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalVisible(true);
  };

  const openEdit = (address: SavedAddress) => {
    setEditingId(address.id);
    setForm({
      label: address.label, fullName: address.fullName, phoneNumber: address.phoneNumber,
      country: address.country, cityTown: address.cityTown, district: address.district,
      streetAddress: address.streetAddress, houseBuildingNumber: address.houseBuildingNumber ?? '',
      additionalInfo: address.additionalInfo ?? '', isDefault: address.isDefault,
    });
    setFormError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.label.trim() || !form.fullName.trim() || !form.phoneNumber.trim() || !form.country.trim() || !form.cityTown.trim() || !form.district.trim() || !form.streetAddress.trim()) {
      setFormError('Please fill in every required field.');
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      if (editingId) await updateAddress(editingId, form, token);
      else await createAddress(form, token);
      setModalVisible(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save this address.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (address: SavedAddress) => {
    if (!token || address.isDefault) return;
    await setDefaultAddress(address.id, token);
    await load();
  };

  const handleDelete = (address: SavedAddress) => {
    if (!token) return;
    Alert.alert('Delete this address?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteAddress(address.id, token);
          if (selectedId === address.id) setSelectedId(null);
          await load();
        },
      },
    ]);
  };

  const selected = addresses.find((a) => a.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Button label="Add New Address" variant="orange" onPress={openAdd} style={{ marginBottom: 16 }} />

        {addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin size={32} color={colors.slate400} />
            <Text style={styles.emptyText}>No saved addresses yet.</Text>
          </View>
        ) : (
          addresses.map((address) => {
            const Icon = iconFor(address.label);
            const isSelected = selectedId === address.id;
            return (
              <TouchableOpacity
                key={address.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelectedId((prev) => (prev === address.id ? null : address.id))}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <View style={styles.iconWrap}><Icon size={15} color={colors.accentText} /></View>
                    <Text style={styles.cardLabel}>{address.label}</Text>
                  </View>
                  {address.isDefault && (
                    <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>
                  )}
                </View>
                <Text style={styles.cardName}>{address.fullName}</Text>
                <Text style={styles.cardLine}>
                  {address.streetAddress}{address.houseBuildingNumber ? `, ${address.houseBuildingNumber}` : ''}
                </Text>
                {address.additionalInfo ? <Text style={styles.cardLine}>{address.additionalInfo}</Text> : null}
                <Text style={styles.cardLine}>{address.district}, {address.cityTown}</Text>
                <Text style={styles.cardLine}>{address.country}</Text>
                <View style={styles.cardPhoneRow}>
                  <Phone size={12} color={colors.accentText} />
                  <Text style={styles.cardPhone}>{address.phoneNumber}</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => openEdit(address)}>
                    <Pencil size={13} color={colors.accentText} />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  {!address.isDefault && (
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleSetDefault(address)}>
                      <Text style={styles.actionTextMuted}>Set as Default</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(address)}>
                    <Trash2 size={13} color={colors.rose600} />
                    <Text style={styles.actionTextDanger}>Delete</Text>
                  </TouchableOpacity>
                </View>
                {isSelected && (
                  selected?.lat != null && selected?.lng != null ? (
                    <AddressMapPreview lat={selected.lat} lng={selected.lng} label={selected.label} style={styles.map} />
                  ) : (
                    <Text style={styles.mapUnavailable}>Map location isn't available for this address yet.</Text>
                  )
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Address' : 'Add New Address'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><XIcon size={20} color={colors.slate600} /></TouchableOpacity>
              </View>
              <FieldLabel>Address Label</FieldLabel>
              <TextField value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="e.g. Home, Office" />
              <FieldLabel>Full Name</FieldLabel>
              <TextField value={form.fullName} onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))} />
              <FieldLabel>Phone Number</FieldLabel>
              <TextField value={form.phoneNumber} onChangeText={(v) => setForm((f) => ({ ...f, phoneNumber: v }))} keyboardType="phone-pad" />
              <FieldLabel>Country</FieldLabel>
              <TextField value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} />
              <FieldLabel>City / Town</FieldLabel>
              <TextField value={form.cityTown} onChangeText={(v) => setForm((f) => ({ ...f, cityTown: v }))} />
              <FieldLabel>District</FieldLabel>
              <TextField value={form.district} onChangeText={(v) => setForm((f) => ({ ...f, district: v }))} />
              <FieldLabel>Street Address</FieldLabel>
              <TextField value={form.streetAddress} onChangeText={(v) => setForm((f) => ({ ...f, streetAddress: v }))} placeholder="e.g. KK 120 St" />
              <FieldLabel>House / Building Number</FieldLabel>
              <TextField value={form.houseBuildingNumber} onChangeText={(v) => setForm((f) => ({ ...f, houseBuildingNumber: v }))} />
              <FieldLabel>Additional Info</FieldLabel>
              <TextField value={form.additionalInfo} onChangeText={(v) => setForm((f) => ({ ...f, additionalInfo: v }))} />
              <TouchableOpacity style={styles.defaultToggleRow} onPress={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}>
                <View style={[styles.checkbox, form.isDefault && styles.checkboxChecked]} />
                <Text style={styles.defaultToggleLabel}>Set as my default address</Text>
              </TouchableOpacity>
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <Button label="Save Address" variant="orange" onPress={handleSave} loading={isSaving} style={{ marginTop: 16 }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 13, color: colors.slate600, fontWeight: '600' },
  card: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.slate100, padding: 16, marginBottom: 14 },
  cardSelected: { borderColor: colors.emerald600, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 14.5, fontWeight: '800', color: colors.slate900 },
  defaultBadge: { backgroundColor: colors.emerald800, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  defaultBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white, textTransform: 'uppercase' },
  cardName: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 2 },
  cardLine: { fontSize: 12.5, color: colors.slate600, lineHeight: 18 },
  cardPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cardPhone: { fontSize: 12.5, fontWeight: '700', color: colors.slate700 },
  cardActions: { flexDirection: 'row', gap: 18, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.slate100 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.accentText },
  actionTextMuted: { fontSize: 12, fontWeight: '700', color: colors.slate600 },
  actionTextDanger: { fontSize: 12, fontWeight: '700', color: colors.rose600 },
  map: { height: 160, borderRadius: 12, overflow: 'hidden', marginTop: 12 },
  mapUnavailable: { fontSize: 12, color: colors.slate600, marginTop: 12, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center' },
  modalScroll: { padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900 },
  defaultToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.slate200 },
  checkboxChecked: { backgroundColor: colors.emerald600, borderColor: colors.emerald600 },
  defaultToggleLabel: { fontSize: 13, fontWeight: '600', color: colors.slate700 },
  error: { color: colors.rose600, fontSize: 13, textAlign: 'center', marginTop: 12 },
});

export default AddressBookScreen;
