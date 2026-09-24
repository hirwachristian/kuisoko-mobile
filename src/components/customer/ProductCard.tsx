import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Heart, ShoppingCart } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { Product } from '../../types';
import { getProductThumbnail } from '../../utils/productImage';

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

type StockLevel = 'out' | 'low' | 'medium' | 'high';
const getStockLevel = (stock: number): StockLevel => {
  if (stock <= 0) return 'out';
  if (stock < 10) return 'low';
  if (stock <= 15) return 'medium';
  return 'high';
};

interface ProductCardProps {
  product: Product;
  onPress: () => void;
}

// Ports frontend/components/ProductCard.tsx's grid card: image, out-of-stock/discount badges,
// wishlist heart, name + star rating, color-coded stock text, price (+ struck-through original),
// and a Buy button that adds the base product to cart - variant selection (color/size) happens on
// the product detail page, matching the website (the card never prompts for variants).
const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  const { colors } = useAppTheme();
  const { productIds, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const styles = createStyles(colors);

  const hasDiscount = !!product.discount && product.discount > 0;
  const finalPrice = hasDiscount ? product.price * (1 - product.discount! / 100) : product.price;
  const level = getStockLevel(product.stock);
  const isOutOfStock = level === 'out';
  const isWishlisted = productIds.includes(product.id);

  const stockColor: Record<StockLevel, string> = {
    out: colors.rose500, low: colors.rose500, medium: colors.orange500, high: colors.emerald600,
  };
  const stockLabel = level === 'out' ? 'Out of stock' : level === 'low' ? `Only ${product.stock} left` : `${product.stock} in stock`;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: getProductThumbnail(product) }} style={[styles.image, isOutOfStock && styles.imageDim]} resizeMode="contain" />
        <View style={styles.badgeStack}>
          {isOutOfStock && (
            <View style={[styles.badge, { backgroundColor: colors.slate800 }]}>
              <Text style={styles.badgeText}>OUT OF STOCK</Text>
            </View>
          )}
          {hasDiscount && (
            <View style={[styles.badge, { backgroundColor: colors.rose500 }]}>
              <Text style={styles.badgeText}>-{product.discount}%</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.heartButton}
          onPress={(e) => { e.stopPropagation?.(); toggleWishlist(product.id); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Heart size={15} color={isWishlisted ? colors.rose500 : colors.slate400} fill={isWishlisted ? colors.rose500 : 'none'} />
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
          <View style={styles.ratingPill}>
            <Star size={9} color={colors.orange500} fill={colors.orange500} />
            <Text style={styles.ratingText}>{product.rating}</Text>
          </View>
        </View>
        <Text style={[styles.stockText, { color: stockColor[level] }]}>{stockLabel}</Text>
        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.price} numberOfLines={1}>{formatPrice(finalPrice)}</Text>
            {hasDiscount && <Text style={styles.originalPrice}>{formatPrice(product.price)}</Text>}
          </View>
          <TouchableOpacity
            style={[styles.buyButton, isOutOfStock && styles.buyButtonDisabled]}
            disabled={isOutOfStock}
            onPress={() => addToCart(product.id, 1, undefined, undefined, product.price)}
          >
            <ShoppingCart size={13} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.slate100,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  imageWrap: { aspectRatio: 1, backgroundColor: colors.white, padding: 10 },
  image: { width: '100%', height: '100%' },
  imageDim: { opacity: 0.5 },
  badgeStack: { position: 'absolute', top: 10, left: 10, gap: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: colors.white, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  heartButton: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  name: { flex: 1, fontSize: 12.5, fontWeight: '700', color: colors.slate900, lineHeight: 16 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.orange50, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  ratingText: { fontSize: 9, fontWeight: '800', color: colors.orange800 },
  stockText: { fontSize: 10, fontWeight: '700', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.slate50, paddingTop: 8, gap: 8 },
  price: { fontSize: 14, fontWeight: '900', color: colors.slate900, letterSpacing: -0.3 },
  originalPrice: { fontSize: 10, color: colors.slate400, textDecorationLine: 'line-through', fontWeight: '700', marginTop: 1 },
  buyButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.orange500, alignItems: 'center', justifyContent: 'center' },
  buyButtonDisabled: { opacity: 0.4 },
});

export default ProductCard;
