import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Trash2, ShoppingBag } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Product } from '../../types';

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

type StockLevel = 'out' | 'low' | 'medium' | 'high';
const getStockLevel = (stock: number): StockLevel => {
  if (stock <= 0) return 'out';
  if (stock < 10) return 'low';
  if (stock <= 15) return 'medium';
  return 'high';
};

interface WishlistItemCardProps {
  product: Product;
  onPress: () => void;
  onRemove: () => void;
  onMoveToCart: () => void;
}

// A bespoke wishlist card, distinct from the shared ProductCard.tsx (that one stays untouched and
// keeps backing Shop/Home/Similar Products) - ports the website's redesigned wishlist tab: a
// category eyebrow, a stock PILL over the image instead of plain text, an explicit remove icon
// (not just the heart toggle), and a full-width "Move to Cart" action.
const WishlistItemCard: React.FC<WishlistItemCardProps> = ({ product, onPress, onRemove, onMoveToCart }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const hasDiscount = !!product.discount && product.discount > 0;
  const finalPrice = hasDiscount ? product.price * (1 - product.discount! / 100) : product.price;
  const level = getStockLevel(product.stock);
  const isOutOfStock = level === 'out';

  const stockPill = level === 'out'
    ? { label: 'OUT OF STOCK', bg: colors.slate800 }
    : level === 'low'
    ? { label: 'LOW STOCK', bg: colors.orange500 }
    : { label: 'IN STOCK', bg: colors.emerald600 };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.removeButton} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Trash2 size={14} color={colors.rose600} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.imageWrap} activeOpacity={0.9} onPress={onPress}>
        <Image source={{ uri: product.images[0] }} style={[styles.image, isOutOfStock && styles.imageDim]} resizeMode="contain" />
        <View style={[styles.stockPill, { backgroundColor: stockPill.bg }]}>
          <Text style={styles.stockPillText}>{stockPill.label}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.body}>
        <Text style={styles.category}>{product.category}</Text>
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        </TouchableOpacity>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(finalPrice)}</Text>
          {hasDiscount && <Text style={styles.originalPrice}>{formatPrice(product.price)}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.moveButton, isOutOfStock && styles.moveButtonDisabled]}
          disabled={isOutOfStock}
          onPress={onMoveToCart}
        >
          <ShoppingBag size={13} color={colors.white} />
          <Text style={styles.moveButtonText}>{isOutOfStock ? 'Out of Stock' : 'Move to Cart'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    flex: 1, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.slate100,
    overflow: 'hidden', shadowColor: colors.slate900, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  removeButton: {
    position: 'absolute', top: 8, right: 8, zIndex: 10, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  imageWrap: { aspectRatio: 1, backgroundColor: colors.white, padding: 10 },
  image: { width: '100%', height: '100%' },
  imageDim: { opacity: 0.5 },
  stockPill: { position: 'absolute', bottom: 8, left: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  stockPillText: { fontSize: 7.5, fontWeight: '900', color: colors.white, letterSpacing: 0.4 },
  body: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  category: { fontSize: 9, fontWeight: '800', color: colors.accentText, textTransform: 'uppercase', letterSpacing: 0.4 },
  name: { fontSize: 12.5, fontWeight: '700', color: colors.slate900, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  price: { fontSize: 14, fontWeight: '900', color: colors.slate900 },
  originalPrice: { fontSize: 10, color: colors.slate400, textDecorationLine: 'line-through', fontWeight: '700' },
  moveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.orange500,
    borderRadius: 10, paddingVertical: 9, marginTop: 10,
  },
  moveButtonDisabled: { opacity: 0.5 },
  moveButtonText: { fontSize: 11, fontWeight: '800', color: colors.white },
});

export default WishlistItemCard;
