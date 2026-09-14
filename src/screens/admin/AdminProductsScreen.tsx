import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, SafeAreaView, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Plus, Search, Download, Upload } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { fetchProducts, fetchCategories, exportProductsCsv, importProductsCsv } from '../../api/admin';
import { Product, Category } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { EmptyState } from '../../components/admin/ui';
import type { AdminProductsStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminProductsStackParamList, 'ProductsList'>;

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

const AdminProductsScreen: React.FC<Props> = ({ navigation }) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(async () => {
    const [{ products: fetched }, { categories: fetchedCategories }] = await Promise.all([fetchProducts(), fetchCategories()]);
    setProducts(fetched);
    setCategories(fetchedCategories);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const handleExportCsv = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const csv = await exportProductsCsv(token);
      const file = new File(Paths.cache, `kuisoko-products-${Date.now()}.csv`);
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Products Export' });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not export products.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportCsv = async () => {
    if (!token) return;
    const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', '*/*'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setIsImporting(true);
    try {
      const summary = await importProductsCsv(asset.uri, asset.name, token);
      const errorText = summary.errors.length > 0
        ? `\n\n${summary.errors.length} row(s) had errors:\n${summary.errors.slice(0, 5).map((e) => `Row ${e.row}: ${e.message}`).join('\n')}`
        : '';
      Alert.alert('Import complete', `Created ${summary.created}, updated ${summary.updated} product(s).${errorText}`);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not import products.');
    } finally {
      setIsImporting(false);
    }
  };

  const visible = products
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .filter((p) => !activeCategory || p.category === activeCategory);

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
        <View style={styles.searchWrap}>
          <Search size={16} color={colors.slate400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={colors.slate400}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('ProductForm', {})}>
          <Plus size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.csvRow}>
        <TouchableOpacity style={styles.csvButton} onPress={handleExportCsv} disabled={isExporting}>
          {isExporting ? <ActivityIndicator size="small" color={colors.slate700} /> : <Download size={14} color={colors.slate700} />}
          <Text style={styles.csvButtonText}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.csvButton} onPress={handleImportCsv} disabled={isImporting}>
          {isImporting ? <ActivityIndicator size="small" color={colors.slate700} /> : <Upload size={14} color={colors.slate700} />}
          <Text style={styles.csvButtonText}>Import CSV</Text>
        </TouchableOpacity>
      </View>

      {categories.length > 0 && (
        <FlatList
          horizontal
          data={[{ id: 'all', name: 'All' }, ...categories]}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterList}
          renderItem={({ item }) => {
            const isActive = item.id === 'all' ? activeCategory === null : activeCategory === item.name;
            return (
              <TouchableOpacity
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveCategory(item.id === 'all' ? null : item.name)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <FlatList
        style={{ flex: 1 }}
        data={visible}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald800} />}
        ListEmptyComponent={<EmptyState label="No products found" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('ProductForm', { productId: item.id })}>
            <Image source={{ uri: item.images[0] }} style={styles.cardImage} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.category} · {item.subCategory}</Text>
              <View style={styles.cardBottom}>
                <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
                <Text style={[styles.cardStock, item.stock < 10 && styles.cardStockLow]}>{item.stock} in stock</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  topBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 10,
    backgroundColor: colors.white,
  },
  csvRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  csvButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.slate100,
    borderRadius: 10,
    paddingVertical: 9,
  },
  csvButtonText: { fontSize: 12, fontWeight: '700', color: colors.slate700 },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.slate50,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.slate900 },
  addButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center' },
  filterList: { flexGrow: 0, height: 52, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  filterRow: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  filterChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.emerald800,
    borderColor: colors.emerald800,
    shadowColor: colors.emerald800,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.slate700 },
  filterChipTextActive: { color: colors.white },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: 12,
    marginBottom: 10,
  },
  cardImage: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.slate50 },
  cardName: { fontSize: 13.5, fontWeight: '700', color: colors.slate900 },
  cardMeta: { fontSize: 11.5, color: colors.slate400, marginTop: 2, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardPrice: { fontSize: 13.5, fontWeight: '900', color: colors.slate900 },
  cardStock: { fontSize: 11.5, fontWeight: '700', color: colors.accentText },
  cardStockLow: { color: colors.rose500 },
});

export default AdminProductsScreen;
