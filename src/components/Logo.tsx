import React from 'react';
import Svg, { Path, Text, TSpan } from 'react-native-svg';
import { logoColors } from '../theme';

interface LogoProps {
  height?: number;
}

// Faithful port of frontend/components/KuISOKOLogoSVG.tsx (same viewBox, paths and colors) so the
// mark is pixel-identical to the website's, not a redrawn approximation.
const Logo: React.FC<LogoProps> = ({ height = 48 }) => {
  const width = (height * 640) / 180;
  return (
    <Svg width={width} height={height} viewBox="0 0 640 180">
      <Path d="M40 60 L140 60 L160 160 L20 160 Z" fill={logoColors.bag} />
      <Path d="M60 60 C60 30, 120 30, 120 60" stroke={logoColors.handle} strokeWidth={10} fill="none" />
      <Path
        d="M55 110 L75 130 L115 90"
        stroke={logoColors.check}
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Text x={200} y={115} fontSize={80} fontWeight="700">
        <TSpan fill={logoColors.textGreen}>Ku</TSpan>
        <TSpan fill={logoColors.textOrange1}>Isoko</TSpan>
      </Text>
    </Svg>
  );
};

export default Logo;
