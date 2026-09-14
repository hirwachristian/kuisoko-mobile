import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { shadeColor } from '../../utils/color';

export interface PieSegment {
  label: string;
  value: number;
  color: string;
}

interface ExplodedPieChartProps {
  segments: PieSegment[];
  size?: number;
  formatValue?: (value: number) => string;
}

const EXPLODE_DISTANCE = 9;
const AnimatedPath = Animated.createAnimatedComponent(Path);

const toRad = (deg: number) => (deg * Math.PI) / 180;

// A flat-but-glossy "exploded" pie: each wedge nudged outward from center (matching the reference
// photo's separated slices) and filled with a radial gradient so it reads as domed/lit rather than
// flat, without ever tilting into a true 3D perspective - a real 3D pie would visually inflate the
// front slices relative to the back ones for equal values, which is why dataviz tools like
// Recharts (what the website itself uses) avoid it. Tapping a slice or legend row highlights it and
// shows its exact value, the touch equivalent of the website's hover tooltip.
const ExplodedPieChart: React.FC<ExplodedPieChartProps> = ({ segments, size = 190, formatValue }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const growth = useRef(new Animated.Value(0)).current;
  const sliceOpacities = useRef(segments.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    growth.setValue(0);
    sliceOpacities.forEach((v) => v.setValue(0));
    setActiveIndex(null);
    Animated.timing(growth, { toValue: 1, duration: 550, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }).start();
    Animated.stagger(70, sliceOpacities.map((v) => Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: false }))).start();
  }, [segments.length, segments.reduce((s, x) => s + x.value, 0)]);

  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = size / 2 - EXPLODE_DISTANCE - 4;
  const cx = size / 2;
  const cy = size / 2;

  let cumulative = 0;
  const slices = segments.map((seg, i) => {
    const startAngle = -90 + (cumulative / total) * 360;
    cumulative += seg.value;
    const endAngle = -90 + (cumulative / total) * 360;
    const midAngle = (startAngle + endAngle) / 2;
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const x1 = cx + radius * Math.cos(toRad(startAngle));
    const y1 = cy + radius * Math.sin(toRad(startAngle));
    const x2 = cx + radius * Math.cos(toRad(endAngle));
    const y2 = cy + radius * Math.sin(toRad(endAngle));
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const dx = Math.cos(toRad(midAngle)) * EXPLODE_DISTANCE;
    const dy = Math.sin(toRad(midAngle)) * EXPLODE_DISTANCE;
    return { ...seg, index: i, path, dx, dy };
  });

  const uniqueColors = [...new Set(segments.map((s) => s.color))];
  const active = activeIndex !== null ? slices[activeIndex] : null;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ width: size, height: size, opacity: growth, transform: [{ scale: growth }] }}>
        <View style={styles.shadowWrap}>
          <Svg width={size} height={size}>
            <Defs>
              {uniqueColors.map((c) => (
                <RadialGradient key={c} id={`grad-${c.replace('#', '')}`} cx="35%" cy="32%" r="75%">
                  <Stop offset="0%" stopColor={shadeColor(c, 0.35)} />
                  <Stop offset="65%" stopColor={c} />
                  <Stop offset="100%" stopColor={shadeColor(c, -0.18)} />
                </RadialGradient>
              ))}
            </Defs>
            {total === 0 ? (
              <Path d={`M ${cx} ${cy} m -${radius} 0 a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 -${radius * 2} 0`} fill={colors.slate100} />
            ) : (
              slices.map((s) => (
                <AnimatedPath
                  key={s.index}
                  d={s.path}
                  fill={`url(#grad-${s.color.replace('#', '')})`}
                  stroke={colors.surface}
                  strokeWidth={activeIndex === s.index ? 3 : 2}
                  transform={`translate(${s.dx}, ${s.dy})`}
                  opacity={sliceOpacities[s.index]}
                  onPress={() => setActiveIndex(activeIndex === s.index ? null : s.index)}
                />
              ))
            )}
          </Svg>
        </View>
      </Animated.View>

      <View style={styles.detailWrap}>
        {active ? (
          <>
            <Text style={styles.detailLabel} numberOfLines={1}>{active.label}</Text>
            <Text style={[styles.detailValue, { color: active.color }]}>
              {formatValue ? formatValue(active.value) : active.value} ({((active.value / total) * 100).toFixed(1)}%)
            </Text>
          </>
        ) : (
          <Text style={styles.detailHint}>Tap a slice for details</Text>
        )}
      </View>

      <View style={styles.legend}>
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
  shadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  detailWrap: { marginTop: 14, alignItems: 'center', minHeight: 34 },
  detailHint: { fontSize: 11.5, color: colors.slate400, fontWeight: '600' },
  detailLabel: { fontSize: 13, fontWeight: '800', color: colors.slate900 },
  detailValue: { fontSize: 13.5, fontWeight: '900', marginTop: 2 },
  legend: { width: '100%', marginTop: 14, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendLabel: { flex: 1, fontSize: 12, color: colors.slate600, fontWeight: '600' },
  legendLabelActive: { color: colors.slate900, fontWeight: '800' },
  legendValue: { fontSize: 12, color: colors.slate900, fontWeight: '800' },
});

export default ExplodedPieChart;
