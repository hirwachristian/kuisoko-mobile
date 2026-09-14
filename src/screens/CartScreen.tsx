import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { ShoppingCart, ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { Product, CartItem } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { getLineImage } from '../utils/productImage';
import CheckoutStepper from '../components/customer/CheckoutStepper';
import type { CustomerTabParamList, CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = BottomTabScreenProps<CustomerTabParamList, 'Cart'> & {
  navigation: NativeStackNavigationProp<CustomerStackParamList> & BottomTabScreenProps<CustomerTabParamList, 'Cart'>['navigation'];
};

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

// The server only stores {productId, quantity, selectedColor, selectedSize, unitPrice} - every
// cart/checkout screen joins that against the live product catalog for name/image/current price,
// same as the website (frontend/pages/CartCheckout.tsx derives cartItems the same way).
const CartScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  const { items, updateQuantity, removeFromCart, isLoading: isCartLoading } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { products: fetched } = await apiFetch<{ products: Product[] }>('/products');
    setProducts(fetched);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const cartItems: CartItem[] = items
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      return product ? { ...line, product } : null;
    })
    .filter((i): i is CartItem => i !== null);

  const subtotal = cartItems.reduce((sum, item) => {
    const unitPrice = item.unitPrice ?? item.product.price;
    return sum + unitPrice * item.quantity;
  }, 0);
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading || isCartLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {cartItems.length > 0 && <CheckoutStepper currentStep={1} />}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <ShoppingBag size={19} color={colors.accentText} />
          <Text style={styles.title}>{t('mobile_cart_title')}</Text>
        </View>
        {cartItems.length > 0 && (
          <Text style={styles.itemCount}>{totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}</Text>
        )}
      </View>
      <FlatList
        data={cartItems}
        keyExtractor={(item) => `${item.productId}__${item.selectedColor ?? ''}__${item.selectedSize ?? ''}`}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <ShoppingCart size={32} color={colors.slate400} />
            </View>
            <Text style={styles.emptyTitle}>{t('mobile_cart_empty')}</Text>
            <Text style={styles.emptyHint}>{t('mobile_cart_empty_hint')}</Text>
            <TouchableOpacity style={styles.shopButton} onPress={() => navigation.navigate('Shop', { category: null, deals: false })}>
              <Text style={styles.shopButtonText}>{t('mobile_continue_shopping')}</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const unitPrice = item.unitPrice ?? item.product.price;
          return (
            <View style={styles.row}>
              <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { productId: item.product.id })}>
                <Image source={{ uri: getLineImage(item.product, item.selectedImage, item.selectedColor) }} style={styles.image} resizeMode="contain" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
                {(item.selectedColor || item.selectedSize) && (
                  <Text style={styles.variant}>
                    {[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')}
                  </Text>
                )}
                <Text style={styles.price}>{formatPrice(unitPrice)}</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => updateQuantity(item.productId, item.quantity - 1, item.selectedColor ?? undefined, item.selectedSize ?? undefined)}
                  >
                    <Minus size={14} color={colors.slate700} />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => updateQuantity(item.productId, item.quantity + 1, item.selectedColor ?? undefined, item.selectedSize ?? undefined)}
                  >
                    <Plus size={14} color={colors.slate700} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeButton} onPress={() => removeFromCart(item.productId)}>
                    <Trash2 size={16} color={colors.rose500} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />
      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>{t('mobile_subtotal')}</Text>
            <Text style={styles.subtotalValue}>{formatPrice(subtotal)}</Text>
          </View>
          <Text style={styles.shippingHint}>Shipping calculated at the next step</Text>
          <TouchableOpacity style={styles.checkoutButton} onPress={() => navigation.navigate('CheckoutAddress')} activeOpacity={0.85}>
            <Text style={styles.checkoutButtonText}>{t('mobile_proceed_to_checkout')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 19, fontWeight: '900', color: colors.slate900 },
  itemCount: { fontSize: 12.5, fontWeight: '700', color: colors.slate400 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.slate900 },
  emptyHint: { fontSize: 13, color: colors.slate600, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  shopButton: { marginTop: 20, backgroundColor: colors.emerald800, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  shopButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  row: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: colors.slate100,
  },
  image: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.slate50 },
  name: { fontSize: 13.5, fontWeight: '700', color: colors.slate900, lineHeight: 18 },
  variant: { fontSize: 11, color: colors.slate600, marginTop: 2 },
  price: { fontSize: 14, fontWeight: '900', color: colors.slate900, marginTop: 4 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  stepButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  quantityText: { fontSize: 13, fontWeight: '800', color: colors.slate900, minWidth: 20, textAlign: 'center' },
  removeButton: { marginLeft: 'auto', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.slate100 },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subtotalLabel: { fontSize: 14, fontWeight: '700', color: colors.slate600 },
  subtotalValue: { fontSize: 18, fontWeight: '900', color: colors.slate900 },
  shippingHint: { fontSize: 11.5, color: colors.slate400, fontWeight: '600', marginBottom: 12 },
  checkoutButton: { backgroundColor: colors.emerald800, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  checkoutButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});

export default CartScreen;
