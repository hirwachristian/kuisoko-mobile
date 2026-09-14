import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2 } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import type { CustomerStackParamList } from '../../navigation/CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CheckoutConfirmation'>;

const CheckoutConfirmationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <CheckCircle2 size={56} color={colors.emerald600} />
        </View>
        <Text style={styles.title}>{t('mobile_order_placed')}</Text>
        <Text style={styles.subtitle}>{t('mobile_order_placed_subtitle')}</Text>
        <Text style={styles.orderNumber}>{t('mobile_order_number')} #{orderId.slice(0, 8).toUpperCase()}</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.replace('OrderDetail', { orderId })}
        >
          <Text style={styles.primaryButtonText}>{t('mobile_view_order')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Tabs')}
        >
          <Text style={styles.secondaryButtonText}>{t('mobile_back_to_home')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '900', color: colors.slate900, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.slate600, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  orderNumber: { fontSize: 13, fontWeight: '800', color: colors.accentText, marginTop: 16, backgroundColor: colors.emerald50, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  primaryButton: { backgroundColor: colors.emerald800, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, marginTop: 36, width: '100%', alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryButton: { paddingVertical: 14, marginTop: 6 },
  secondaryButtonText: { color: colors.slate600, fontSize: 14, fontWeight: '700' },
});

export default CheckoutConfirmationScreen;
