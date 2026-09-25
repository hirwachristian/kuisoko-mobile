import React from 'react';
import { Image } from 'react-native';

interface LogoProps {
  height?: number;
}

// The official circular badge artwork (bag+checkmark icon, wordmark and tagline baked into one
// image) - replaced the old hand-drawn SVG port of frontend/components/KuISOKOLogoSVG.tsx (itself
// already replaced on the website). Every call site sizes this by `height` alone, which works
// cleanly since the source art is a 1:1 square.
const Logo: React.FC<LogoProps> = ({ height = 48 }) => (
  <Image source={require('../../assets/logo.png')} style={{ width: height, height }} resizeMode="contain" />
);

export default Logo;
