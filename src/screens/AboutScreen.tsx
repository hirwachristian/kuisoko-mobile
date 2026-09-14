import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { ShieldCheck, Truck, HeartHandshake, Sparkles } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
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

const AboutScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.logoWrap}>
          <Logo height={40} />
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
