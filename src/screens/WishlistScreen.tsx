import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Heart, Search, SlidersHorizontal, X, ShoppingCart } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { Product } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import WishlistItemCard from '../components/customer/WishlistItemCard';
import Pagination from '../components/Pagination';
import type { CustomerTabParamList, CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = BottomTabScreenProps<CustomerTabParamList, 'Wishlist'> & {
  navigation: NativeStackNavigationProp<CustomerStackParamList> & BottomTabScreenProps<CustomerTabParamList, 'Wishlist'>['navigation'];
};

type SortOption = 'default' | 'price-low' | 'price-high' | 'stock';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'stock', label: 'Stock Status' },
];
const WISHLIST_PER_PAGE = 4;

// Ports frontend/pages/UserDashboard.tsx's wishlist redesign: search, a real category filter
// (product.category is genuine data), a sort option, a header "Move All to Cart", and pagination -
// none of which existed on this screen before. Mirrors ShopScreen.tsx's own search-bar +
// filters-modal idiom rather than inventing a new one.
const WishlistScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  const { productIds, isLoading: isWishlistLoading, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const { products } = await apiFetch<{ products: Product[] }>('/products');
    setAllProducts(products);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const wishlistProducts = useMemo(() => allProducts.filter((p) => productIds.includes(p.id)), [allProducts, productIds]);
  const categories = useMemo(() => Array.from(new Set(wishlistProducts.map((p) => p.category))).sort(), [wishlistProducts]);

  useEffect(() => { setPage(1); }, [query, category, sortBy]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = wishlistProducts
      .filter((p) => !category || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q));
    if (sortBy === 'price-low') items = [...items].sort((a, b) => a.price * (1 - (a.discount || 0) / 100) - b.price * (1 - (b.discount || 0) / 100));
    else if (sortBy === 'price-high') items = [...items].sort((a, b) => b.price * (1 - (b.discount || 0) / 100) - a.price * (1 - (a.discount || 0) / 100));
    else if (sortBy === 'stock') items = [...items].sort((a, b) => a.stock - b.stock);
    return items;
  }, [wishlistProducts, query, category, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / WISHLIST_PER_PAGE));
  const pagedItems = filtered.slice((page - 1) * WISHLIST_PER_PAGE, page * WISHLIST_PER_PAGE);

  const handleMoveToCart = async (product: Product) => {
    await addToCart(product.id, 1, undefined, undefined, product.price);
    await toggleWishlist(product.id);
  };

  const handleMoveAllToCart = async () => {
    for (const product of filtered) {
      await addToCart(product.id, 1, undefined, undefined, product.price);
    }
    for (const product of filtered) {
      await toggleWishlist(product.id);
    }
  };

  if (isLoading || isWishlistLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('mobile_wishlist_title')}</Text>
        {wishlistProducts.length > 0 && (
          <TouchableOpacity style={styles.moveAllButton} onPress={handleMoveAllToCart}>
            <ShoppingCart size={14} color={colors.white} />
            <Text style={styles.moveAllButtonText}>Move All to Cart</Text>
          </TouchableOpacity>
        )}
      </View>

      {wishlistProducts.length > 0 && (
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={colors.slate400} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search wishlist items..."
              placeholderTextColor={colors.slate400}
            />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={() => setFiltersVisible(true)}>
            <SlidersHorizontal size={18} color={colors.slate700} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={pagedItems}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListFooterComponent={
          filtered.length > 0 ? (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} itemsPerPage={WISHLIST_PER_PAGE} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Heart size={32} color={colors.slate400} />
            </View>
            <Text style={styles.emptyTitle}>{wishlistProducts.length === 0 ? t('mobile_wishlist_empty') : 'No wishlist items match your search.'}</Text>
            {wishlistProducts.length === 0 && <Text style={styles.emptyHint}>{t('mobile_wishlist_empty_hint')}</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ width: '48%' }}>
            <WishlistItemCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
              onRemove={() => toggleWishlist(item.id)}
              onMoveToCart={() => handleMoveToCart(item)}
            />
          </View>
        )}
      />

      <Modal visible={filtersVisible} transparent animationType="slide" onRequestClose={() => setFiltersVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFiltersVisible(false)}><X size={20} color={colors.slate600} /></TouchableOpacity>
            </View>

            <Text style={styles.modalSectionLabel}>Category</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity style={[styles.chip, !category && styles.chipActive]} onPress={() => setCategory(null)}>
                <Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSectionLabel}>Sort By</Text>
            {SORT_OPTIONS.map(({ value, label }) => (
              <TouchableOpacity key={value} style={[styles.sortOption, sortBy === value && styles.sortOptionActive]} onPress={() => setSortBy(value)}>
                <Text style={[styles.sortOptionText, sortBy === value && styles.sortOptionTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.doneButton} onPress={() => setFiltersVisible(false)}>
              <Text style={styles.doneButtonText}>Done</Text>
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
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, backgroundColor: colors.white,
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.slate900 },
  moveAllButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orange500, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  moveAllButtonText: { fontSize: 11.5, fontWeight: '800', color: colors.white },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.white },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.slate50, borderRadius: 12,
    borderWidth: 1, borderColor: colors.slate100, paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.slate900 },
  filterButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.slate900, textAlign: 'center', paddingHorizontal: 24 },
  emptyHint: { fontSize: 13, color: colors.slate600, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.slate900 },
  modalSectionLabel: { fontSize: 12, fontWeight: '800', color: colors.slate600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200 },
  chipActive: { backgroundColor: colors.emerald800, borderColor: colors.emerald800 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.slate700 },
  chipTextActive: { color: colors.white },
  sortOption: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  sortOptionActive: {},
  sortOptionText: { fontSize: 13.5, fontWeight: '600', color: colors.slate700 },
  sortOptionTextActive: { color: colors.accentText, fontWeight: '800' },
  doneButton: { backgroundColor: colors.orange500, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  doneButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
});

export default WishlistScreen;
