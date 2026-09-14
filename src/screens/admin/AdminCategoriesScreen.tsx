import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, ChevronRight, Trash2, Wand2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { fetchCategories, createCategory, deleteCategory, translateTexts } from '../../api/admin';
import { Category } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { EmptyState, TextField, Button, FieldLabel } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'Categories'>;

const AdminCategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameKin, setNewNameKin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const load = useCallback(async () => {
    const { categories: fetched } = await fetchCategories();
    setCategories(fetched);
  }, []);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  const handleCreate = async () => {
    if (!token || !newName.trim()) return;
    setIsSaving(true);
    try {
      await createCategory({ name: newName.trim(), nameKin: newNameKin.trim() || undefined }, token);
      setModalVisible(false);
      setNewName('');
      setNewNameKin('');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuggestTranslation = async () => {
    if (!token || !newName.trim()) {
      Alert.alert('Enter a name first', 'Type the category name before requesting a suggestion.');
      return;
    }
    setIsTranslating(true);
    try {
      const { translations } = await translateTexts([newName.trim()], token);
      if (translations[0]) setNewNameKin(translations[0]);
      else Alert.alert('No suggestion available', 'Could not find a translation - please enter it manually.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not fetch a translation suggestion.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete category', `Delete "${name}" and all its sections?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (!token) return; await deleteCategory(id, token); await load(); } },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Plus size={16} color={colors.white} />
          <Text style={styles.addButtonText}>Add Category</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        ListEmptyComponent={<EmptyState label="No categories yet" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('CategoryDetail', { categoryId: item.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              {item.nameKin ? <Text style={styles.cardNameKin}>{item.nameKin}</Text> : null}
              <Text style={styles.cardMeta}>{item.sections.length} section{item.sections.length === 1 ? '' : 's'}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={{ padding: 6 }}>
              <Trash2 size={16} color={colors.rose500} />
            </TouchableOpacity>
            <ChevronRight size={18} color={colors.slate400} />
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Category</Text>
            <FieldLabel>Name</FieldLabel>
            <TextField value={newName} onChangeText={setNewName} placeholder="Category name" />
            <View style={styles.kinLabelRow}>
              <FieldLabel>Kinyarwanda Name (optional)</FieldLabel>
              <TouchableOpacity style={styles.suggestButton} onPress={handleSuggestTranslation} disabled={isTranslating}>
                {isTranslating ? <ActivityIndicator size="small" color={colors.accentText} /> : <Wand2 size={13} color={colors.accentText} />}
                <Text style={styles.suggestButtonText}>Suggest</Text>
              </TouchableOpacity>
            </View>
            <TextField value={newNameKin} onChangeText={setNewNameKin} placeholder="Izina mu Kinyarwanda" />
            <View style={styles.modalButtons}>
              <Button label="Cancel" variant="secondary" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
              <Button label="Create" onPress={handleCreate} loading={isSaving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  topBar: { padding: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  addButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.emerald800, borderRadius: 12, paddingVertical: 12 },
  addButtonText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: 14,
    marginBottom: 10,
  },
  cardName: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  cardNameKin: { fontSize: 11.5, color: colors.slate400, marginTop: 1, fontStyle: 'italic' },
  cardMeta: { fontSize: 11.5, color: colors.slate600, marginTop: 2 },
  kinLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  suggestButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.emerald50 },
  suggestButtonText: { fontSize: 11, fontWeight: '700', color: colors.accentText },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900, marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});

export default AdminCategoriesScreen;
