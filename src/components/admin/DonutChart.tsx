import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  /** When set, tapping a slice/legend row shows its own formatted value + percent in the center,
   * mirroring the website's hover "active shape" detail (frontend/components/AdminDashboardContent.tsx). */
  formatValue?: (value: number) => string;
  totalCaption?: string;
}

// Hand-rolled donut (stacked SVG circle strokes) rather than a charting dependency. Grows in with
// a scale+fade pop on mount/data change (Recharts' default Pie entrance is a sweep animation this
// approximates closely enough without fragile per-arc timing math), and supports tapping a slice
// or legend row to show that segment's detail in the center - the touch equivalent of the
// website's hover-to-reveal interaction.
const DonutChart: React.FC<DonutChartProps> = ({ segments, size = 160, strokeWidth = 22, centerLabel, formatValue, totalCaption = 'TOTAL' }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const growth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    growth.setValue(0);
    Animated.timing(growth, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }).start();
  }, [segments.length, total]);

  let cumulative = 0;
  const active = activeIndex !== null ? segments[activeIndex] : null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
      <Animated.View style={{ width: size, height: size, opacity: growth, transform: [{ scale: growth }] }}>
        <Svg width={size} height={size}>
          <G rotation={-90} originX={size / 2} originY={size / 2}>
            {total === 0 ? (
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.slate100} strokeWidth={strokeWidth} fill="none" />
            ) : (
              segments.map((seg, i) => {
                const fraction = seg.value / total;
                const dashLength = fraction * circumference;
                const offset = circumference - (cumulative / total) * circumference;
                cumulative += seg.value;
                const isActive = activeIndex === i;
                return (
                  <Circle
                    key={seg.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={isActive ? radius + 3 : radius}
                    stroke={seg.color}
                    strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                    fill="none"
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={offset}
                    onPress={() => setActiveIndex(activeIndex === i ? null : i)}
                  />
                );
              })
            )}
          </G>
        </Svg>
        <View style={styles.centerLabelWrap} pointerEvents="none">
          {active ? (
            <>
              <Text style={styles.centerActiveName} numberOfLines={1}>{active.label}</Text>
              <Text style={[styles.centerActiveValue, { color: active.color }]} numberOfLines={1}>
                {formatValue ? formatValue(active.value) : active.value} ({((active.value / total) * 100).toFixed(1)}%)
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.centerCaption}>{totalCaption}</Text>
              <Text style={styles.centerLabelText}>{centerLabel}</Text>
            </>
          )}
        </View>
      </Animated.View>
      <View style={{ flex: 1, gap: 8 }}>
        {segments.map((seg, i) => (
          <TouchableOpacity
            key={seg.label}
            style={styles.legendRow}
            activeOpacity={0.6}
            onPress={() => setActiveIndex(activeIndex === i ? null : i)}
          >
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={[styles.legendLabel, activeIndex === i && styles.legendLabelActive]} numberOfLines={1}>{seg.label}</Text>
            <Text style={styles.legendValue}>{formatValue ? formatValue(seg.value) : seg.value}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  centerLabelWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  centerCaption: { fontSize: 9.5, fontWeight: '800', color: colors.slate400, textTransform: 'uppercase', letterSpacing: 0.5 },
  centerLabelText: { fontSize: 15, fontWeight: '900', color: colors.slate900, marginTop: 2 },
  centerActiveName: { fontSize: 12.5, fontWeight: '800', color: colors.slate900, textAlign: 'center' },
  centerActiveValue: { fontSize: 11.5, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 11.5, color: colors.slate600, fontWeight: '600' },
  legendLabelActive: { color: colors.slate900, fontWeight: '800' },
  legendValue: { fontSize: 11.5, color: colors.slate900, fontWeight: '800' },
});

export default DonutChart;
