import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Switch, Alert, ActivityIndicator, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import { X, Plus, Camera, Image as ImageIcon, Video as VideoIcon, File as FileIcon, Play, Star } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchProduct, createProduct, updateProduct, deleteProduct, uploadFile, fetchCategories } from '../../api/admin';
import { ProductVariant, Category } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, FieldLabel, TextField, Button, SectionTitle } from '../../components/admin/ui';
import AdminVariantManager from '../../components/admin/AdminVariantManager';
import AdminImageStockManager from '../../components/admin/AdminImageStockManager';
import AdminImageDetailsManager from '../../components/admin/AdminImageDetailsManager';
import AttachmentSourceSheet from '../../components/AttachmentSourceSheet';
import type { AdminProductsStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminProductsStackParamList, 'ProductForm'>;

const AdminProductFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { productId } = route.params;
  const isEditing = !!productId;
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [stock, setStock] = useState('');
  const [featured, setFeatured] = useState(false);
  const [groupBuyEnabled, setGroupBuyEnabled] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  // Subset of `images` chosen as the card/listing thumbnail(s) - independent of variants, so it
  // works even for a product with no color/size/image-stock variants at all.
  const [thumbnailImages, setThumbnailImages] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [colorImages, setColorImages] = useState<Record<string, string>>({});
  const [imageDetails, setImageDetails] = useState<Record<string, { name?: string; description?: string }>>({});
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isImageSheetVisible, setIsImageSheetVisible] = useState(false);
  const [isVideoSheetVisible, setIsVideoSheetVisible] = useState(false);

  useEffect(() => {
    fetchCategories().then(({ categories: c }) => {
      setCategories(c);
      if (!category && c.length > 0) setCategory(c[0].name);
    });
  }, []);

  useEffect(() => {
    if (!productId) return;
    fetchProduct(productId).then(({ product: p }) => {
      setName(p.name);
      setDescription(p.description);
      setPrice(String(p.price));
      setDiscount(p.discount ? String(p.discount) : '');
      setCategory(p.category);
      setSubCategory(p.subCategory);
      setStock(String(p.stock));
      setFeatured(!!p.featured);
      setGroupBuyEnabled(!!p.groupBuyEnabled);
      setImages(p.images);
      setThumbnailImages(p.thumbnailImages ?? []);
      setVideoUrls(p.videoUrls ?? []);
      setVariants(p.variants);
      setColorImages(p.colorImages ?? {});
      setImageDetails(p.imageDetails ?? {});
      setIsLoading(false);
    });
  }, [productId]);

  type PickedAsset = { uri: string; fileName?: string | null; mimeType?: string | null };

  const uploadAndAddImages = async (assets: PickedAsset[]) => {
    if (!token || assets.length === 0) return;
    setIsUploading(true);
    try {
      for (const asset of assets) {
        const fileName = asset.fileName ?? `product-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;
        const { url } = await uploadFile(asset.uri, fileName, asset.mimeType ?? 'image/jpeg', token);
        setImages((prev) => [...prev, url]);
      }
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  // No explicit requestMediaLibraryPermissionsAsync() gate here on purpose - see
  // ProductDetailScreen.tsx's handlePickReviewImage for why: on iOS, launchImageLibraryAsync
  // opens the system PHPicker out-of-process and never needs library-wide access, and
  // pre-requesting that broader permission ourselves is what was actually failing in Expo Go
  // (a shared client app can't be granted full photo-library access, so the request silently
  // died with no Settings toggle to fix it). `allowsMultipleSelection` lets the admin grab a
  // whole batch of product photos in one trip through the picker instead of one at a time.
  const handlePickImagesFromLibrary = async () => {
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 10 });
    } catch {
      Alert.alert('Could not open photo library.');
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    await uploadAndAddImages(result.assets);
  };

  // Taking a photo IS a real hardware-access permission (unlike picking from the library), so it
  // still needs its own explicit request/Settings-fallback pattern.
  const handleTakeProductPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        Alert.alert(
          'Camera access is off',
          'You previously denied camera access. Turn it on in Settings to take a photo.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
        );
      } else {
        Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadAndAddImages([result.assets[0]]);
  };

  const uploadAndAddVideo = async (uri: string, fileName: string, mimeType: string) => {
    if (!token) return;
    setIsUploadingVideo(true);
    try {
      const { url } = await uploadFile(uri, fileName, mimeType, token);
      setVideoUrls((prev) => [...prev, url]);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload video.');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handlePickVideoFromLibrary = async () => {
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    } catch {
      Alert.alert('Could not open video library.');
      return;
    }
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadAndAddVideo(asset.uri, asset.fileName ?? `product-video-${Date.now()}.mp4`, asset.mimeType ?? 'video/mp4');
  };

  // Guards against calling getDocumentAsync a second time while a pick is already in flight - the
  // native module throws PickingInProgressException if invoked concurrently (see ChatScreen.tsx).
  const isPickingVideoFile = useRef(false);
  const handlePickVideoFile = async () => {
    if (isPickingVideoFile.current) return;
    isPickingVideoFile.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadAndAddVideo(file.uri, file.name, file.mimeType ?? 'video/mp4');
    } finally {
      isPickingVideoFile.current = false;
    }
  };

  const removeVideo = (url: string) => setVideoUrls((prev) => prev.filter((v) => v !== url));

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((i) => i !== url));
    // An image that's removed can no longer back a color's gallery-jump photo.
    setColorImages((prev) => {
      const next = { ...prev };
      for (const color of Object.keys(next)) if (next[color] === url) delete next[color];
      return next;
    });
    setThumbnailImages((prev) => prev.filter((u) => u !== url));
  };

  const toggleThumbnailImage = (url: string) => {
    setThumbnailImages((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  };

  // Ports the same taxonomy the customer Shop screen filters against (Category.sections[].items) -
  // picking a category here narrows the sub-category picker to that category's admin-curated
  // list instead of leaving it as free text the admin has to remember/retype correctly.
  const selectedCategoryData = categories.find((c) => c.name === category);
  const subCategoryOptions = selectedCategoryData
    ? [...new Set(selectedCategoryData.sections.flatMap((s) => s.items))]
    : [];
  // A subCategory typed before this picker existed (or on a category with no sections configured
  // yet) might not be in that curated list - keep it selectable instead of silently dropping it.
  const subCategoryChoices = subCategory && !subCategoryOptions.includes(subCategory)
    ? [subCategory, ...subCategoryOptions]
    : subCategoryOptions;

  const handleSelectCategory = (nextCategory: string) => {
    setCategory(nextCategory);
    const nextSections = categories.find((c) => c.name === nextCategory)?.sections ?? [];
    const nextItems = new Set(nextSections.flatMap((s) => s.items));
    if (!nextItems.has(subCategory)) setSubCategory('');
  };

  // Ports frontend/pages/AdminManageProducts.tsx's validateAddForm exactly - the backend schema
  // itself is far more permissive (allows a blank description, zero images, price/discount 0),
  // so matching just the backend wouldn't actually match the website's real create-flow rules.
  const handleSave = async () => {
    if (!token) return;
    const errors: string[] = [];
    if (!name.trim()) errors.push('Product name is required.');
    if (!description.trim()) errors.push('Product description is required.');
    if (!category) errors.push('Category is required.');
    if (!subCategory.trim()) errors.push('Sub-category is required.');
    if (images.length === 0) errors.push('At least one product image is required.');
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) errors.push('Valid price is required.');
    const stockNum = parseInt(stock, 10);
    if (isNaN(stockNum) || stockNum < 0) errors.push('Valid stock quantity is required.');
    const discountNum = discount.trim() ? parseFloat(discount) : 0;
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) errors.push('Discount must be between 0 and 100.');
    // Variant stock is a breakdown of the product's total stock, so it can't add up to more.
    const variantStockTotal = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    if (!isNaN(stockNum) && variantStockTotal > stockNum) {
      errors.push(`Variant stock adds up to ${variantStockTotal}, more than the product's total stock (${stockNum}).`);
    }
    if (errors.length > 0) {
      Alert.alert('Please fix the following', errors.join('\n\n'));
      return;
    }
    setIsSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: priceNum,
      discount: discountNum,
      category,
      subCategory: subCategory.trim(),
      stock: stockNum,
      featured,
      images,
      thumbnailImages,
      videoUrls,
      colorImages,
      imageDetails,
      groupBuyEnabled,
      variants: variants
        .filter((v) => v.color || v.size || v.imageUrl)
        .map((v) => ({ sku: v.sku, color: v.color, size: v.size, imageUrl: v.imageUrl, price: Number(v.price) || 0, stock: Number(v.stock) || 0 })),
    };
    try {
      if (isEditing) await updateProduct(productId!, payload, token);
      else await createProduct(payload, token);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save product.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete product', 'This cannot be undone. Delete this product permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!token || !productId) return;
          await deleteProduct(productId, token);
          navigation.goBack();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionTitle>Images</SectionTitle>
      {images.length > 0 && (
        <Text style={styles.variantHint}>Tap the star on one or more photos to use them as this product's card/listing thumbnail. None selected uses the first photo.</Text>
      )}
      <View style={styles.imageRow}>
        {images.map((url) => {
          const isThumbnail = thumbnailImages.includes(url);
          return (
            <View key={url} style={styles.imageWrap}>
              <Image source={{ uri: url }} style={[styles.image, isThumbnail && styles.imageThumbnailSelected]} />
              <TouchableOpacity
                style={[styles.imageStar, isThumbnail && styles.imageStarActive]}
                onPress={() => toggleThumbnailImage(url)}
              >
                <Star size={12} color={isThumbnail ? colors.white : colors.slate400} fill={isThumbnail ? colors.white : 'none'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageRemove} onPress={() => removeImage(url)}>
                <X size={12} color={colors.white} />
              </TouchableOpacity>
            </View>
          );
        })}
        <TouchableOpacity style={styles.addImageButton} onPress={() => setIsImageSheetVisible(true)} disabled={isUploading}>
          {isUploading ? <ActivityIndicator color={colors.emerald800} /> : <Plus size={22} color={colors.emerald800} />}
        </TouchableOpacity>
      </View>

      <SectionTitle style={{ marginTop: 20 }}>Videos</SectionTitle>
      <Card>
        {videoUrls.map((url) => (
          <View key={url} style={styles.videoRow}>
            <View style={styles.videoIconWrap}><Play size={16} color={colors.white} fill={colors.white} /></View>
            <Text style={styles.videoUrlText} numberOfLines={1}>{url.split('/').pop()}</Text>
            <TouchableOpacity onPress={() => removeVideo(url)} style={styles.variantRemove}>
              <X size={16} color={colors.rose500} />
            </TouchableOpacity>
          </View>
        ))}
        <Button
          label={isUploadingVideo ? 'Uploading...' : 'Add Video'}
          variant="secondary"
          onPress={() => setIsVideoSheetVisible(true)}
          disabled={isUploadingVideo}
          loading={isUploadingVideo}
        />
      </Card>

      <SectionTitle style={{ marginTop: 20 }}>Details</SectionTitle>
      <Card>
        <FieldLabel>Name</FieldLabel>
        <TextField value={name} onChangeText={setName} placeholder="Product name" />
        <FieldLabel>Description</FieldLabel>
        <TextField value={description} onChangeText={setDescription} placeholder="Product description" multiline numberOfLines={4} style={{ height: 90, textAlignVertical: 'top' }} />

        <FieldLabel>Category</FieldLabel>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={category} onValueChange={handleSelectCategory} mode="dropdown">
            {categories.map((c) => <Picker.Item key={c.id} label={c.name} value={c.name} />)}
          </Picker>
        </View>
        <FieldLabel>Sub-category</FieldLabel>
        {subCategoryOptions.length > 0 ? (
          <View style={styles.pickerWrap}>
            <Picker selectedValue={subCategory} onValueChange={setSubCategory} mode="dropdown">
              <Picker.Item label="Select a sub-category..." value="" />
              {subCategoryChoices.map((item) => <Picker.Item key={item} label={item} value={item} />)}
            </Picker>
          </View>
        ) : (
          <TextField value={subCategory} onChangeText={setSubCategory} placeholder="e.g. Smartphones" />
        )}
        {selectedCategoryData && subCategoryOptions.length === 0 && (
          <Text style={styles.variantHint}>
            "{category}" has no sub-categories configured yet - add some under Categories, or type one here.
          </Text>
        )}

        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <FieldLabel>Price (RWF)</FieldLabel>
            <TextField value={price} onChangeText={setPrice} placeholder="0" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel>Discount %</FieldLabel>
            <TextField value={discount} onChangeText={setDiscount} placeholder="0" keyboardType="numeric" />
          </View>
        </View>
        <FieldLabel>Stock</FieldLabel>
        <TextField value={stock} onChangeText={setStock} placeholder="0" keyboardType="numeric" />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Featured product</Text>
          <Switch value={featured} onValueChange={setFeatured} trackColor={{ true: colors.emerald800, false: colors.slate200 }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Allow group buying</Text>
          <Switch value={groupBuyEnabled} onValueChange={setGroupBuyEnabled} trackColor={{ true: colors.emerald800, false: colors.slate200 }} />
        </View>
      </Card>

      <SectionTitle style={{ marginTop: 20 }}>Variants</SectionTitle>
      <AdminVariantManager
        variants={variants}
        onChange={setVariants}
        images={images}
        colorImages={colorImages}
        onColorImagesChange={setColorImages}
        productStock={parseInt(stock, 10) || 0}
      />

      <SectionTitle style={{ marginTop: 20 }}>Per-image stock</SectionTitle>
      <AdminImageStockManager
        images={images}
        variants={variants}
        onChange={setVariants}
        productStock={parseInt(stock, 10) || 0}
      />

      <SectionTitle style={{ marginTop: 20 }}>Photo details</SectionTitle>
      <AdminImageDetailsManager
        images={images}
        imageDetails={imageDetails}
        onChange={setImageDetails}
        defaultName={name || 'Product name'}
        defaultDescription={description}
      />

      <Button label={isEditing ? 'Save Changes' : 'Create Product'} onPress={handleSave} loading={isSaving} style={{ marginTop: 24 }} />
      {isEditing && <Button label="Delete Product" variant="danger" onPress={handleDelete} style={{ marginTop: 12 }} />}
    </ScrollView>

    <AttachmentSourceSheet
      visible={isImageSheetVisible}
      title="Add Product Photos"
      onClose={() => setIsImageSheetVisible(false)}
      options={[
        { key: 'library', label: 'Photo Library', Icon: ImageIcon, onSelect: handlePickImagesFromLibrary },
        { key: 'camera', label: 'Take Photo', Icon: Camera, onSelect: handleTakeProductPhoto },
      ]}
    />
    <AttachmentSourceSheet
      visible={isVideoSheetVisible}
      title="Add Product Video"
      onClose={() => setIsVideoSheetVisible(false)}
      options={[
        { key: 'library', label: 'Video Library', Icon: VideoIcon, onSelect: handlePickVideoFromLibrary },
        { key: 'file', label: 'Choose File', Icon: FileIcon, onSelect: handlePickVideoFile },
      ]}
    />
    </>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageWrap: { position: 'relative' },
  image: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100 },
  imageThumbnailSelected: { borderWidth: 2, borderColor: colors.amber800 },
  imageRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.rose500, alignItems: 'center', justifyContent: 'center' },
  imageStar: { position: 'absolute', bottom: -6, left: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  imageStarActive: { backgroundColor: colors.amber800, borderColor: colors.amber800 },
  addImageButton: { width: 72, height: 72, borderRadius: 12, borderWidth: 2, borderColor: colors.emerald800, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  pickerWrap: { marginHorizontal: -8, borderWidth: 1, borderColor: colors.slate200, borderRadius: 12 },
  rowGap: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  variantRemove: { padding: 6 },
  variantHint: { fontSize: 11.5, color: colors.slate400, marginBottom: 10, lineHeight: 16 },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  videoIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.slate800, alignItems: 'center', justifyContent: 'center' },
  videoUrlText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.slate700 },
});

export default AdminProductFormScreen;
