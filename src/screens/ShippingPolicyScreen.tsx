import React from 'react';
import { ScrollView, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Truck, Clock, DollarSign, MapPin } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import PolicySection from '../components/customer/PolicySection';

const ShippingPolicyScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.heading}>{t('shipping_policy_title')}</Text>
        <PolicySection Icon={Truck} title={t('shipping_scope_title')} body={t('shipping_scope_body')} />
        <PolicySection Icon={Clock} title={t('shipping_times_title')} body={t('shipping_times_body')} />
        <PolicySection Icon={DollarSign} title={t('shipping_costs_title')} body={t('shipping_costs_body')} />
        <PolicySection Icon={MapPin} title={t('shipping_tracking_title')} body={t('shipping_tracking_body')} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  heading: { fontSize: 22, fontWeight: '900', color: colors.slate900, marginBottom: 20, textAlign: 'center' },
});

export default ShippingPolicyScreen;
