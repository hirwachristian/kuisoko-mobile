import React from 'react';
import { Text, StyleSheet } from 'react-native';

// Ports frontend/components/MtnBadge.tsx - MTN's official logo asset isn't bundled here, so this
// is a lightweight brand-colored stand-in (their yellow, bold wordmark) shown next to MTN-named
// payment methods.
const MtnBadge: React.FC = () => <Text style={styles.badge}>MTN</Text>;

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FFCC00',
    color: '#000',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: -0.2,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
});

export default MtnBadge;
