import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const FaqScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items = [
    { q: t('faq_q1'), a: t('faq_a1') },
    { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') },
    { q: t('faq_q4'), a: t('faq_a4') },
    { q: t('faq_q5'), a: t('faq_a5') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.heading}>{t('faq_title')}</Text>
        {items.map((item, i) => (
          <View key={i} style={styles.card}>
            <TouchableOpacity style={styles.questionRow} onPress={() => setOpenIndex(openIndex === i ? null : i)} activeOpacity={0.7}>
              <Text style={styles.question}>{item.q}</Text>
              {openIndex === i ? <ChevronUp size={18} color={colors.slate600} /> : <ChevronDown size={18} color={colors.slate600} />}
            </TouchableOpacity>
            {openIndex === i && <Text style={styles.answer}>{item.a}</Text>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  heading: { fontSize: 22, fontWeight: '900', color: colors.slate900, marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate100, marginBottom: 12, overflow: 'hidden' },
  questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, gap: 10 },
  question: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.slate900 },
  answer: { fontSize: 13, color: colors.slate600, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.slate50, paddingTop: 12 },
});

export default FaqScreen;
