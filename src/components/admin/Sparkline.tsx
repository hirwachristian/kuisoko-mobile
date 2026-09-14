import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, { Polyline, Polygon, Line, Circle } from 'react-native-svg';
import { useAppTheme } from '../../context/ThemeContext';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Renders a small dot at each data point - used by the full-size "line chart" sections, off by
   * default for the tiny stat-card-style sparklines where dots would be too crowded. */
  showDots?: boolean;
}

// A minimal hand-rolled line chart (no charting library) - SVG paths built from the data directly,
// since react-native-svg was already a dependency for the logo, avoiding pulling in a whole
// charting package for a handful of trend lines. Draws itself in the same way
// AnimatedStatCard's own sparkline does (line stroke swept in, area faded in).
const Sparkline: React.FC<SparklineProps> = ({ values, width = 260, height = 56, color, showDots = false }) => {
  const { colors } = useAppTheme();
  const lineColor = color ?? colors.accentText;
  const progress = useRef(new Animated.Value(0)).current;
  const areaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    areaOpacity.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.timing(areaOpacity, { toValue: 1, duration: 500, delay: 350, useNativeDriver: false }).start();
  }, [values]);

  if (values.length < 2) {
    return <View style={{ width, height }} />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const coords = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y] as const;
  });
  const points = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  let length = 0;
  for (let i = 1; i < coords.length; i++) {
    length += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
  }
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [length, 0] });

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={colors.slate100} strokeWidth={1} />
      <AnimatedPolygon points={areaPoints} fill={lineColor} fillOpacity={0.12} opacity={areaOpacity} />
      <AnimatedPolyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={`${length},${length}`}
        strokeDashoffset={dashOffset}
      />
      {showDots && coords.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={3} fill={lineColor} stroke={colors.white} strokeWidth={1.5} />
      ))}
    </Svg>
  );
};

export default Sparkline;
