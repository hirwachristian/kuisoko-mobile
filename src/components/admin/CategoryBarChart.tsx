import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import Svg, { Rect, Polyline, Polygon, Circle, Line } from 'react-native-svg';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

export interface CategoryBarDatum {
  name: string;
  count: number;
}

type ViewMode = 'bar' | 'line' | 'both';

const CHART_HEIGHT = 180;
const BAR_WIDTH = 32;
const GAP = 28;
const COLUMN_WIDTH = BAR_WIDTH + GAP;
const Y_AXIS_WIDTH = 26;
const TICKS = 4;
const TOOLTIP_WIDTH = 128;

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

// Ports frontend/components/CategoryPerformanceChart.tsx exactly: a single ComposedChart (bar +
// line + area over the same categories) with a Bar/Line/Both toggle, gridlines, and a tooltip -
// the touch equivalent of the website's hover tooltip (frontend's CustomTooltip shows
// "{value} Products" on hover; tapping a column here shows the same).
const CategoryBarChart: React.FC<{ data: CategoryBarDatum[] }> = ({ data }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    setActiveIndex(null);
    Animated.timing(progress, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [data.length, max]);

  const chartWidth = data.length * COLUMN_WIDTH;
  const points = data.map((d, i) => {
    const barHeight = (d.count / max) * CHART_HEIGHT;
    const x = i * COLUMN_WIDTH + COLUMN_WIDTH / 2;
    const y = CHART_HEIGHT - barHeight;
    const barX = i * COLUMN_WIDTH + GAP / 2;
    return { x, y, barX, barHeight, name: d.name, count: d.count };
  });

  const lineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaStr = points.length > 0 ? `${points[0].x},${CHART_HEIGHT} ${lineStr} ${points[points.length - 1].x},${CHART_HEIGHT}` : '';

  const tickValues = Array.from({ length: TICKS + 1 }, (_, i) => Math.round((max / TICKS) * i));
  const active = activeIndex !== null ? points[activeIndex] : null;
  const tooltipLeft = active ? Math.max(0, Math.min(chartWidth - TOOLTIP_WIDTH, active.x - TOOLTIP_WIDTH / 2)) : 0;
  const tooltipTop = active ? Math.max(0, active.y - 58) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Products by Category</Text>
          <Text style={styles.subtitle}>Distribution of products per category</Text>
        </View>
        <View style={styles.segmented}>
          {(['bar', 'line', 'both'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.segmentButton, viewMode === mode && styles.segmentButtonActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.segmentText, viewMode === mode && styles.segmentTextActive]}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.chartRow}>
        <View style={{ width: Y_AXIS_WIDTH, height: CHART_HEIGHT, justifyContent: 'space-between' }}>
          {[...tickValues].reverse().map((v, i) => (
            <Text key={i} style={styles.axisTick}>{v}</Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ width: chartWidth, height: CHART_HEIGHT }}>
              <Svg width={chartWidth} height={CHART_HEIGHT}>
                {tickValues.map((v, i) => {
                  const y = CHART_HEIGHT - (v / max) * CHART_HEIGHT;
                  return <Line key={i} x1={0} y1={y} x2={chartWidth} y2={y} stroke={colors.slate100} strokeWidth={1} strokeDasharray="3 3" />;
                })}
                {(viewMode === 'bar' || viewMode === 'both') && points.map((p, i) => {
                  const animatedHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.barHeight] });
                  const animatedY = progress.interpolate({ inputRange: [0, 1], outputRange: [CHART_HEIGHT, p.y] });
                  return (
                    <AnimatedRect
                      key={i}
                      x={p.barX}
                      y={animatedY}
                      width={BAR_WIDTH}
                      height={animatedHeight}
                      rx={6}
                      fill={colors.emerald800}
                      opacity={activeIndex === null || activeIndex === i ? 1 : 0.45}
                    />
                  );
                })}
                {(viewMode === 'line' || viewMode === 'both') && points.length > 1 && (
                  <>
                    <AnimatedPolygon points={areaStr} fill={colors.orange400} fillOpacity={progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] })} stroke="none" />
                    <AnimatedPolyline
                      points={lineStr}
                      fill="none"
                      stroke={colors.orange400}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={progress}
                    />
                    {points.map((p, i) => (
                      <Circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={activeIndex === i ? 7 : 5}
                        fill={colors.orange400}
                        stroke={colors.white}
                        strokeWidth={activeIndex === i ? 2 : 0}
                      />
                    ))}
                  </>
                )}
                {/* Invisible full-height tap targets, one per category column, so tapping
                    anywhere in a column (bar or line area) reveals that category's tooltip -
                    the touch equivalent of hovering the chart on the website. */}
                {points.map((p, i) => (
                  <Rect
                    key={`hit-${i}`}
                    x={i * COLUMN_WIDTH}
                    y={0}
                    width={COLUMN_WIDTH}
                    height={CHART_HEIGHT}
                    fill="transparent"
                    onPress={() => setActiveIndex(activeIndex === i ? null : i)}
                  />
                ))}
              </Svg>
              {active && (
                <View style={[styles.tooltip, { left: tooltipLeft, top: tooltipTop }]} pointerEvents="none">
                  <Text style={styles.tooltipTitle} numberOfLines={1}>{active.name}</Text>
                  <Text style={styles.tooltipValue}>{active.count} Products</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', width: chartWidth, marginTop: 8 }}>
              {points.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={{ width: COLUMN_WIDTH, alignItems: 'center' }}
                  onPress={() => setActiveIndex(activeIndex === i ? null : i)}
                >
                  <Text style={[styles.axisLabel, activeIndex === i && styles.axisLabelActive]} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: { backgroundColor: colors.emerald50, borderRadius: 24, borderWidth: 1, borderColor: colors.emerald100, padding: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  title: { fontSize: 15, fontWeight: '800', color: colors.slate900 },
  subtitle: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginTop: 2 },
  segmented: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 10, padding: 2, gap: 2 },
  segmentButton: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  segmentButtonActive: { backgroundColor: colors.emerald800 },
  segmentText: { fontSize: 10.5, fontWeight: '700', color: colors.slate600 },
  segmentTextActive: { color: colors.white },
  chartRow: { flexDirection: 'row' },
  axisTick: { fontSize: 10, color: colors.slate400, fontWeight: '600' },
  axisLabel: { fontSize: 9.5, fontWeight: '700', color: colors.slate600, textAlign: 'center' },
  axisLabelActive: { color: colors.emerald800 },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.slate100,
  },
  tooltipTitle: { fontSize: 11.5, fontWeight: '800', color: colors.slate900 },
  tooltipValue: { fontSize: 12.5, fontWeight: '900', color: colors.emerald800, marginTop: 2 },
});

export default CategoryBarChart;
