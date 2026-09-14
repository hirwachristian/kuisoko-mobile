import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Heart } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { Product } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useWishlist } from '../context/WishlistContext';
import ProductCard from '../components/customer/ProductCard';
import type { CustomerTabParamList, CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = BottomTabScreenProps<CustomerTabParamList, 'Wishlist'> & {
  navigation: NativeStackNavigationProp<CustomerStackParamList> & BottomTabScreenProps<CustomerTabParamList, 'Wishlist'>['navigation'];
};

const WishlistScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  const { productIds, isLoading: isWishlistLoading } = useWishlist();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { products } = await apiFetch<{ products: Product[] }>('/products');
    setAllProducts(products);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const items = allProducts.filter((p) => productIds.includes(p.id));

  if (isLoading || isWishlistLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('mobile_wishlist_title')}</Text>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Heart size={32} color={colors.slate400} />
            </View>
            <Text style={styles.emptyTitle}>{t('mobile_wishlist_empty')}</Text>
            <Text style={styles.emptyHint}>{t('mobile_wishlist_empty_hint')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ width: '48%' }}>
            <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.id })} />
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  title: { fontSize: 20, fontWeight: '900', color: colors.slate900, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, backgroundColor: colors.white },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.slate900 },
  emptyHint: { fontSize: 13, color: colors.slate600, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
});

export default WishlistScreen;
