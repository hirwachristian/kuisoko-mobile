import React from 'react';
import { ScrollView, Text, StyleSheet, SafeAreaView } from 'react-native';
import { UserCheck, ShieldCheck, RotateCcw, AlertTriangle, Scale, FileText } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import PolicySection from '../components/customer/PolicySection';

const TermsOfServiceScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.heading}>{t('terms_title')}</Text>
        <PolicySection Icon={UserCheck} title={t('terms_obligations_title')} body={t('terms_obligations_body')} />
        <PolicySection Icon={ShieldCheck} title={t('terms_privacy_title')} body={t('terms_privacy_body')} />
        <PolicySection Icon={RotateCcw} title={t('terms_returns_title')} body={t('terms_returns_body')} />
        <PolicySection Icon={AlertTriangle} title={t('terms_liability_title')} body={t('terms_liability_body')} />
        <PolicySection Icon={Scale} title={t('terms_governing_law_title')} body={t('terms_governing_law_body')} />
        <PolicySection Icon={FileText} title={t('terms_modifications_title')} body={t('terms_modifications_body')} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  heading: { fontSize: 22, fontWeight: '900', color: colors.slate900, marginBottom: 20, textAlign: 'center' },
});

export default TermsOfServiceScreen;
