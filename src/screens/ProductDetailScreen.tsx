import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity, TextInput, Alert, FlatList, StyleProp, ViewStyle,
  PanResponder,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Heart, Star, ShoppingCart, Users, BellRing, Play, Camera, X as XIcon, ChevronLeft, ChevronRight, Volume2, VolumeX, Plus, Minus } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../api/client';
import { submitReview, fetchAlsoBought, requestRestockNotification, uploadReviewImage, deleteUploadedFile } from '../api/customer';
import { ApiError } from '../api/client';
import { Product } from '../types';
import { getProductThumbnail } from '../utils/productImage';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useGuestMode } from '../context/GuestModeContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Button } from '../components/admin/ui';
import ProductCard from '../components/customer/ProductCard';
import type { CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'ProductDetail'>;
type Tab = 'description' | 'reviews';

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const screenWidth = Dimensions.get('window').width;
// Matches frontend/pages/ProductDetail.tsx's SWIPE_THRESHOLD_PX exactly.
const SWIPE_THRESHOLD_PX = 50;

// Ports frontend/pages/ProductDetail.tsx's video player: `controls`/`autoPlay`/`playsInline` - a
// fresh player per video (keyed by uri from the caller) so switching videos restarts playback,
// matching the website's `key={url}` remount trick. The website's player is a plain HTML5 <video>,
// whose native browser controls already include a mute/volume icon; expo-video's nativeControls
// don't expose one on either platform, so this adds its own overlay button doing the same thing.
const ProductVideoPlayer: React.FC<{ uri: string; style: StyleProp<ViewStyle> }> = ({ uri, style }) => {
  const [isMuted, setIsMuted] = useState(false);
  const player = useVideoPlayer(uri, (p) => { p.play(); });
  useEffect(() => { player.muted = isMuted; }, [player, isMuted]);
  return (
    <View style={style}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />
      <TouchableOpacity
        style={videoPlayerStyles.muteButton}
        onPress={() => setIsMuted((m) => !m)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {isMuted ? <VolumeX size={16} color="#fff" /> : <Volume2 size={16} color="#fff" />}
      </TouchableOpacity>
    </View>
  );
};

const videoPlayerStyles = StyleSheet.create({
  muteButton: {
    position: 'absolute', bottom: 12, right: 12, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
});

const ProductDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const { requestSignIn } = useGuestMode();
  const { addToCart } = useCart();
  const { productIds, toggleWishlist } = useWishlist();
  const styles = createStyles(colors);
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [alsoBought, setAlsoBought] = useState<Product[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('description');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImageUrl, setReviewImageUrl] = useState<string | null>(null);
  const [isUploadingReviewImage, setIsUploadingReviewImage] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [restockEmail, setRestockEmail] = useState(user?.email ?? '');
  const [restockRequested, setRestockRequested] = useState(false);
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);

  // Matches the website (VariantSelector.tsx/ProductDetail.tsx): nothing is pre-selected on load -
  // the shopper picks a color and size manually, and add-to-cart is blocked until both are chosen
  // when the product has variants at all.
  const load = useCallback(() => {
    setSelectedColor(undefined);
    setSelectedSize(undefined);
    setQuantity(1);
    setActiveImage(0);
    setActiveVideoIndex(null);
    return Promise.all([
      apiFetch<{ product: Product }>(`/products/${productId}`).then(({ product: p }) => {
        setProduct(p);
        navigation.setOptions({ title: p.name });
        // Whichever photo is starred as this product's thumbnail is also where the gallery opens,
        // so what a shopper saw on the card matches what they see right after opening the product,
        // instead of always defaulting to the first uploaded image regardless of what's starred.
        const thumb = getProductThumbnail(p);
        const idx = thumb ? p.images.indexOf(thumb) : -1;
        setActiveImage(idx >= 0 ? idx : 0);
      }),
      apiFetch<{ products: Product[] }>('/products').then(({ products }) => setAllProducts(products)),
      fetchAlsoBought(productId).then(({ products }) => setAlsoBought(products)).catch(() => setAlsoBought([])),
    ]).catch(() => setLoadError(t('mobile_could_not_load_product')));
  }, [productId, t, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Auto-clears a size that's no longer valid once a different color is picked (e.g. size "M" was
  // in stock for Red but not for Blue) - matches VariantSelector.tsx's clear-on-color-change effect,
  // which runs before the variant-resolution effect so a stale invalid pair never briefly resolves.
  useEffect(() => {
    if (!product || !selectedColor || !selectedSize) return;
    const variant = product.variants.find((v) => v.color === selectedColor && v.size === selectedSize);
    if (!variant || variant.stock <= 0) setSelectedSize(undefined);
  }, [selectedColor, product]);

  // Matches frontend/pages/ProductDetail.tsx: switching to a different color/size (or, for a
  // per-image-stock product, a different photo) resets the quantity back to 1 rather than
  // carrying over whatever was dialed in for the previous variant - carrying it over reads as if
  // that quantity was already confirmed for the newly-selected variant, which it never was. The
  // image part is written inline (not via a named variable) since `product` may still be null
  // here, before this component's early returns above.
  useEffect(() => {
    setQuantity(1);
  }, [selectedColor, selectedSize, product?.variants?.some((v) => v.imageUrl) ? product.images[activeImage] : null]);

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  const availableColors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))] as string[];
  const availableSizes = [...new Set(product.variants.map((v) => v.size).filter(Boolean))] as string[];

  // A color is only disabled once EVERY size it comes in is out of stock (summed across sizes) -
  // matches VariantSelector.tsx's colorStock. A size, once a color is picked, is disabled only for
  // that specific color+size combo's own stock, even if the same size has stock under another color.
  const colorStock = (color: string) => product.variants.filter((v) => v.color === color).reduce((sum, v) => sum + v.stock, 0);
  const isColorDisabled = (color: string) => colorStock(color) <= 0;
  const sizeVariantForSelectedColor = (size: string) =>
    selectedColor ? product.variants.find((v) => v.color === selectedColor && v.size === size) : undefined;
  const isSizeDisabled = (size: string) => {
    if (!selectedColor) return false;
    const variant = sizeVariantForSelectedColor(size);
    return !variant || variant.stock <= 0;
  };

  // Only meaningful when the product actually has color/size variants - `!availableColors.length`
  // and `!availableSizes.length` are both trivially true for a per-image-stock-only product (zero
  // colors AND zero sizes configured), which made .find() return the *first* variant in the array
  // unconditionally regardless of which photo was on screen, silently bypassing imageStockVariant
  // below for price/stock everywhere it's used (display AND what's actually charged at checkout).
  const hasAnyColorOrSize = availableColors.length > 0 || availableSizes.length > 0;
  const matchedVariant = hasAnyColorOrSize
    ? product.variants.find((v) => (!availableColors.length || v.color === selectedColor) && (!availableSizes.length || v.size === selectedSize))
    : undefined;
  const requiresSelection = hasAnyColorOrSize && !matchedVariant;

  // An alternative to color/size variants for a product that isn't meant to vary by either, but
  // still has per-photo stock (AdminImageStockManager) - the gallery itself is the picker, so
  // whichever photo is currently on screen (`currentImage`) IS the selection.
  const currentImage = product.images[activeImage];
  // Per-image stock is "instead of" color/size (AdminImageStockManager's own framing) - a product
  // is meant to use exactly one of the two systems. If real color/size variants exist (derived the
  // same way availableColors/availableSizes above already do), any stray/leftover image-stock rows
  // must never affect display or purchase, so this only ever turns on when there are none.
  const hasColorSizeVariants = availableColors.length > 0 || availableSizes.length > 0;
  const hasImageStockVariants = !hasColorSizeVariants && product.variants.some((v) => v.imageUrl);
  const imageStockVariant = hasImageStockVariants ? product.variants.find((v) => v.imageUrl === currentImage) : undefined;

  // A variant price of 0 means "no override - inherit the product's base price", not "free" -
  // matches the website's own convention. Some real product data also has stray 1-2 RWF variant
  // "prices" from admin data-entry mistakes (the mobile admin's variant editor previously had no
  // price field at all, and even on the website a placeholder digit is an easy typo) - a price
  // that's under 10% of the product's base price is never a real, intentional override in this
  // catalog (nothing sells for a few RWF), so it's treated as unset too, same as 0.
  const effectivePriceOf = (price: number) => (price > product.price * 0.1 ? price : product.price);
  const hasDiscount = !!product.discount && product.discount > 0;
  const discounted = (price: number) => (hasDiscount ? price * (1 - product.discount! / 100) : price);

  const effectiveStock = matchedVariant?.stock ?? imageStockVariant?.stock ?? product.stock;
  const isOutOfStock = effectiveStock <= 0;
  const isWishlisted = productIds.includes(product.id);

  // Until both color and size are picked (when the product has variants), the website shows a
  // price RANGE across every variant's effective price rather than a single number.
  const variantPrices = product.variants.length > 0 ? product.variants.map((v) => effectivePriceOf(v.price)) : [product.price];
  const minPrice = discounted(Math.min(...variantPrices));
  const maxPrice = discounted(Math.max(...variantPrices));
  const singlePrice = matchedVariant
    ? discounted(effectivePriceOf(matchedVariant.price))
    : imageStockVariant
    ? discounted(effectivePriceOf(imageStockVariant.price))
    : discounted(product.price);
  const effectivePrice = matchedVariant
    ? effectivePriceOf(matchedVariant.price)
    : imageStockVariant
    ? effectivePriceOf(imageStockVariant.price)
    : product.price;

  const similarProducts = allProducts.filter((p) => p.id !== product.id && p.subCategory === product.subCategory).slice(0, 6);

  // Ports frontend/pages/ProductDetail.tsx's handleColorChange: picking a color doesn't navigate
  // anywhere (there's no cross-product redirect on the website either - colors are variants of
  // ONE product) - it jumps the gallery to that color's photo via colorImages, and matches the
  // website's toggle-off-if-already-selected behavior (VariantSelector.tsx's onClick).
  const handleSelectColor = (color: string) => {
    if (isColorDisabled(color)) return;
    const nextColor = selectedColor === color ? undefined : color;
    setSelectedColor(nextColor);
    const image = nextColor ? product.colorImages?.[nextColor] : undefined;
    if (!image) return;
    const index = product.images.indexOf(image);
    if (index !== -1) setActiveImage(index);
  };

  const handleSelectSize = (size: string) => {
    if (isSizeDisabled(size)) return;
    setSelectedSize((prev) => (prev === size ? undefined : size));
  };

  // product.images[activeImage] is whatever photo is actually on screen right now - it already
  // reflects a color-variant jump (handleSelectColor moves activeImage to match) AND a product
  // with no variants at all where the shopper just tapped a different thumbnail (e.g. picking
  // "the second cap" among several plain photos with nothing else to hang that choice on) - so
  // using it here covers both cases with one read instead of needing separate logic for each.
  const handleAddToCart = () => {
    if (requiresSelection) {
      Alert.alert(t('detail_select_color_size'));
      return;
    }
    if (hasImageStockVariants && (!imageStockVariant || imageStockVariant.stock <= 0)) {
      Alert.alert(t('detail_photo_out_of_stock'));
      return;
    }
    addToCart(product.id, quantity, selectedColor, selectedSize, effectivePrice, product.images[activeImage]);
  };

  // Ports frontend/pages/ProductDetail.tsx's handleBuyNow exactly: it does NOT call addToCart at
  // all - it bypasses the persistent cart entirely and checks out this one item standalone
  // (navigate('/cart?step=2', {state: {directBuyProduct}}) on the website; here the same item is
  // carried through route params since React Navigation has no location.state equivalent).
  const handleBuyNow = () => {
    if (requiresSelection) {
      Alert.alert(t('detail_select_color_size'));
      return;
    }
    if (hasImageStockVariants && (!imageStockVariant || imageStockVariant.stock <= 0)) {
      Alert.alert(t('detail_photo_out_of_stock'));
      return;
    }
    navigation.navigate('CheckoutAddress', {
      directBuyItem: {
        productId: product.id,
        name: product.name,
        image: product.images[activeImage],
        price: effectivePrice,
        quantity,
        selectedColor,
        selectedSize,
      },
    });
  };

  // Ports frontend/components/ReviewForm.tsx exactly: rating and a non-empty comment are both
  // required, and the image is uploaded to POST /uploads the moment it's picked - submission
  // itself just sends the resulting URL. Failures land in `reviewError` (rendered inline next to
  // the form) rather than the screen-wide `loadError`, so a failed upload/submit doesn't wipe out
  // the whole product page.
  const handleSubmitReview = async () => {
    if (!token) {
      requestSignIn();
      return;
    }
    if (reviewRating === 0 || !reviewComment.trim()) {
      setReviewError('Please choose a rating and write a comment.');
      return;
    }
    setReviewError(null);
    setIsSubmittingReview(true);
    try {
      await submitReview(product.id, { rating: reviewRating, comment: reviewComment.trim(), image: reviewImageUrl ?? undefined }, token);
      setReviewComment('');
      setReviewRating(0);
      setReviewImageUrl(null);
      await load();
    } catch (e) {
      setReviewError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not submit your review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handlePickReviewImage = async () => {
    if (!token) {
      requestSignIn();
      return;
    }
    setReviewError(null);
    // No explicit requestMediaLibraryPermissionsAsync() gate here on purpose: on iOS,
    // launchImageLibraryAsync opens the system PHPicker, which runs out-of-process and hands the
    // app only the one photo picked - it doesn't need library-wide access at all. Pre-requesting
    // that broader permission ourselves was the actual bug (Expo Go can't grant a shared client
    // app full photo-library access, so the request silently died with no way to fix it from
    // Settings). Letting the picker launch directly avoids that permission entirely.
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    } catch {
      setReviewError('Could not open your photo library.');
      return;
    }
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setIsUploadingReviewImage(true);
    try {
      const { url } = await uploadReviewImage(asset.uri, asset.fileName ?? `review-${Date.now()}.jpg`, asset.mimeType ?? 'image/jpeg', token);
      setReviewImageUrl(url);
    } catch (e) {
      setReviewError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not upload image.');
    } finally {
      setIsUploadingReviewImage(false);
    }
  };

  const handleRemoveReviewImage = () => {
    if (token && reviewImageUrl) deleteUploadedFile(reviewImageUrl, token).catch(() => {});
    setReviewImageUrl(null);
  };

  const handleNotifyRestock = async () => {
    if (!restockEmail.trim()) return;
    setRestockError(null);
    setIsSubmittingRestock(true);
    try {
      await requestRestockNotification(product.id, { email: restockEmail.trim(), color: selectedColor, size: selectedSize });
      setRestockRequested(true);
    } catch (e) {
      setRestockError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not save your request.');
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  // Ports frontend/pages/ProductDetail.tsx's gallery swipe: images and videos share one ordered
  // sequence (images first, then videos) so "next"/"previous" means the same thing across both,
  // with wraparound at either end - same as the website's goToMediaIndex/handleGalleryTouchEnd.
  const mediaCount = product.images.length + (product.videoUrls?.length ?? 0);
  const activeMediaIndex = activeVideoIndex !== null ? product.images.length + activeVideoIndex : activeImage;
  const goToMediaIndex = (index: number) => {
    if (mediaCount === 0) return;
    const wrapped = ((index % mediaCount) + mediaCount) % mediaCount;
    if (wrapped < product.images.length) {
      setActiveImage(wrapped);
      setActiveVideoIndex(null);
    } else {
      setActiveVideoIndex(wrapped - product.images.length);
    }
  };
  // Admin-set name/description override for whichever photo is currently on screen, if any -
  // absent unless that specific image was deliberately customized (AdminImageDetailsManager).
  // Matches frontend/pages/ProductDetail.tsx's own activeImageDetail.
  const activeImageDetail = product.imageDetails?.[product.images[activeImage]];

  const galleryPanResponder = PanResponder.create({
    // Only claims the gesture once it's clearly horizontal and past a small threshold, so it
    // never fights the page's own vertical scroll or a tap on the heart button/video controls.
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < SWIPE_THRESHOLD_PX) return;
      goToMediaIndex(activeMediaIndex + (gesture.dx < 0 ? 1 : -1));
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.mainImageCard} {...galleryPanResponder.panHandlers}>
        {activeVideoIndex !== null && product.videoUrls?.[activeVideoIndex] ? (
          <ProductVideoPlayer key={product.videoUrls[activeVideoIndex]} uri={product.videoUrls[activeVideoIndex]} style={styles.mainImage} />
        ) : (
          <Image source={{ uri: product.images[activeImage] }} style={styles.mainImage} resizeMode="contain" />
        )}
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{product.discount}%</Text>
          </View>
        )}
        <TouchableOpacity style={styles.heartButton} onPress={() => toggleWishlist(product.id)}>
          <Heart size={20} color={isWishlisted ? colors.rose500 : colors.slate400} fill={isWishlisted ? colors.rose500 : 'none'} />
        </TouchableOpacity>
        {mediaCount > 1 && (
          <>
            <TouchableOpacity
              style={[styles.galleryNavButton, styles.galleryNavButtonLeft]}
              onPress={() => goToMediaIndex(activeMediaIndex - 1)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ChevronLeft size={20} color={colors.slate700} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.galleryNavButton, styles.galleryNavButtonRight]}
              onPress={() => goToMediaIndex(activeMediaIndex + 1)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ChevronRight size={20} color={colors.slate700} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Per-image name/description caption - an admin opt-in that only appears for a photo
          actually customized with one; everything else stays exactly as it was. */}
      {activeVideoIndex === null && (activeImageDetail?.name || activeImageDetail?.description) && (
        <View style={styles.imageCaption}>
          {!!activeImageDetail?.name && <Text style={styles.imageCaptionName}>{activeImageDetail.name}</Text>}
          {!!activeImageDetail?.description && <Text style={styles.imageCaptionDescription}>{activeImageDetail.description}</Text>}
        </View>
      )}

      {(product.images.length > 1 || (product.videoUrls?.length ?? 0) > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow} contentContainerStyle={{ gap: 8 }}>
          {product.images.map((img, i) => (
            <TouchableOpacity key={img} style={styles.thumbnailWrap} onPress={() => { setActiveImage(i); setActiveVideoIndex(null); }}>
              <Image
                source={{ uri: img }}
                style={[styles.thumbnail, activeVideoIndex === null && activeImage === i ? styles.thumbnailActive : styles.thumbnailInactive]}
              />
            </TouchableOpacity>
          ))}
          {(product.videoUrls ?? []).map((videoUrl, i) => (
            <TouchableOpacity key={videoUrl} onPress={() => setActiveVideoIndex(i)}>
              <View style={[styles.thumbnail, styles.videoThumbnail, activeVideoIndex === i ? styles.thumbnailActive : styles.thumbnailInactive]}>
                <Play size={20} color={colors.white} fill={colors.white} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Buy box: name, price/stock, variants, actions, group-buy/restock - mirrors the website's
          right-column layout order on ProductDetail.tsx (name -> price+stock -> variants ->
          qty/actions -> group-buy panel -> restock panel), all before the Description/Reviews tabs. */}
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { flex: 1 }]}>{product.name}</Text>
          <View style={styles.ratingPill}>
            <Star size={12} color={colors.orange500} fill={colors.orange500} />
            <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.priceStockRow}>
          <View style={styles.priceRow}>
            {matchedVariant || hasImageStockVariants || minPrice === maxPrice ? (
              <>
                <Text style={styles.price}>{formatPrice(singlePrice)}</Text>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>
                    {formatPrice(matchedVariant ? effectivePriceOf(matchedVariant.price) : imageStockVariant ? effectivePriceOf(imageStockVariant.price) : product.price)}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.price}>{formatPrice(minPrice)} - {formatPrice(maxPrice)}</Text>
            )}
          </View>
          <View style={[styles.stockPill, { backgroundColor: isOutOfStock ? colors.rose50 : colors.emerald50 }]}>
            <Text style={[styles.stockText, { color: isOutOfStock ? colors.rose500 : colors.accentText }]}>
              {isOutOfStock ? t('product_out_of_stock') : t('product_in_stock', { n: effectiveStock })}
            </Text>
          </View>
        </View>

        {availableColors.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.variantWrap}>
              {availableColors.map((color) => {
                const disabled = isColorDisabled(color);
                return (
                  <TouchableOpacity
                    key={color}
                    disabled={disabled}
                    style={[styles.variantChip, selectedColor === color && styles.variantChipActive, disabled && styles.variantChipDisabled]}
                    onPress={() => handleSelectColor(color)}
                  >
                    <Text style={[styles.variantChipText, selectedColor === color && styles.variantChipTextActive, disabled && styles.variantChipTextDisabled]}>
                      {color}{disabled ? ` (${t('product_out_of_stock')})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {availableSizes.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>Size</Text>
            <View style={styles.variantWrap}>
              {availableSizes.map((size) => {
                const disabled = isSizeDisabled(size);
                return (
                  <TouchableOpacity
                    key={size}
                    disabled={disabled}
                    style={[styles.variantChip, selectedSize === size && styles.variantChipActive, disabled && styles.variantChipDisabled]}
                    onPress={() => handleSelectSize(size)}
                  >
                    <Text style={[styles.variantChipText, selectedSize === size && styles.variantChipTextActive, disabled && styles.variantChipTextDisabled]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {!isOutOfStock && (
          <View style={styles.quantityStepperWrap}>
            <TouchableOpacity
              style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
              disabled={quantity <= 1}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus size={18} color={quantity <= 1 ? colors.slate400 : colors.slate700} />
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={[styles.quantityButton, quantity >= effectiveStock && styles.quantityButtonDisabled]}
              disabled={quantity >= effectiveStock}
              onPress={() => setQuantity((q) => Math.min(effectiveStock, q + 1))}
            >
              <Plus size={18} color={quantity >= effectiveStock ? colors.slate400 : colors.slate700} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.addToCartButton, isOutOfStock && styles.buttonDisabled]}
            disabled={isOutOfStock}
            onPress={handleAddToCart}
          >
            <ShoppingCart size={16} color={colors.white} />
            <Text style={styles.addToCartText} numberOfLines={1}>{t('product_add_to_cart')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buyNowButton, isOutOfStock && styles.buttonDisabled]}
            disabled={isOutOfStock}
            onPress={handleBuyNow}
          >
            <Text style={styles.buyNowText} numberOfLines={1}>{isOutOfStock ? t('product_sold_out') : t('product_buy_now')}</Text>
          </TouchableOpacity>
        </View>

        {product.groupBuyEnabled && !isOutOfStock && (
          <TouchableOpacity style={styles.groupOrderButton} onPress={() => navigation.navigate('GroupOrder', { productId: product.id })}>
            <Users size={16} color={colors.accentText} />
            <Text style={styles.groupOrderText}>{t('mobile_start_group_order')}</Text>
          </TouchableOpacity>
        )}

        {isOutOfStock && (
          <View style={styles.restockCard}>
            {restockRequested ? (
              <View style={styles.restockRow}>
                <BellRing size={16} color={colors.accentText} />
                <Text style={styles.restockSentText}>We'll email you when this is back in stock.</Text>
              </View>
            ) : (
              <>
                <View style={styles.restockRow}>
                  <BellRing size={16} color={colors.accentText} />
                  <Text style={styles.restockTitle}>Notify me when back in stock</Text>
                </View>
                <View style={styles.restockInputRow}>
                  <TextInput
                    style={styles.restockInput}
                    value={restockEmail}
                    onChangeText={setRestockEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor={colors.slate400}
                  />
                  <TouchableOpacity
                    style={[styles.restockButton, (!restockEmail.trim() || isSubmittingRestock) && styles.buttonDisabled]}
                    disabled={!restockEmail.trim() || isSubmittingRestock}
                    onPress={handleNotifyRestock}
                  >
                    {isSubmittingRestock ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.restockButtonText}>Notify Me</Text>}
                  </TouchableOpacity>
                </View>
                {restockError && <Text style={styles.inlineErrorText}>{restockError}</Text>}
              </>
            )}
          </View>
        )}

        {/* Description / Reviews tab bar - matches the website's pill switcher exactly. */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'description' && styles.tabButtonActive]} onPress={() => setActiveTab('description')}>
            <Text style={[styles.tabButtonText, activeTab === 'description' && styles.tabButtonTextActive]}>{t('detail_description')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'reviews' && styles.tabButtonActive]} onPress={() => setActiveTab('reviews')}>
            <Text style={[styles.tabButtonText, activeTab === 'reviews' && styles.tabButtonTextActive]}>
              {t('detail_reviews')} ({product.reviewsList?.length ?? 0})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'description' ? (
          <Text style={styles.description}>{product.description}</Text>
        ) : (
          <View style={styles.reviewsSection}>
            {product.reviews > 0 && product.ratingBreakdown && (
              <View style={styles.breakdownCard}>
                <View style={styles.breakdownHeader}>
                  <Star size={16} color={colors.orange500} fill={colors.orange500} />
                  <Text style={styles.breakdownAverage}>{product.rating.toFixed(1)}</Text>
                  <Text style={styles.breakdownCount}>({product.reviews} ratings)</Text>
                </View>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = product.ratingBreakdown?.[star] ?? 0;
                  const percent = product.reviews > 0 ? Math.round((count / product.reviews) * 100) : 0;
                  return (
                    <View key={star} style={styles.breakdownRow}>
                      <Text style={styles.breakdownStarLabel}>{star} star</Text>
                      <View style={styles.breakdownTrack}>
                        <View style={[styles.breakdownFill, { width: `${percent}%` }]} />
                      </View>
                      <Text style={styles.breakdownPercent}>{percent}%</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {(!product.reviewsList || product.reviewsList.length === 0) ? (
              <Text style={styles.noReviews}>{t('mobile_no_reviews_yet')}</Text>
            ) : (
              product.reviewsList.filter((r) => !r.isHidden).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewName}>{review.userUsername ? `@${review.userUsername}` : review.userName}</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={12} color={colors.orange500} fill={n <= review.rating ? colors.orange500 : 'none'} />
                      ))}
                    </View>
                  </View>
                  {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                  {review.image && <Image source={{ uri: review.image }} style={styles.reviewImage} />}
                  <Text style={styles.reviewDate}>{formatDate(review.date)}</Text>
                </View>
              ))
            )}

            <View style={styles.writeReviewCard}>
              <Text style={styles.writeReviewTitle}>{t('mobile_write_a_review')}</Text>
              {!token ? (
                <TouchableOpacity onPress={requestSignIn} style={{ marginTop: 10 }}>
                  <Text style={styles.signInToReviewText}>{t('mobile_sign_in_to_review')}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{t('mobile_your_rating')}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} onPress={() => setReviewRating(n)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                        <Star size={22} color={colors.orange500} fill={n <= reviewRating ? colors.orange500 : 'none'} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>{t('mobile_comment')}</Text>
                  <TextInput
                    style={styles.reviewInput}
                    multiline
                    numberOfLines={3}
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    placeholderTextColor={colors.slate400}
                  />

                  {reviewImageUrl ? (
                    <View style={styles.reviewImagePreviewWrap}>
                      <Image source={{ uri: reviewImageUrl }} style={styles.reviewImagePreview} />
                      <TouchableOpacity style={styles.reviewImageRemove} onPress={handleRemoveReviewImage}>
                        <XIcon size={12} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickReviewImage} disabled={isUploadingReviewImage}>
                      {isUploadingReviewImage ? (
                        <ActivityIndicator size="small" color={colors.slate600} />
                      ) : (
                        <>
                          <Camera size={16} color={colors.slate600} />
                          <Text style={styles.addPhotoText}>{t('mobile_add_photo')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {reviewError && <Text style={styles.inlineErrorText}>{reviewError}</Text>}

                  <Button
                    label={t('mobile_submit_review')}
                    onPress={handleSubmitReview}
                    loading={isSubmittingReview}
                    disabled={isUploadingReviewImage}
                    style={{ marginTop: 12 }}
                  />
                </>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Also Bought / Similar Products live below the tabs, always visible regardless of which
          tab is active - matches the website's mt-10/mt-20 full-bleed sections after the tab block. */}
      {alsoBought.length > 0 && (
        <View style={styles.carouselSection}>
          <Text style={styles.carouselTitle}>Customers Also Bought</Text>
          <FlatList
            horizontal
            data={alsoBought}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
            renderItem={({ item }) => (
              <View style={{ width: 150 }}>
                <ProductCard product={item} onPress={() => navigation.push('ProductDetail', { productId: item.id })} />
              </View>
            )}
          />
        </View>
      )}

      {similarProducts.length > 0 && (
        <View style={styles.carouselSection}>
          <Text style={styles.carouselTitle}>Similar Products</Text>
          <FlatList
            horizontal
            data={similarProducts}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
            renderItem={({ item }) => (
              <View style={{ width: 150 }}>
                <ProductCard product={item} onPress={() => navigation.push('ProductDetail', { productId: item.id })} />
              </View>
            )}
          />
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  errorText: { color: colors.rose600, fontSize: 14 },
  inlineErrorText: { color: colors.rose600, fontSize: 12.5, marginTop: 10 },
  mainImageCard: {
    margin: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.slate100, backgroundColor: colors.white,
    overflow: 'hidden', shadowColor: colors.slate900, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 3,
  },
  mainImage: { width: screenWidth - 24, height: screenWidth - 24, backgroundColor: colors.white },
  discountBadge: { position: 'absolute', top: 14, left: 14, backgroundColor: colors.rose500, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  discountBadgeText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  heartButton: {
    position: 'absolute', top: 12, right: 12, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  galleryNavButton: {
    position: 'absolute', top: '50%', marginTop: -16, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.slate900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  galleryNavButtonLeft: { left: 10 },
  galleryNavButtonRight: { right: 10 },
  imageCaption: { paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  imageCaptionName: { fontSize: 13.5, fontWeight: '800', color: colors.slate900 },
  imageCaptionDescription: { fontSize: 12, color: colors.slate600, marginTop: 2 },
  thumbnailRow: { paddingHorizontal: 12, marginBottom: 8 },
  thumbnailWrap: { alignItems: 'center', gap: 3 },
  thumbnail: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.slate100, borderWidth: 2 },
  thumbnailActive: { borderColor: colors.emerald600 },
  thumbnailInactive: { borderColor: colors.slate100, opacity: 0.6 },
  videoThumbnail: { backgroundColor: colors.slate800, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 20, fontWeight: '800', color: colors.slate900, letterSpacing: -0.3 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.orange50, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  ratingText: { fontSize: 12, fontWeight: '800', color: colors.orange800 },
  priceStockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { fontSize: 22, fontWeight: '900', color: colors.slate900, letterSpacing: -0.5 },
  originalPrice: { fontSize: 13, color: colors.slate400, textDecorationLine: 'line-through', fontWeight: '700' },
  stockPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stockText: { fontSize: 12, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginTop: 18, marginBottom: 8 },
  description: { fontSize: 14, color: colors.slate600, lineHeight: 21, marginTop: 16 },
  variantWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantChip: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.slate100, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  variantChipActive: { borderColor: colors.emerald600, backgroundColor: colors.emerald50 },
  variantChipDisabled: { opacity: 0.4 },
  variantChipText: { fontSize: 12, fontWeight: '700', color: colors.slate700 },
  variantChipTextActive: { color: colors.accentText },
  variantChipTextDisabled: { textDecorationLine: 'line-through' },
  quantityStepperWrap: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, marginTop: 20,
    borderWidth: 2, borderColor: colors.slate100, borderRadius: 16, padding: 4,
  },
  quantityButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quantityButtonDisabled: { opacity: 0.4 },
  quantityValue: { width: 40, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.slate900 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  addToCartButton: {
    flex: 1, flexDirection: 'row', gap: 8, backgroundColor: colors.emerald600, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 8,
  },
  addToCartText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  buyNowButton: { flex: 1, backgroundColor: colors.orange500, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  buyNowText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  groupOrderButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14,
    backgroundColor: colors.emerald50, borderRadius: 14, paddingVertical: 14,
  },
  groupOrderText: { fontSize: 13.5, fontWeight: '800', color: colors.accentText },
  restockCard: { backgroundColor: colors.amber50, borderRadius: 16, padding: 14, marginTop: 14 },
  restockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restockTitle: { fontSize: 13, fontWeight: '800', color: colors.amber800 },
  restockSentText: { fontSize: 12.5, color: colors.amber800, flex: 1 },
  restockInputRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  restockInput: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.slate900,
  },
  restockButton: { backgroundColor: colors.emerald800, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  restockButtonText: { color: colors.white, fontSize: 12.5, fontWeight: '800' },
  tabBar: { flexDirection: 'row', gap: 4, backgroundColor: colors.slate50, borderRadius: 16, padding: 4, marginTop: 24 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabButtonActive: {
    backgroundColor: colors.white, shadowColor: colors.slate900, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  tabButtonText: { fontSize: 13, fontWeight: '700', color: colors.slate600 },
  tabButtonTextActive: { color: colors.slate900, fontWeight: '800' },
  carouselSection: { marginTop: 24 },
  carouselTitle: { fontSize: 15, fontWeight: '800', color: colors.slate900, marginBottom: 12, paddingHorizontal: 20 },
  reviewsSection: { marginTop: 16 },
  noReviews: { fontSize: 13, color: colors.slate400, marginTop: 4 },
  reviewCard: { borderTopWidth: 1, borderTopColor: colors.slate100, paddingVertical: 12 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewName: { fontSize: 13, fontWeight: '800', color: colors.slate900 },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, color: colors.slate600, marginTop: 6, lineHeight: 19 },
  reviewImage: { width: 72, height: 72, borderRadius: 12, marginTop: 10, backgroundColor: colors.slate100 },
  reviewDate: { fontSize: 11, color: colors.slate400, marginTop: 6 },
  breakdownCard: { backgroundColor: colors.slate50, borderRadius: 16, padding: 16, marginBottom: 12 },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  breakdownAverage: { fontSize: 16, fontWeight: '900', color: colors.slate900 },
  breakdownCount: { fontSize: 12, color: colors.slate400, marginLeft: 2 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  breakdownStarLabel: { fontSize: 11, color: colors.slate600, width: 44 },
  breakdownTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.slate200, overflow: 'hidden' },
  breakdownFill: { height: '100%', backgroundColor: colors.orange500, borderRadius: 4 },
  breakdownPercent: { fontSize: 11, color: colors.slate600, width: 34, textAlign: 'right' },
  writeReviewCard: { backgroundColor: colors.slate50, borderRadius: 16, padding: 16, marginTop: 16 },
  writeReviewTitle: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  signInToReviewText: { fontSize: 13, fontWeight: '700', color: colors.accentText },
  addPhotoButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.slate200, borderRadius: 12, paddingVertical: 12,
  },
  addPhotoText: { fontSize: 12.5, fontWeight: '700', color: colors.slate600 },
  reviewImagePreviewWrap: { marginTop: 12, alignSelf: 'flex-start', position: 'relative' },
  reviewImagePreview: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.slate100 },
  reviewImageRemove: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.rose500, alignItems: 'center', justifyContent: 'center',
  },
  reviewInput: {
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 12,
    padding: 12, fontSize: 13, color: colors.slate900, minHeight: 70, textAlignVertical: 'top',
  },
});

export default ProductDetailScreen;
