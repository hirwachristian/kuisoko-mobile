import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { ProductVariant } from '../../types';
import { TextField } from './ui';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface AdminImageStockManagerProps {
  images: string[];
  /** The product's full variant list - filtered internally to just this product's image-stock
   * rows (imageUrl set); color/size rows are passed straight through untouched on every change,
   * so this and AdminVariantManager can safely share one flat array. */
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  /** The product's own overall stock count - image stock is a breakdown of it, same rule as
   * color/size variants. */
  productStock: number;
}

// Ports frontend/components/AdminImageStockManager.tsx 1:1 - an alternative to color/size
// variants for a product that isn't meant to vary by either, but still has several photos worth
// stocking separately. Picking a photo on the product page is the "selection", no separate UI.
const AdminImageStockManager: React.FC<AdminImageStockManagerProps> = ({ images, variants, onChange, productStock }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  if (images.length === 0) return null;

  const otherVariants = variants.filter((v) => !v.imageUrl);
  const imageVariants = variants.filter((v) => v.imageUrl);
  const variantForImage = (url: string) => imageVariants.find((v) => v.imageUrl === url);

  const setImageStock = (url: string, stock: number) => {
    const existing = variantForImage(url);
    const updatedImageVariants = existing
      ? imageVariants.map((v) => (v.id === existing.id ? { ...v, stock } : v))
      : [...imageVariants, { id: newId(), sku: '', color: '', size: '', imageUrl: url, price: 0, stock }];
    onChange([...otherVariants, ...updatedImageVariants]);
  };

  const totalImageStock = imageVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const overAllocated = imageVariants.length > 0 && totalImageStock > productStock;

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.hint}>
          Use this instead of colors/sizes above if this product isn't meant to vary by either, but each photo should still have its own stock. Leave at 0 to skip a photo.
        </Text>
        {imageVariants.length > 0 && (
          <View style={[styles.stockBadge, overAllocated && styles.stockBadgeError]}>
            {overAllocated && <AlertTriangle size={11} color={colors.rose600} />}
            <Text style={[styles.stockBadgeText, overAllocated && styles.stockBadgeTextError]}>
              {totalImageStock} / {productStock} stock allocated
            </Text>
          </View>
        )}
      </View>
      {overAllocated && (
        <Text style={styles.overAllocatedHint}>
          Per-image stock adds up to more than the product's total stock ({productStock}). Lower some image stock, or raise the product's total stock above, before saving.
        </Text>
      )}
      {images.map((url) => {
        const variant = variantForImage(url);
        const stock = variant?.stock ?? 0;
        return (
          <View key={url} style={styles.row}>
            <Image source={{ uri: url }} style={styles.thumb} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.fieldLabel}>Stock for this photo</Text>
              <TextField
                value={stock ? String(stock) : ''}
                onChangeText={(t) => setImageStock(url, Number(t) || 0)}
                placeholder="0"
                keyboardType="numeric"
              />
              {stock > 0 && <Text style={styles.customBadge}>{stock} in stock</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  hint: { fontSize: 11.5, color: colors.slate600, flex: 1, lineHeight: 16 },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.slate100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stockBadgeError: { backgroundColor: colors.rose50 },
  stockBadgeText: { fontSize: 11, fontWeight: '800', color: colors.slate600 },
  stockBadgeTextError: { color: colors.rose600 },
  overAllocatedHint: { fontSize: 11.5, color: colors.rose600, marginBottom: 10, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: colors.slate200, borderRadius: 14, padding: 10, marginBottom: 10 },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: colors.slate600 },
  customBadge: { fontSize: 10, fontWeight: '800', color: colors.accentText },
});

export default AdminImageStockManager;
