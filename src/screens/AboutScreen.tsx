import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, Animated } from 'react-native';
import { ShieldCheck, Truck, HeartHandshake, Sparkles } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { fetchSiteImages } from '../api/customer';
import Logo from '../components/Logo';

// Mirrors frontend/components/AboutSection.tsx's copy - mostly-static content, so kept English-
// primary rather than fully i18n'd (see the mobile app's translation scoping note: high-traffic
// screens like Home/Cart/Checkout are fully translated, static informational pages are not yet).
const FEATURES = [
  { Icon: ShieldCheck, title: 'Trusted Marketplace', text: 'Every seller and product on KuISOKO is vetted so you can shop with confidence.' },
  { Icon: Truck, title: 'Fast Delivery', text: 'Reliable delivery across Rwanda, with live rider tracking on the way to you.' },
  { Icon: HeartHandshake, title: 'Customer First', text: 'Real support from real people, before and after every purchase.' },
  { Icon: Sparkles, title: 'Quality Products', text: 'Skincare, beauty, and everyday essentials curated for quality.' },
];

// Used whenever the admin hasn't configured any About Us images yet (GET /site-images/public
// comes back empty). Mobile has no bundled copy of these (unlike the website, which has local
// files under frontend/public/about/) so this points at the website's own hosted copies, same
// reasoning as HomeScreen.tsx's DEFAULT_HERO_SLIDES.
const DEFAULT_ABOUT_IMAGES = [
  'https://kuisoko.store/about/about-1.jpg',
  'https://kuisoko.store/about/about-2.jpg',
  'https://kuisoko.store/about/about-3.jpg',
];

const AboutScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [aboutImages, setAboutImages] = useState<string[]>([]);
  const images = aboutImages.length > 0 ? aboutImages : DEFAULT_ABOUT_IMAGES;
  // A single reused fade value (rather than one Animated.Value per slide, like HomeScreen's hero)
  // - only one image is ever on screen here, so fading it in on each slide change is enough for a
  // simple crossfade-style transition without any per-index bookkeeping to keep in sync.
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchSiteImages().then(({ aboutImages: fetched }) => setAboutImages(fetched)).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentSlide >= images.length) setCurrentSlide(0);
  }, [images.length, currentSlide]);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [currentSlide, fadeAnim]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % images.length), 4500);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.logoWrap}>
          <Logo height={40} />
        </View>

        <View style={styles.galleryWrap}>
          <Animated.Image source={{ uri: images[currentSlide] }} style={[styles.galleryImage, { opacity: fadeAnim }]} resizeMode="cover" />
          <View style={styles.galleryDots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.galleryDot, i === currentSlide && styles.galleryDotActive]} />
            ))}
          </View>
        </View>

        <Text style={styles.heading}>About KuISOKO</Text>
        <Text style={styles.paragraph}>
          KuISOKO is Rwanda's marketplace for premium skincare, beauty products, and everyday essentials.
          We connect shoppers with quality products and a shopping experience built around trust, speed, and simplicity.
        </Text>
        <Text style={styles.paragraph}>
          From express checkout with MTN MoMo Pay to live delivery tracking, everything we build is designed
          to make shopping easier for you.
        </Text>

        <View style={styles.featureGrid}>
          {FEATURES.map(({ Icon, title, text }) => (
            <View key={title} style={styles.featureCard}>
              <View style={styles.featureIconWrap}>
                <Icon size={20} color={colors.accentText} />
              </View>
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  galleryWrap: { aspectRatio: 4 / 3, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.emerald900, marginBottom: 20 },
  galleryImage: { width: '100%', height: '100%' },
  galleryDots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  galleryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  galleryDotActive: { backgroundColor: colors.white, width: 18 },
  heading: { fontSize: 22, fontWeight: '900', color: colors.slate900, marginBottom: 12 },
  paragraph: { fontSize: 14, color: colors.slate600, lineHeight: 21, marginBottom: 12 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  featureCard: {
    width: '47%', backgroundColor: colors.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.slate100,
  },
  featureIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featureTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 4 },
  featureText: { fontSize: 11.5, color: colors.slate600, lineHeight: 16 },
});

export default AboutScreen;
