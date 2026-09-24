import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Image, Animated, Easing, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, SafeAreaView, Dimensions, FlatList,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { ChevronRight, ArrowRight, Sparkles } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { fetchSiteImages } from '../api/customer';
import { Product, Category } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Logo from '../components/Logo';
import ProductCard from '../components/customer/ProductCard';
import type { CustomerTabParamList, CustomerStackParamList } from '../navigation/CustomerNavigator';

type Props = BottomTabScreenProps<CustomerTabParamList, 'Home'> & {
  navigation: NativeStackNavigationProp<CustomerStackParamList> & BottomTabScreenProps<CustomerTabParamList, 'Home'>['navigation'];
};

const screenWidth = Dimensions.get('window').width;
const HERO_HEIGHT = 340;

// Used whenever the admin hasn't configured any hero images yet (GET /site-images/public comes
// back empty) - the same 5 images as frontend/pages/Home.tsx's own DEFAULT_HERO_SLIDES fallback;
// the first two are the same Unsplash photos, the last three are the website's own bundled
// creative, served as static assets off its production domain since the mobile app has no bundled
// copy of them.
const DEFAULT_HERO_SLIDES = [
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80',
  'https://kuisoko.store/home/hero-3.jpg',
  'https://kuisoko.store/home/hero-4.jpg',
  'https://kuisoko.store/home/hero-5.jpg',
];

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const heroScrollRef = useRef<ScrollView>(null);
  const heroSlides = heroImages.length > 0 ? heroImages : DEFAULT_HERO_SLIDES;
  // Ports frontend/pages/Home.tsx's hero transition: each slide starts slightly zoomed in
  // (scale-105) and settles to its natural size (scale-100) as it becomes active - one Animated
  // value per slide so the effect replays every time that slide comes back around, not just once.
  // Rebuilt (not a plain useRef) whenever the slide COUNT changes - e.g. once the admin-configured
  // list replaces the default array - so this never indexes past the end of a shorter/longer list.
  const heroScales = useMemo(() => heroSlides.map(() => new Animated.Value(1.08)), [heroSlides.length]);

  useEffect(() => {
    fetchSiteImages().then(({ heroImages: fetched }) => setHeroImages(fetched)).catch(() => {});
  }, []);

  // The fetched list can legitimately have a different length than the default one it replaces -
  // if the currently-shown slide index would now point past the end, snap back to the first slide
  // rather than crash on an out-of-bounds Animated.Image/heroScales lookup.
  useEffect(() => {
    if (heroIndex >= heroSlides.length) {
      setHeroIndex(0);
      heroScrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [heroSlides.length, heroIndex]);

  const animateHeroZoom = useCallback((index: number) => {
    heroScales[index].setValue(1.08);
    Animated.timing(heroScales[index], {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [heroScales]);

  useEffect(() => { animateHeroZoom(0); }, [animateHeroZoom]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [{ products: fetchedProducts }, { categories: fetchedCategories }] = await Promise.all([
        apiFetch<{ products: Product[] }>('/products'),
        apiFetch<{ categories: Category[] }>('/categories'),
      ]);
      setProducts(fetchedProducts);
      setCategories(fetchedCategories);
    } catch (e) {
      setError(t('mobile_could_not_load_products'));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => {
        const next = (prev + 1) % heroSlides.length;
        heroScrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
        animateHeroZoom(next);
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [animateHeroZoom]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const featuredProducts = products.filter((p) => p.featured);
  // One representative image per category - the highest-priced product's first image, matching
  // the website's category showcase derivation (frontend/pages/Home.tsx categoryShowcase).
  const categoryShowcase = categories
    .map((cat) => {
      const inCategory = products.filter((p) => p.category === cat.name);
      if (inCategory.length === 0) return null;
      const top = inCategory.reduce((a, b) => (b.price > a.price ? b : a));
      return { name: cat.name, image: top.images[0] };
    })
    .filter((c): c is { name: string; image: string } => c !== null);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Logo height={28} />
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald800} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.heroWrap}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setHeroIndex(next);
              animateHeroZoom(next);
            }}
            style={styles.heroScroll}
          >
            {heroSlides.map((uri, i) => (
              <View key={i} style={styles.heroSlide}>
                <Animated.Image
                  source={{ uri }}
                  style={[styles.heroImage, { transform: [{ scale: heroScales[i] }] }]}
                  resizeMode="cover"
                />
                <View style={styles.heroScrim} />
              </View>
            ))}
          </ScrollView>

          {/* Full website hero copy (frontend/pages/Home.tsx): "KuIsoko: Your Marketplace, Your
              Way" built from the same 4 title keys, same subtitle, and the same two CTAs - "My
              Deals" only when there's actually a live discount to show, matching the website's own
              conditional. */}
          <View style={styles.heroContent} pointerEvents="box-none">
            <Text style={styles.heroHeading}>
              <Text style={styles.heroHeadingKu}>{t('home_hero_title_1')}</Text>
              <Text style={styles.heroHeadingIsoko}>{t('home_hero_title_2')}</Text>
              <Text style={styles.heroHeadingWhite}>: </Text>
              <Text style={styles.heroHeadingMint}>{t('home_hero_title_3')}</Text>
              <Text style={styles.heroHeadingWhite}>, </Text>
              <Text style={styles.heroHeadingOrange}>{t('home_hero_title_4')}</Text>
            </Text>
            <Text style={styles.heroSubtitle} numberOfLines={3}>{t('home_hero_subtitle')}</Text>
            <View style={styles.heroCtaRow}>
              <TouchableOpacity style={styles.heroCtaPrimary} activeOpacity={0.85} onPress={() => navigation.navigate('Shop', { category: null, deals: false })}>
                <Text style={styles.heroCtaPrimaryText}>{t('home_explore_more')}</Text>
                <ArrowRight size={15} color={colors.white} />
              </TouchableOpacity>
              {products.some((p) => p.discount && p.discount > 0) && (
                <TouchableOpacity style={styles.heroCtaSecondary} activeOpacity={0.85} onPress={() => navigation.navigate('Shop', { category: null, deals: true })}>
                  <Sparkles size={14} color={colors.orange400} />
                  <Text style={styles.heroCtaSecondaryText}>{t('home_my_deals')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.heroDots}>
            {heroSlides.map((_, i) => (
              <View key={i} style={[styles.heroDot, i === heroIndex && styles.heroDotActive]} />
            ))}
          </View>
        </View>

        {categoryShowcase.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <FlatList
              horizontal
              data={categoryShowcase}
              keyExtractor={(c) => c.name}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.categoryCard} onPress={() => navigation.navigate('Shop', { category: item.name, deals: false })}>
                  <Image source={{ uri: item.image }} style={styles.categoryImage} resizeMode="cover" />
                  <View style={styles.categoryLabelWrap}>
                    <Text style={styles.categoryLabel} numberOfLines={1}>{item.name}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {featuredProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Featured Products</Text>
              <TouchableOpacity style={styles.seeAllRow} onPress={() => navigation.navigate('Shop', { category: null, deals: false })}>
                <Text style={styles.seeAllText}>See all</Text>
                <ChevronRight size={14} color={colors.accentText} />
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={featuredProducts}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              renderItem={({ item }) => (
                <View style={{ width: 165 }}>
                  <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.id })} />
                </View>
              )}
            />
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>All Products</Text>
            <TouchableOpacity style={styles.seeAllRow} onPress={() => navigation.navigate('Shop', { category: null, deals: false })}>
              <Text style={styles.seeAllText}>See all</Text>
              <ChevronRight size={14} color={colors.accentText} />
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {products.slice(0, 8).map((item) => (
              <View key={item.id} style={styles.gridItem}>
                <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.id })} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  errorText: { color: colors.rose600, textAlign: 'center', paddingVertical: 8, fontSize: 13 },
  heroWrap: { height: HERO_HEIGHT, backgroundColor: colors.emerald900 },
  heroScroll: { height: HERO_HEIGHT },
  heroSlide: { width: screenWidth, height: HERO_HEIGHT, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,32,24,0.55)' },
  heroContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 30, justifyContent: 'center', paddingHorizontal: 20 },
  heroHeading: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, lineHeight: 32 },
  heroHeadingKu: { color: colors.white },
  heroHeadingIsoko: { color: colors.orange400 },
  heroHeadingWhite: { color: colors.white },
  heroHeadingMint: { color: colors.emerald100 },
  heroHeadingOrange: { color: colors.orange400 },
  heroSubtitle: { fontSize: 12.5, color: colors.emerald100, marginTop: 10, lineHeight: 18, fontWeight: '500' },
  heroCtaRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  heroCtaPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.emerald700,
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16,
  },
  heroCtaPrimaryText: { color: colors.white, fontSize: 12.5, fontWeight: '800' },
  heroCtaSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14,
  },
  heroCtaSecondaryText: { color: colors.white, fontSize: 12.5, fontWeight: '800' },
  heroDots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroDotActive: { backgroundColor: colors.orange400, width: 18 },
  section: { marginTop: 22 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.slate900, paddingHorizontal: 16, marginBottom: 12 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 12.5, fontWeight: '700', color: colors.accentText },
  categoryCard: { width: 96, alignItems: 'center' },
  categoryImage: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.slate100, borderWidth: 2, borderColor: colors.emerald100 },
  categoryLabelWrap: { marginTop: 6 },
  categoryLabel: { fontSize: 11, fontWeight: '700', color: colors.slate700, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  gridItem: { width: (screenWidth - 32 - 12) / 2 },
});

export default HomeScreen;
