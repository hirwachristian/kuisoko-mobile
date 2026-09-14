import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

export interface BarRow {
  label: string;
  value: number;
  color: string;
}

interface HorizontalBarChartProps {
  data: BarRow[];
  formatValue?: (value: number) => string;
}

const Bar: React.FC<{ row: BarRow; maxValue: number; formatValue?: (v: number) => string; delay: number; styles: ReturnType<typeof createStyles> }> = ({ row, maxValue, formatValue, delay, styles }) => {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [row.value]);

  const pct = maxValue > 0 ? row.value / maxValue : 0;
  const animatedWidth = width.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct * 100}%`] });

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>{row.label}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: animatedWidth, backgroundColor: row.color }]} />
      </View>
      <Text style={styles.value}>{formatValue ? formatValue(row.value) : row.value}</Text>
    </View>
  );
};

// Ports the website's horizontal top-products BarChart (recharts `layout="vertical"`) - each bar
// grows in from 0 width, staggered slightly per row for the same "cascading in" feel as Recharts'
// default bar animation.
const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({ data, formatValue }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ gap: 14 }}>
      {data.map((row, i) => (
        <Bar key={row.label + i} row={row} maxValue={maxValue} formatValue={formatValue} delay={i * 80} styles={styles} />
      ))}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  row: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: colors.slate900 },
  track: { height: 14, borderRadius: 7, backgroundColor: colors.slate100, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 7 },
  value: { fontSize: 11, fontWeight: '800', color: colors.accentText, alignSelf: 'flex-end' },
});

export default HorizontalBarChart;
