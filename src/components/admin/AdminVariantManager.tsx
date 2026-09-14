import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Plus, Trash2, Wand2, Check, PackageX, AlertTriangle } from 'lucide-react-native';
import { ProductVariant } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Button, TextField } from './ui';

// Matches frontend/constants.ts's AVAILABLE_COLORS exactly - the bulk generator's color palette.
const AVAILABLE_COLORS = ['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Purple', 'Orange', 'Pink', 'Grey'];

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface AdminVariantManagerProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  /** Already-uploaded product image URLs, offered as the pool to assign a photo from. */
  images: string[];
  /** Maps a variant color to one of `images` - see Product.colorImages. */
  colorImages: Record<string, string>;
  onColorImagesChange: (colorImages: Record<string, string>) => void;
  /** The product's own overall stock count - variant stock is a breakdown of it, so it can never
   * add up to more than this. */
  productStock: number;
}

// Ports frontend/components/AdminVariantManager.tsx 1:1: a bulk generator (pick colors + a
// comma-separated size list, expand into the full color x size matrix in one shot) above a
// per-color grouped editor, instead of a flat "add one variant row at a time" list.
const AdminVariantManager: React.FC<AdminVariantManagerProps> = ({ variants, onChange, images, colorImages, onColorImagesChange, productStock }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [selectedBulkColors, setSelectedBulkColors] = useState<string[]>([]);
  const [bulkSizes, setBulkSizes] = useState('');
  const [newColorName, setNewColorName] = useState('');

  const toggleBulkColor = (color: string) => {
    setSelectedBulkColors((prev) => (prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]));
  };

  const generateVariants = () => {
    const sizes = bulkSizes.split(',').map((s) => s.trim()).filter((s) => s !== '');
    if (selectedBulkColors.length === 0 || sizes.length === 0) return;
    const generated: ProductVariant[] = [];
    selectedBulkColors.forEach((color) => {
      sizes.forEach((size) => {
        generated.push({ id: newId(), sku: `${color}-${size}-${Date.now()}`, color, size, price: 0, stock: 0 });
      });
    });
    onChange([...variants, ...generated]);
    setSelectedBulkColors([]);
    setBulkSizes('');
  };

  // Keyed by variant id (not array index) so removing one row elsewhere, or a grouped-by-color
  // re-render, can never shift which row an edit lands on.
  const updateVariant = (id: string, patch: Partial<ProductVariant>) =>
    onChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const removeVariant = (id: string) => onChange(variants.filter((v) => v.id !== id));

  const addSizeToColor = (color: string) => onChange([...variants, { id: newId(), sku: '', color, size: '', price: 0, stock: 0 }]);

  const addNewColor = () => {
    const color = newColorName.trim();
    if (!color) return;
    onChange([...variants, { id: newId(), sku: '', color, size: '', price: 0, stock: 0 }]);
    setNewColorName('');
  };

  const removeColor = (color: string) => {
    onChange(variants.filter((v) => (v.color ?? '') !== color));
    if (colorImages[color]) {
      const rest = { ...colorImages };
      delete rest[color];
      onColorImagesChange(rest);
    }
  };

  const setColorImage = (color: string, url: string) => onColorImagesChange({ ...colorImages, [color]: url });

  // Grouped by color, in first-appearance order, so bulk-generated colors don't reshuffle as
  // their rows are edited. Variants with no color (a plain size-only product, or one mid-edit)
  // fall into their own bucket below rather than being lost.
  const colorOrder: string[] = [];
  const grouped = new Map<string, ProductVariant[]>();
  const uncategorized: ProductVariant[] = [];
  variants.forEach((v) => {
    const color = (v.color ?? '').trim();
    if (!color) {
      uncategorized.push(v);
      return;
    }
    if (!grouped.has(color)) {
      grouped.set(color, []);
      colorOrder.push(color);
    }
    grouped.get(color)!.push(v);
  });

  const totalVariantStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const overAllocated = totalVariantStock > productStock;

  return (
    <View>
      {/* Bulk Generator */}
      <View style={styles.bulkCard}>
        <View style={styles.bulkHeader}>
          <Wand2 size={15} color={colors.emerald800} />
          <Text style={styles.bulkTitle}>Bulk Generate Variants</Text>
        </View>
        <Text style={styles.bulkLabel}>Select Colors</Text>
        <View style={styles.chipRow}>
          {AVAILABLE_COLORS.map((color) => {
            const selected = selectedBulkColors.includes(color);
            return (
              <TouchableOpacity key={color} style={[styles.colorChip, selected && styles.colorChipSelected]} onPress={() => toggleBulkColor(color)}>
                <Text style={[styles.colorChipText, selected && styles.colorChipTextSelected]}>{color}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.bulkLabel}>Sizes (comma separated: S, M, L or 40, 41)</Text>
        <TextField value={bulkSizes} onChangeText={setBulkSizes} placeholder="e.g., S, M, L" autoCapitalize="characters" />
        <Button
          label="Generate Variants"
          onPress={generateVariants}
          disabled={selectedBulkColors.length === 0 || !bulkSizes.trim()}
          style={{ marginTop: 12 }}
        />
      </View>

      {/* Grouped by color - each card owns its sizes, stock, and representative photo together */}
      <View style={{ marginTop: 20 }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Product Variants</Text>
          {variants.length > 0 && (
            <View style={[styles.stockBadge, overAllocated && styles.stockBadgeError]}>
              {overAllocated && <AlertTriangle size={11} color={colors.rose600} />}
              <Text style={[styles.stockBadgeText, overAllocated && styles.stockBadgeTextError]}>
                {totalVariantStock} / {productStock} stock allocated
              </Text>
            </View>
          )}
        </View>
        {overAllocated && (
          <Text style={styles.overAllocatedHint}>
            Variant stock adds up to more than the product's total stock ({productStock}). Lower some variant stock, or raise the product's total stock above, before saving.
          </Text>
        )}

        {colorOrder.length === 0 && uncategorized.length === 0 && (
          <Text style={styles.emptyHint}>No variants yet - use Bulk Generate above, or add a color below.</Text>
        )}

        {colorOrder.map((color) => {
          const colorVariants = grouped.get(color)!;
          const totalStock = colorVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
          return (
            <View key={color} style={styles.colorCard}>
              <View style={styles.colorCardHeader}>
                <View style={styles.colorCardHeaderLeft}>
                  <Text style={styles.colorName} numberOfLines={1}>{color}</Text>
                  <View style={[styles.inStockBadge, totalStock <= 0 && styles.outStockBadge]}>
                    {totalStock <= 0 && <PackageX size={10} color={colors.rose600} />}
                    <Text style={[styles.inStockBadgeText, totalStock <= 0 && styles.outStockBadgeText]}>
                      {totalStock > 0 ? `${totalStock} in stock` : 'Out of stock'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.removeColorButton} onPress={() => removeColor(color)}>
                  <Trash2 size={13} color={colors.rose500} />
                  <Text style={styles.removeColorText}>Remove color</Text>
                </TouchableOpacity>
              </View>

              {images.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.photoLabel}>Photo shown when a customer picks {color}</Text>
                  <View style={styles.photoRow}>
                    {images.map((url) => {
                      const isSelected = colorImages[color] === url;
                      return (
                        <TouchableOpacity key={url} onPress={() => setColorImage(color, url)} style={[styles.photoThumbWrap, isSelected && styles.photoThumbSelected]}>
                          <Image source={{ uri: url }} style={styles.photoThumb} />
                          {isSelected && (
                            <View style={styles.photoCheckOverlay}>
                              <Check size={16} color={colors.white} strokeWidth={3} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <Text style={styles.noImagesHint}>Upload product images above to assign one to this color.</Text>
              )}

              <View style={{ marginTop: 12 }}>
                <Text style={styles.photoLabel}>Sizes, price &amp; stock</Text>
                {colorVariants.map((variant) => (
                  <View key={variant.id} style={styles.variantRow}>
                    <TextField style={styles.variantInput} value={variant.size ?? ''} onChangeText={(t) => updateVariant(variant.id, { size: t })} placeholder="Size" />
                    <TextField style={styles.variantInputSmall} value={variant.price ? String(variant.price) : ''} onChangeText={(t) => updateVariant(variant.id, { price: Number(t) || 0 })} placeholder="Price" keyboardType="numeric" />
                    <TextField style={styles.variantInputSmall} value={variant.stock ? String(variant.stock) : ''} onChangeText={(t) => updateVariant(variant.id, { stock: Number(t) || 0 })} placeholder="Stock" keyboardType="numeric" />
                    <TouchableOpacity onPress={() => removeVariant(variant.id)} style={styles.variantRemove}>
                      <Trash2 size={16} color={colors.rose500} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addSizeButton} onPress={() => addSizeToColor(color)}>
                  <Plus size={14} color={colors.accentText} />
                  <Text style={styles.addSizeText}>Add size</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Variants with no color set - a plain size-only product, or a row still being filled in */}
        {uncategorized.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.uncategorizedHeading}>Sizes without a color</Text>
            {uncategorized.map((variant) => (
              <View key={variant.id} style={styles.variantRow}>
                <TextField style={styles.variantInput} value={variant.color ?? ''} onChangeText={(t) => updateVariant(variant.id, { color: t })} placeholder="Color" />
                <TextField style={styles.variantInput} value={variant.size ?? ''} onChangeText={(t) => updateVariant(variant.id, { size: t })} placeholder="Size" />
                <TextField style={styles.variantInputSmall} value={variant.price ? String(variant.price) : ''} onChangeText={(t) => updateVariant(variant.id, { price: Number(t) || 0 })} placeholder="Price" keyboardType="numeric" />
                <TextField style={styles.variantInputSmall} value={variant.stock ? String(variant.stock) : ''} onChangeText={(t) => updateVariant(variant.id, { stock: Number(t) || 0 })} placeholder="Stock" keyboardType="numeric" />
                <TouchableOpacity onPress={() => removeVariant(variant.id)} style={styles.variantRemove}>
                  <Trash2 size={16} color={colors.rose500} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add a brand new color */}
        <View style={styles.addColorRow}>
          <TextField style={{ flex: 1 }} value={newColorName} onChangeText={setNewColorName} placeholder="New color name (e.g. Maroon)" />
          <TouchableOpacity style={styles.addColorButton} onPress={addNewColor}>
            <Plus size={16} color={colors.slate700} />
            <Text style={styles.addColorButtonText}>Add color</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  bulkCard: {
    backgroundColor: colors.emerald50, borderWidth: 1, borderColor: colors.emerald100, borderRadius: 16, padding: 14,
  },
  bulkHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  bulkTitle: { fontSize: 13, fontWeight: '800', color: colors.emerald800 },
  bulkLabel: { fontSize: 11.5, fontWeight: '700', color: colors.emerald800, marginBottom: 6, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  colorChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.emerald100 },
  colorChipSelected: { backgroundColor: colors.emerald800, borderColor: colors.emerald800 },
  colorChipText: { fontSize: 11.5, fontWeight: '700', color: colors.emerald800 },
  colorChipTextSelected: { color: colors.white },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  sectionHeading: { fontSize: 13, fontWeight: '800', color: colors.slate700 },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.slate100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stockBadgeError: { backgroundColor: colors.rose50 },
  stockBadgeText: { fontSize: 11, fontWeight: '800', color: colors.slate600 },
  stockBadgeTextError: { color: colors.rose600 },
  overAllocatedHint: { fontSize: 11.5, color: colors.rose600, marginBottom: 10, lineHeight: 16 },
  emptyHint: { fontSize: 12, color: colors.slate600, marginBottom: 8 },
  colorCard: { borderWidth: 1, borderColor: colors.slate200, borderRadius: 16, padding: 14, marginBottom: 12 },
  colorCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  colorCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  colorName: { fontSize: 14, fontWeight: '800', color: colors.slate900, flexShrink: 1 },
  inStockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.emerald50, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  outStockBadge: { backgroundColor: colors.rose50 },
  inStockBadgeText: { fontSize: 9.5, fontWeight: '800', color: colors.accentText },
  outStockBadgeText: { color: colors.rose600 },
  removeColorButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removeColorText: { fontSize: 11.5, fontWeight: '700', color: colors.rose500 },
  photoLabel: { fontSize: 11.5, color: colors.slate600, marginBottom: 8 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumbWrap: { borderRadius: 10, borderWidth: 2, borderColor: colors.slate200, overflow: 'hidden' },
  photoThumbSelected: { borderColor: colors.emerald600 },
  photoThumb: { width: 44, height: 44, backgroundColor: colors.white },
  photoCheckOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,95,70,0.4)', alignItems: 'center', justifyContent: 'center' },
  noImagesHint: { fontSize: 11.5, color: colors.amber800, marginTop: 10 },
  variantRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  variantInput: { flex: 1 },
  variantInputSmall: { width: 64 },
  variantRemove: { padding: 6 },
  addSizeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  addSizeText: { fontSize: 12, fontWeight: '800', color: colors.accentText },
  uncategorizedHeading: { fontSize: 11.5, fontWeight: '800', color: colors.slate600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  addColorRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addColorButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.slate100, borderRadius: 12,
    paddingHorizontal: 14, justifyContent: 'center',
  },
  addColorButtonText: { fontSize: 12.5, fontWeight: '800', color: colors.slate700 },
});

export default AdminVariantManager;
