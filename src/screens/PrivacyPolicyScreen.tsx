import React from 'react';
import { ScrollView, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Eye, Shield, Share2, Clock, Lock, UserCheck, FileText } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import PolicySection from '../components/customer/PolicySection';

const PrivacyPolicyScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.heading}>{t('privacy_title')}</Text>
        <PolicySection Icon={Eye} title={t('privacy_collection_title')} body={t('privacy_collection_body')} />
        <PolicySection Icon={Shield} title={t('privacy_usage_title')} body={t('privacy_usage_body')} />
        <PolicySection Icon={Share2} title={t('privacy_sharing_title')} body={t('privacy_sharing_body')} />
        <PolicySection Icon={Clock} title={t('privacy_retention_title')} body={t('privacy_retention_body')} />
        <PolicySection Icon={Lock} title={t('privacy_security_title')} body={t('privacy_security_body')} />
        <PolicySection Icon={UserCheck} title={t('privacy_rights_title')} body={t('privacy_rights_body')} />
        <PolicySection Icon={FileText} title={t('privacy_updates_title')} body={t('privacy_updates_body')} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  heading: { fontSize: 22, fontWeight: '900', color: colors.slate900, marginBottom: 20, textAlign: 'center' },
});

export default PrivacyPolicyScreen;
