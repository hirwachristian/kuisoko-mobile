import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Polyline, Polygon } from 'react-native-svg';
import { useCountUp } from '../../hooks/useCountUp';
import { useAppTheme } from '../../context/ThemeContext';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

export type StatCardColor = 'emerald' | 'orange' | 'blue' | 'purple' | 'amber';

interface Palette { bg: string; border: string; label: string; value: string; iconBg: string; iconText: string; caption: string; stroke: string; fill: string }

// Matches frontend/components/AnimatedStatCard.tsx's COLOR_STYLES exactly, light and dark
// variants both (e.g. `bg-emerald-50 dark:bg-emerald-950`, `text-emerald-700 dark:text-emerald-300`).
const LIGHT_STYLES: Record<StatCardColor, Palette> = {
  emerald: { bg: '#ecfdf5', border: '#d1fae5', label: '#064e3b', value: '#022c22', iconBg: '#ffffff', iconText: '#047857', caption: '#059669', stroke: '#059669', fill: 'rgba(5,150,105,0.16)' },
  orange: { bg: '#fff7ed', border: '#ffedd5', label: '#7c2d12', value: '#431407', iconBg: '#ffffff', iconText: '#c2410c', caption: '#ea580c', stroke: '#ea580c', fill: 'rgba(234,88,12,0.16)' },
  blue: { bg: '#eff6ff', border: '#dbeafe', label: '#1e3a8a', value: '#172554', iconBg: '#ffffff', iconText: '#1d4ed8', caption: '#2563eb', stroke: '#2563eb', fill: 'rgba(37,99,235,0.16)' },
  purple: { bg: '#faf5ff', border: '#f3e8ff', label: '#581c87', value: '#3b0764', iconBg: '#ffffff', iconText: '#7e22ce', caption: '#9333ea', stroke: '#9333ea', fill: 'rgba(147,51,234,0.16)' },
  amber: { bg: '#fffbeb', border: '#fef3c7', label: '#78350f', value: '#451a03', iconBg: '#ffffff', iconText: '#b45309', caption: '#d97706', stroke: '#d97706', fill: 'rgba(217,119,6,0.16)' },
};
const DARK_STYLES: Record<StatCardColor, Palette> = {
  emerald: { bg: '#022c22', border: '#064e3b', label: '#a7f3d0', value: '#ffffff', iconBg: '#064e3b', iconText: '#6ee7b7', caption: '#34d399', stroke: '#34d399', fill: 'rgba(52,211,153,0.18)' },
  orange: { bg: '#431407', border: '#7c2d12', label: '#fed7aa', value: '#ffffff', iconBg: '#7c2d12', iconText: '#fdba74', caption: '#fb923c', stroke: '#fb923c', fill: 'rgba(251,146,60,0.18)' },
  blue: { bg: '#172554', border: '#1e3a8a', label: '#bfdbfe', value: '#ffffff', iconBg: '#1e3a8a', iconText: '#93c5fd', caption: '#60a5fa', stroke: '#60a5fa', fill: 'rgba(96,165,250,0.18)' },
  purple: { bg: '#3b0764', border: '#581c87', label: '#e9d5ff', value: '#ffffff', iconBg: '#581c87', iconText: '#d8b4fe', caption: '#c084fc', stroke: '#c084fc', fill: 'rgba(192,132,252,0.18)' },
  amber: { bg: '#451a03', border: '#78350f', label: '#fde68a', value: '#ffffff', iconBg: '#78350f', iconText: '#fcd34d', caption: '#fbbf24', stroke: '#fbbf24', fill: 'rgba(251,191,36,0.18)' },
};

interface AnimatedStatCardProps {
  label: string;
  value: number;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  caption: string;
  color: StatCardColor;
  formatValue?: (n: number) => string;
  sparkline?: number[];
  trendPercent?: number | null;
}

const CHART_W = 130;
const CHART_H = 34;

// Ports frontend/components/AnimatedStatCard.tsx: the value counts up from 0 on mount (useCountUp,
// unchanged), and the sparkline draws itself in - the area fades in (opacity 0->1) while the line
// animates like Motion's `pathLength` (dashoffset swept from the polyline's full length to 0).
const AnimatedStatCard: React.FC<AnimatedStatCardProps> = ({ label, value, Icon, caption, color, formatValue, sparkline, trendPercent }) => {
  const { isDark } = useAppTheme();
  const c = (isDark ? DARK_STYLES : LIGHT_STYLES)[color];
  const displayValue = useCountUp(value, true);
  const lineProgress = useRef(new Animated.Value(0)).current;
  const areaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(lineProgress, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.timing(areaOpacity, { toValue: 1, duration: 600, delay: 400, useNativeDriver: false }).start();
  }, [sparkline]);

  const { points, areaPoints, length } = useMemo(() => {
    if (!sparkline || sparkline.length < 2) return { points: '', areaPoints: '', length: 0 };
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const coords = sparkline.map((v, i) => {
      const x = (i / (sparkline.length - 1)) * CHART_W;
      const y = CHART_H - ((v - min) / range) * (CHART_H - 4) - 2;
      return [x, y] as const;
    });
    let len = 0;
    for (let i = 1; i < coords.length; i++) {
      len += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
    }
    const pointsStr = coords.map(([x, y]) => `${x},${y}`).join(' ');
    return { points: pointsStr, areaPoints: `0,${CHART_H} ${pointsStr} ${CHART_W},${CHART_H}`, length: len };
  }, [sparkline]);

  const dashOffset = lineProgress.interpolate({ inputRange: [0, 1], outputRange: [length, 0] });

  return (
    <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: c.label }]} numberOfLines={1}>{label}</Text>
        <View style={[styles.iconWrap, { backgroundColor: c.iconBg }]}>
          <Icon size={18} color={c.iconText} />
        </View>
      </View>
      <Text style={[styles.value, { color: c.value }]}>{formatValue ? formatValue(displayValue) : displayValue.toLocaleString()}</Text>
      <View style={styles.bottomRow}>
        <Text style={[styles.caption, { color: c.caption }]} numberOfLines={1}>{caption}</Text>
        {trendPercent !== undefined && trendPercent !== null && (
          <Text style={[styles.trend, { color: trendPercent >= 0 ? '#059669' : '#e11d48' }]}>
            {trendPercent >= 0 ? '▲' : '▼'} {Math.abs(trendPercent).toFixed(0)}%
          </Text>
        )}
      </View>
      {points ? (
        <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ marginTop: 6 }}>
          <AnimatedPolygon points={areaPoints} fill={c.fill} stroke="none" opacity={areaOpacity} />
          <AnimatedPolyline
            points={points}
            fill="none"
            stroke={c.stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${length},${length}`}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: '47%', borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1, marginRight: 6 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  caption: { fontSize: 10.5, fontStyle: 'italic', flex: 1 },
  trend: { fontSize: 10.5, fontWeight: '800' },
});

export default AnimatedStatCard;
