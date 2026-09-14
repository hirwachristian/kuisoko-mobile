import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';

interface TabBarIconProps {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  focused: boolean;
  badge?: number;
}

// A soft rounded highlight behind the active tab's icon (common in polished bottom-nav bars) so
// the active state reads clearly at a glance instead of relying on icon color alone. `badge`
// (e.g. cart item count) renders as a small pill in the corner, matching the website's cart badge.
const TabBarIcon: React.FC<TabBarIconProps> = ({ Icon, color, focused, badge }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={[styles.wrap, focused && styles.wrapActive]}>
      <Icon size={22} color={color} />
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { width: 44, height: 30, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wrapActive: { backgroundColor: colors.emerald50 },
  badge: {
    position: 'absolute', top: -2, right: 2, minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: colors.orange500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
});

export default TabBarIcon;
