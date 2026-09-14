import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Modal, Alert, Linking } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Camera, Image as ImageIcon, ScanLine, SearchX } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { searchProductsByImage } from '../api/customer';
import { ApiError } from '../api/client';
import { Product, Category } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import ProductCard from '../components/customer/ProductCard';
import { EmptyState } from '../components/admin/ui';
import AttachmentSourceSheet from '../components/AttachmentSourceSheet';
import ImageSearchScanModal from '../components/customer/ImageSearchScanModal';
import type { CustomerTabParamList, CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = BottomTabScreenProps<CustomerTabParamList, 'Shop'> & {
  navigation: NativeStackNavigationProp<CustomerStackParamList> & BottomTabScreenProps<CustomerTabParamList, 'Shop'>['navigation'];
};

type SortOption = 'newest' | 'price-low' | 'price-high';
const ITEMS_PER_PAGE = 6;

// Ports frontend/pages/ProductListing.tsx: everything here is client-side (one GET /products call,
// then filter/sort/paginate in memory) - matching the website exactly rather than inventing a
// server-side search API that doesn't exist.
const ShopScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(route.params?.category ?? null);
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [isSubCategoryExpanded, setIsSubCategoryExpanded] = useState(true);
  const [dealsOnly, setDealsOnly] = useState(!!route.params?.deals);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [isImageSearchSheetVisible, setIsImageSearchSheetVisible] = useState(false);
  const [scanImageUri, setScanImageUri] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'scanning' | 'error' | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [imageSearchResults, setImageSearchResults] = useState<Product[] | null>(null);

  const load = useCallback(async () => {
    const [{ products: fetchedProducts }, { categories: fetchedCategories }] = await Promise.all([
      apiFetch<{ products: Product[] }>('/products'),
      apiFetch<{ categories: Category[] }>('/categories'),
    ]);
    setProducts(fetchedProducts);
    setCategories(fetchedCategories);
  }, []);

  useEffect(() => { load().finally(() => setIsLoading(false)); }, [load]);

  // A key left out of the params object entirely ("just switch to the Shop tab") means "leave
  // whatever filter is already active alone"; `category: null` / `deals: false` are the explicit
  // "clear this filter" signals callers like HomeScreen's "Explore More"/"See all" links and
  // CartScreen's "Continue Shopping" use - without that distinction, navigating here with no
  // params at all couldn't be told apart from "don't change anything," which previously left a
  // stale `deals: true` (or category) from an earlier visit showing by mistake.
  useFocusEffect(
    useCallback(() => {
      if (route.params?.category !== undefined) {
        setActiveCategory(route.params.category ?? null);
        setActiveSubCategory(null);
      }
      if (route.params?.deals !== undefined) setDealsOnly(!!route.params.deals);
    }, [route.params])
  );

  // Ports frontend/pages/ProductListing.tsx: picking a category clears any subcategory selection
  // (the website does this implicitly by replacing its whole query-string object) - a subcategory
  // only ever makes sense scoped to the category it belongs to.
  const handleSelectCategory = (category: string | null) => {
    setActiveCategory(category);
    setActiveSubCategory(null);
    setIsSubCategoryExpanded(true);
  };

  const activeCategoryData = categories.find((c) => c.name === activeCategory);

  // Ports frontend/components/Navbar.tsx's camera search + backend/src/routes/products.ts's
  // POST /products/search-by-image: uploads the photo, backend hashes it and ranks the catalog by
  // Hamming distance, returns up to 12 visual matches. Results REPLACE the normal listing (same
  // "bypass" behavior as the website's imageSearchProducts) until cleared.
  const runImageSearch = async (uri: string, name: string, mimeType: string) => {
    setScanImageUri(uri);
    setScanStatus('scanning');
    setScanError(null);
    try {
      const { products: matches } = await searchProductsByImage(uri, name, mimeType);
      setImageSearchResults(matches);
      setScanStatus(null);
    } catch (e) {
      setScanStatus('error');
      setScanError(e instanceof ApiError ? e.message : 'Could not search by this photo.');
    }
  };

  const retryImageSearch = () => {
    if (!scanImageUri) return;
    runImageSearch(scanImageUri, `search-${Date.now()}.jpg`, 'image/jpeg');
  };

  // No requestMediaLibraryPermissionsAsync() gate here on purpose - see ProductDetailScreen.tsx's
  // handlePickReviewImage for why: launchImageLibraryAsync opens the system picker out-of-process
  // and doesn't need library-wide access, and pre-requesting that broader permission ourselves is
  // what breaks in Expo Go with no way to fix it from Settings.
  const handleImageSearchFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await runImageSearch(asset.uri, asset.fileName ?? `search-${Date.now()}.jpg`, asset.mimeType ?? 'image/jpeg');
  };

  // Taking a photo IS a real hardware-access permission (unlike picking from the library), so it
  // still needs its own explicit request/Settings-fallback pattern.
  const handleImageSearchFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        Alert.alert(
          'Camera access is off',
          'You previously denied camera access. Turn it on in Settings to search by photo.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
        );
      } else {
        Alert.alert('Permission needed', 'Allow camera access to search by photo.');
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await runImageSearch(asset.uri, asset.fileName ?? `search-${Date.now()}.jpg`, asset.mimeType ?? 'image/jpeg');
  };

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.category === activeCategory);
    if (activeSubCategory) list = list.filter((p) => p.subCategory === activeSubCategory);
    if (dealsOnly) list = list.filter((p) => !!p.discount && p.discount > 0);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortBy === 'price-low') sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-high') sorted.sort((a, b) => b.price - a.price);
    return sorted;
  }, [products, activeCategory, activeSubCategory, dealsOnly, query, sortBy]);

  useEffect(() => { setPage(1); }, [activeCategory, activeSubCategory, dealsOnly, query, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
            placeholder="Search products"
            placeholderTextColor={colors.slate400}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}><X size={16} color={colors.slate400} /></TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => setIsImageSearchSheetVisible(true)}>
          <Camera size={18} color={colors.slate700} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setFiltersVisible(true)}>
          <SlidersHorizontal size={18} color={colors.slate700} />
        </TouchableOpacity>
      </View>

      {imageSearchResults ? (
        <View style={styles.imageSearchBanner}>
          <ScanLine size={15} color={colors.accentText} />
          <Text style={styles.imageSearchBannerText}>
            Photo search results ({imageSearchResults.length})
          </Text>
          <TouchableOpacity onPress={() => setImageSearchResults(null)}>
            <Text style={styles.imageSearchBannerClear}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
      <FlatList
        horizontal
        data={[{ id: 'all', name: 'All' }, ...categories]}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryRow}
        renderItem={({ item }) => {
          const isActive = item.id === 'all' ? activeCategory === null : activeCategory === item.name;
          return (
            <TouchableOpacity
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => handleSelectCategory(item.id === 'all' ? null : item.name)}
            >
              <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Subcategories for the selected category - ports the website's per-category accordion
          (Category.sections[].items, grouped under each section's title) as wrapped chips, which
          fits a phone screen far better than a nested sidebar list. Filters against
          product.subCategory by exact string match, same as the website. Auto-expands whenever a
          new category is picked (handleSelectCategory), but the chevron lets the user hide it
          without losing the active category/subcategory filter, matching the website's collapsible
          accordion behavior. */}
      {activeCategoryData && activeCategoryData.sections.some((s) => s.items.length > 0) && (
        <View style={styles.subCategoryPanel}>
          <TouchableOpacity
            style={styles.subCategoryToggle}
            onPress={() => setIsSubCategoryExpanded((prev) => !prev)}
          >
            <Text style={styles.subCategoryToggleText}>
              {activeSubCategory ? `Subcategory: ${activeSubCategory}` : 'Browse subcategories'}
            </Text>
            {isSubCategoryExpanded ? (
              <ChevronUp size={18} color={colors.emerald800} />
            ) : (
              <ChevronDown size={18} color={colors.emerald800} />
            )}
          </TouchableOpacity>
          {isSubCategoryExpanded &&
            activeCategoryData.sections.filter((s) => s.items.length > 0).map((section) => (
              <View key={section.id} style={styles.subCategoryGroup}>
                <Text style={styles.subCategoryGroupTitle}>{section.title}</Text>
                <View style={styles.subCategoryRow}>
                  {section.items.map((item) => {
                    const isActive = activeSubCategory === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.subCategoryChip, isActive && styles.subCategoryChipActive]}
                        onPress={() => setActiveSubCategory(isActive ? null : item)}
                      >
                        <Text style={[styles.subCategoryChipText, isActive && styles.subCategoryChipTextActive]}>{item}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
        </View>
      )}
        </>
      )}

      <FlatList
        style={{ flex: 1 }}
        data={imageSearchResults ?? pageItems}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          imageSearchResults ? (
            <View style={styles.noMatchState}>
              <View style={styles.noMatchIconWrap}>
                <SearchX size={30} color={colors.slate400} />
              </View>
              <Text style={styles.noMatchTitle}>No Matching Product Found</Text>
              <Text style={styles.noMatchSubtitle}>
                We couldn't find anything in our catalog that matches this photo. Try a clearer photo or a different angle, or search by name instead.
              </Text>
              <View style={styles.noMatchActions}>
                <TouchableOpacity style={styles.noMatchSecondaryButton} onPress={() => setIsImageSearchSheetVisible(true)}>
                  <Camera size={15} color={colors.slate600} />
                  <Text style={styles.noMatchSecondaryButtonText}>Try Another Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.noMatchPrimaryButton} onPress={() => setImageSearchResults(null)}>
                  <Text style={styles.noMatchPrimaryButtonText}>Browse Products</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <EmptyState label="No products found" />
          )
        }
        renderItem={({ item }) => (
          <View style={{ width: '48%' }}>
            <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.id })} />
          </View>
        )}
        ListFooterComponent={
          !imageSearchResults && totalPages > 1 ? (
            <View style={styles.pagination}>
              <TouchableOpacity disabled={page === 1} onPress={() => setPage((p) => p - 1)} style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}>
                <ChevronLeft size={16} color={colors.slate700} />
              </TouchableOpacity>
              <Text style={styles.pageLabel}>{page} / {totalPages}</Text>
              <TouchableOpacity disabled={page === totalPages} onPress={() => setPage((p) => p + 1)} style={[styles.pageButton, page === totalPages && styles.pageButtonDisabled]}>
                <ChevronRight size={16} color={colors.slate700} />
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <AttachmentSourceSheet
        visible={isImageSearchSheetVisible}
        title="Search by Photo"
        onClose={() => setIsImageSearchSheetVisible(false)}
        options={[
          { key: 'library', label: 'Photo Library', Icon: ImageIcon, onSelect: handleImageSearchFromLibrary },
          { key: 'camera', label: 'Take Photo', Icon: Camera, onSelect: handleImageSearchFromCamera },
        ]}
      />

      <ImageSearchScanModal
        visible={scanStatus !== null}
        imageUri={scanImageUri}
        status={scanStatus ?? 'scanning'}
        errorMessage={scanError}
        onClose={() => setScanStatus(null)}
        onRetry={retryImageSearch}
      />

      <Modal visible={filtersVisible} transparent animationType="slide" onRequestClose={() => setFiltersVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort & Filter</Text>
              <TouchableOpacity onPress={() => setFiltersVisible(false)}><X size={20} color={colors.slate600} /></TouchableOpacity>
            </View>
            <Text style={styles.sheetLabel}>Sort by</Text>
            <View style={styles.sortRow}>
              {([['newest', 'Newest'], ['price-low', 'Price: Low to High'], ['price-high', 'Price: High to Low']] as [SortOption, string][]).map(([value, label]) => (
                <TouchableOpacity key={value} style={[styles.sortOption, sortBy === value && styles.sortOptionActive]} onPress={() => setSortBy(value)}>
                  <Text style={[styles.sortOptionText, sortBy === value && styles.sortOptionTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.dealsToggle} onPress={() => setDealsOnly((v) => !v)}>
              <View style={[styles.checkbox, dealsOnly && styles.checkboxActive]} />
              <Text style={styles.sheetLabel}>Deals only</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={() => setFiltersVisible(false)}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  topBar: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.white },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.slate50, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.slate200 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.slate900 },
  filterButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  categoryList: { flexGrow: 0, height: 52, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  categoryRow: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  categoryChip: { height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, justifyContent: 'center', alignItems: 'center' },
  categoryChipActive: { backgroundColor: colors.emerald800, borderColor: colors.emerald800 },
  categoryChipText: { fontSize: 12, fontWeight: '700', color: colors.slate700 },
  categoryChipTextActive: { color: colors.white },
  imageSearchBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.emerald50,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.emerald100,
  },
  imageSearchBannerText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: colors.accentText },
  imageSearchBannerClear: { fontSize: 12.5, fontWeight: '800', color: colors.rose600 },
  noMatchState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
  noMatchIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  noMatchTitle: { fontSize: 16, fontWeight: '800', color: colors.slate900, textAlign: 'center' },
  noMatchSubtitle: { fontSize: 13, color: colors.slate600, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  noMatchActions: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' },
  noMatchSecondaryButton: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 14, backgroundColor: colors.slate100,
  },
  noMatchSecondaryButtonText: { fontSize: 12.5, fontWeight: '700', color: colors.slate600 },
  noMatchPrimaryButton: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center' },
  noMatchPrimaryButtonText: { fontSize: 12.5, fontWeight: '700', color: colors.white },
  subCategoryPanel: {
    backgroundColor: colors.white, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: colors.slate100, gap: 10,
  },
  subCategoryToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, marginBottom: 2,
  },
  subCategoryToggleText: { fontSize: 12.5, fontWeight: '700', color: colors.emerald800 },
  subCategoryGroup: { marginBottom: 6 },
  subCategoryGroupTitle: { fontSize: 10, fontWeight: '800', color: colors.slate400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  subCategoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subCategoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate100 },
  subCategoryChipActive: { backgroundColor: colors.emerald50, borderColor: colors.emerald100 },
  subCategoryChipText: { fontSize: 11.5, fontWeight: '600', color: colors.slate600 },
  subCategoryChipTextActive: { color: colors.accentText, fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
  pageButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  pageButtonDisabled: { opacity: 0.4 },
  pageLabel: { fontSize: 13, fontWeight: '700', color: colors.slate700 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900 },
  sheetLabel: { fontSize: 13, fontWeight: '700', color: colors.slate700 },
  sortRow: { gap: 8, marginTop: 10, marginBottom: 16 },
  sortOption: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate100 },
  sortOptionActive: { backgroundColor: colors.emerald50, borderColor: colors.emerald100 },
  sortOptionText: { fontSize: 13, fontWeight: '600', color: colors.slate600 },
  sortOptionTextActive: { color: colors.accentText, fontWeight: '800' },
  dealsToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.slate200 },
  checkboxActive: { backgroundColor: colors.emerald800, borderColor: colors.emerald800 },
  applyButton: { backgroundColor: colors.emerald800, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  applyButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});

export default ShopScreen;
