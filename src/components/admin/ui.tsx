import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

// Shared building blocks for every admin screen, styled to match the website's admin panel
// conventions (white rounded-2xl cards, emerald-800 primary actions, slate borders/text scale)
// so the ~12 admin sections read as one consistent product instead of 12 one-off screens. Every
// component here pulls live colors from useAppTheme() so dark mode applies automatically to
// every screen built on top of these, with no per-screen theming code needed.

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <View style={[styles.card, style]}>{children}</View>;
};

export const SectionTitle: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
}> = ({ children, style, icon: Icon }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  if (!Icon) return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
  return (
    <View style={[styles.sectionTitleRow, style]}>
      <Icon size={13} color={colors.slate400} />
      <Text style={styles.sectionTitleInline}>{children}</Text>
    </View>
  );
};

export const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <Text style={styles.fieldLabel}>{children}</Text>;
};

export const TextField: React.FC<TextInputProps & { style?: ViewStyle }> = ({ style, ...props }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <TextInput style={[styles.input, style]} placeholderTextColor={colors.slate400} {...props} />;
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'orange';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}
export const Button: React.FC<ButtonProps> = ({ label, onPress, variant = 'primary', disabled, loading, style }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const variantStyle =
    variant === 'primary' ? styles.buttonPrimary
    : variant === 'orange' ? styles.buttonOrange
    : variant === 'danger' ? styles.buttonDanger
    : styles.buttonSecondary;
  const textStyle = variant === 'secondary' ? styles.buttonTextSecondary : styles.buttonText;
  return (
    <TouchableOpacity
      style={[styles.buttonBase, variantStyle, (disabled || loading) && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' ? colors.accentText : colors.white} /> : <Text style={textStyle}>{label}</Text>}
    </TouchableOpacity>
  );
};

// Exported so screens that need a status's color for more than just the badge (e.g. a tracking
// timeline dot) can reuse the exact same mapping instead of re-deriving it.
export const getStatusPalette = (colors: AppColors): Record<string, { bg: string; fg: string }> => ({
  Pending: { bg: colors.amber50, fg: colors.amber800 },
  Processing: { bg: colors.orange50, fg: colors.orange800 },
  // Was identical to Delivered (both emerald) - no way to tell the two apart at a glance. Lime
  // matches the website's own Shipped=lime fix this session, without colliding with Delivered.
  Shipped: { bg: colors.lime50, fg: colors.lime700 },
  Delivered: { bg: colors.emerald50, fg: colors.accentText },
  Cancelled: { bg: colors.rose50, fg: colors.rose600 },
  Returned: { bg: colors.slate100, fg: colors.slate700 },
  pending: { bg: colors.amber50, fg: colors.amber800 },
  approved: { bg: colors.emerald50, fg: colors.accentText },
  rejected: { bg: colors.rose50, fg: colors.rose600 },
  new: { bg: colors.amber50, fg: colors.amber800 },
  replied: { bg: colors.emerald50, fg: colors.accentText },
  paid: { bg: colors.emerald50, fg: colors.accentText },
  unpaid: { bg: colors.amber50, fg: colors.amber800 },
  failed: { bg: colors.rose50, fg: colors.rose600 },
  active: { bg: colors.emerald50, fg: colors.accentText },
  inactive: { bg: colors.slate100, fg: colors.slate700 },
});
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const palette = getStatusPalette(colors)[status] ?? { bg: colors.slate100, fg: colors.slate700 };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{status}</Text>
    </View>
  );
};

export const EmptyState: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{label}</Text>
    </View>
  );
};

export const RowBetween: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <View style={[styles.rowBetween, style]}>{children}</View>;
};

interface SwitchRowProps {
  label: string;
  value: boolean;
  onToggle: () => void;
  description?: string;
}
export const ToggleRow: React.FC<SwitchRowProps> = ({ label, value, onToggle, description }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: 16,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', color: colors.slate900, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitleInline: { fontSize: 13, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', color: colors.slate900, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldLabel: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold', color: colors.slate700, marginBottom: 8, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.slate900,
  },
  buttonBase: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.emerald800 },
  buttonOrange: { backgroundColor: colors.orange500 },
  buttonDanger: { backgroundColor: colors.rose500 },
  buttonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  buttonTextSecondary: { color: colors.accentText, fontSize: 14, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10.5, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText: { color: colors.slate400, fontSize: 13, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  toggleLabel: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold', color: colors.slate900 },
  toggleDescription: { fontSize: 12, color: colors.slate600, marginTop: 2 },
  switchTrack: { width: 46, height: 27, borderRadius: 14, backgroundColor: colors.slate200, padding: 2, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: colors.emerald800 },
  switchThumb: { width: 23, height: 23, borderRadius: 12, backgroundColor: colors.white },
  switchThumbOn: { transform: [{ translateX: 19 }] },
});
