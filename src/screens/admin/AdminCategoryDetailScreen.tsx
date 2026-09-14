import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, Trash2, Pencil, Wand2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { fetchCategories, createSection, updateSection, deleteSection, translateTexts } from '../../api/admin';
import { Category, CategorySection } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, TextField, Button, FieldLabel, EmptyState, SectionTitle } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'CategoryDetail'>;

const splitList = (text: string) => text.split(',').map((i) => i.trim()).filter(Boolean);

const AdminCategoryDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId } = route.params;
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<CategorySection | null>(null);
  const [title, setTitle] = useState('');
  const [titleKin, setTitleKin] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [itemsKinText, setItemsKinText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const load = useCallback(async () => {
    const { categories } = await fetchCategories();
    const found = categories.find((c) => c.id === categoryId) ?? null;
    setCategory(found);
    if (found) navigation.setOptions({ title: found.name });
  }, [categoryId]);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  const openNewSection = () => {
    setEditingSection(null);
    setTitle('');
    setTitleKin('');
    setItemsText('');
    setItemsKinText('');
    setModalVisible(true);
  };

  const openEditSection = (s: CategorySection) => {
    setEditingSection(s);
    setTitle(s.title);
    setTitleKin(s.titleKin ?? '');
    setItemsText(s.items.join(', '));
    setItemsKinText((s.itemsKin ?? []).join(', '));
    setModalVisible(true);
  };

  // Translates the title + every item in one batch call, then reassembles the Kinyarwanda title
  // and item list from the parallel results - matching the website's "suggest, then let the admin
  // review/edit before saving" flow (POST /categories/translate never auto-applies).
  const handleSuggestTranslation = async () => {
    if (!token || !title.trim()) {
      Alert.alert('Enter a title first', 'Type the section title before requesting suggestions.');
      return;
    }
    const items = splitList(itemsText);
    setIsTranslating(true);
    try {
      const { translations } = await translateTexts([title.trim(), ...items], token);
      const [titleTranslation, ...itemTranslations] = translations;
      if (titleTranslation) setTitleKin(titleTranslation);
      if (items.length > 0) setItemsKinText(itemTranslations.map((t, i) => t ?? items[i]).join(', '));
      if (!titleTranslation && itemTranslations.every((t) => !t)) {
        Alert.alert('No suggestions available', 'Could not find translations - please enter them manually.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not fetch translation suggestions.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveSection = async () => {
    if (!token || !title.trim()) return;
    const items = splitList(itemsText);
    const itemsKin = splitList(itemsKinText);
    setIsSaving(true);
    try {
      const payload = { title: title.trim(), titleKin: titleKin.trim() || undefined, items, itemsKin };
      if (editingSection) {
        await updateSection(categoryId, editingSection.id, payload, token);
      } else {
        await createSection(categoryId, payload, token);
      }
      setModalVisible(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save section.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSection = (s: CategorySection) => {
    Alert.alert('Delete section', `Delete "${s.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (!token) return; await deleteSection(categoryId, s.id, token); await load(); } },
    ]);
  };

  if (isLoading || !category) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionTitle>Sections</SectionTitle>
      {category.sections.length === 0 ? (
        <Card><EmptyState label="No sections yet" /></Card>
      ) : (
        category.sections.map((s) => (
          <Card key={s.id} style={{ marginBottom: 10 }}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionName}>{s.title}</Text>
                {s.titleKin ? <Text style={styles.sectionNameKin}>{s.titleKin}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <TouchableOpacity onPress={() => openEditSection(s)}><Pencil size={15} color={colors.slate600} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSection(s)}><Trash2 size={15} color={colors.rose500} /></TouchableOpacity>
              </View>
            </View>
            <View style={styles.itemsWrap}>
              {s.items.map((item) => (
                <View key={item} style={styles.itemChip}><Text style={styles.itemChipText}>{item}</Text></View>
              ))}
            </View>
          </Card>
        ))
      )}
      <Button label="Add Section" variant="secondary" onPress={openNewSection} style={{ marginTop: 8 }} />

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{editingSection ? 'Edit Section' : 'New Section'}</Text>
                <TouchableOpacity style={styles.suggestButton} onPress={handleSuggestTranslation} disabled={isTranslating}>
                  {isTranslating ? <ActivityIndicator size="small" color={colors.accentText} /> : <Wand2 size={13} color={colors.accentText} />}
                  <Text style={styles.suggestButtonText}>Suggest Kinyarwanda</Text>
                </TouchableOpacity>
              </View>
              <FieldLabel>Title</FieldLabel>
              <TextField value={title} onChangeText={setTitle} placeholder="Section title" />
              <FieldLabel>Title (Kinyarwanda)</FieldLabel>
              <TextField value={titleKin} onChangeText={setTitleKin} placeholder="Umutwe mu Kinyarwanda" />
              <FieldLabel>Items (comma-separated)</FieldLabel>
              <TextField value={itemsText} onChangeText={setItemsText} placeholder="Item one, Item two" multiline numberOfLines={3} style={{ height: 70, textAlignVertical: 'top' }} />
              <FieldLabel>Items (Kinyarwanda, comma-separated)</FieldLabel>
              <TextField value={itemsKinText} onChangeText={setItemsKinText} placeholder="Ikintu cya mbere, Ikintu cya kabiri" multiline numberOfLines={3} style={{ height: 70, textAlignVertical: 'top' }} />
              <View style={styles.modalButtons}>
                <Button label="Cancel" variant="secondary" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
                <Button label="Save" onPress={handleSaveSection} loading={isSaving} style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  sectionName: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  sectionNameKin: { fontSize: 11.5, color: colors.slate400, marginTop: 2, fontStyle: 'italic' },
  itemsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemChip: { backgroundColor: colors.slate100, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  itemChipText: { fontSize: 11.5, color: colors.slate700, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center' },
  modalScroll: { justifyContent: 'center', flexGrow: 1, padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900 },
  suggestButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.emerald50 },
  suggestButtonText: { fontSize: 10.5, fontWeight: '700', color: colors.accentText },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});

export default AdminCategoryDetailScreen;
