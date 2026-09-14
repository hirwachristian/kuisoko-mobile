import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

const PolicySection: React.FC<{ Icon: LucideIcon; title: string; body: string }> = ({ Icon, title, body }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Icon size={20} color={colors.emerald600} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, marginBottom: 22 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800', color: colors.slate900, marginBottom: 4 },
  body: { fontSize: 13, color: colors.slate600, lineHeight: 20 },
});

export default PolicySection;
