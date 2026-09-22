import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Trash2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchPaymentMethods, updatePaymentMethods, PaymentMethod } from '../../api/admin';
import { useAuth } from '../../context/AuthContext';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, FieldLabel, TextField, Button } from './ui';
import MtnBadge from './MtnBadge';

const METHOD_TYPES = ['MTN', 'Airtel', 'Momo Pay', 'Paypack', 'Cash on Delivery'];

// Ports frontend/components/AdminPaymentMethods.tsx 1:1 - lets an admin add/enable/disable/remove
// the payment options shown to customers at checkout (the same GET/PUT /settings/payment-methods
// the website's checkout reads from).
const AdminPaymentMethods: React.FC = () => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('MTN');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const { paymentMethods } = await fetchPaymentMethods();
    setMethods(paymentMethods);
  }, []);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  const validate = (): string | null => {
    const value = detail.trim();
    if (selectedType === 'Momo Pay') {
      if (!/^\d{6}$/.test(value)) return 'Merchant code must be 6 digits';
    } else if (selectedType === 'Cash on Delivery') {
      if (!value) return 'Enter a short note (e.g. Pay when it arrives)';
    } else {
      if (!/^07\d{8}$/.test(value)) return 'Phone number must be 10 digits starting with 07';
    }
    return null;
  };

  const save = async (next: PaymentMethod[]) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const { paymentMethods } = await updatePaymentMethods(next, token);
      setMethods(paymentMethods);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update payment methods.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    save([...methods, { name: selectedType, enabled: true, detail: detail.trim() }]);
    setDetail('');
  };

  const handleToggle = (name: string, methodDetail: string) => {
    save(methods.map((m) => (m.name === name && m.detail === methodDetail ? { ...m, enabled: !m.enabled } : m)));
  };

  const handleDelete = (name: string, methodDetail: string) => {
    save(methods.filter((m) => !(m.name === name && m.detail === methodDetail)));
  };

  if (isLoading) {
    return (
      <Card>
        <ActivityIndicator size="small" color={colors.emerald800} />
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>Payment Settings</Text>
      <FieldLabel>Type</FieldLabel>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={selectedType} onValueChange={(v) => { setSelectedType(v); setError(null); }}>
          {METHOD_TYPES.map((type) => <Picker.Item key={type} label={type} value={type} />)}
        </Picker>
      </View>
      <FieldLabel>{selectedType === 'Momo Pay' ? 'Merchant code' : selectedType === 'Cash on Delivery' ? 'Note' : 'Phone number'}</FieldLabel>
      <TextField
        value={detail}
        onChangeText={(t) => { setDetail(t); setError(null); }}
        placeholder={selectedType === 'Momo Pay' ? 'Enter Code' : selectedType === 'Cash on Delivery' ? 'e.g. Pay when it arrives' : 'Enter Number'}
        keyboardType={selectedType === 'Momo Pay' ? 'number-pad' : selectedType === 'Cash on Delivery' ? 'default' : 'phone-pad'}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Add" onPress={handleAdd} loading={isSaving} style={{ marginTop: 10 }} />

      <View style={{ marginTop: 16, gap: 8 }}>
        {methods.map((method) => (
          <View key={method.name + method.detail} style={styles.row}>
            <View style={styles.rowLeft}>
              <Switch
                value={method.enabled}
                onValueChange={() => handleToggle(method.name, method.detail)}
                trackColor={{ true: colors.emerald800, false: colors.slate200 }}
              />
              {/mtn/i.test(method.name) && <MtnBadge />}
              <Text style={styles.rowText}>{method.name} ({method.detail})</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(method.name, method.detail)}>
              <Trash2 size={16} color={colors.rose500} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Card>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  title: { fontSize: 15, fontWeight: '800', color: colors.slate900, marginBottom: 12 },
  pickerWrap: { borderWidth: 1, borderColor: colors.slate200, borderRadius: 12, marginBottom: 12 },
  error: { color: colors.rose600, fontSize: 12, marginTop: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: 10, borderRadius: 12, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexShrink: 1 },
  rowText: { fontSize: 12.5, fontWeight: '700', color: colors.slate700, flexShrink: 1 },
});

export default AdminPaymentMethods;
