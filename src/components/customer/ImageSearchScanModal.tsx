import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { ScanLine, X as XIcon, RotateCcw } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

const FRAME_SIZE = 260;

interface Props {
  visible: boolean;
  imageUri: string | null;
  status: 'scanning' | 'error';
  errorMessage?: string | null;
  onClose: () => void;
  onRetry: () => void;
}

// Real visual feedback for the photo-search request actually in flight (backend/src/routes/
// products.ts hashes the uploaded photo and ranks the catalog by Hamming distance) - a sweeping
// scan line + corner brackets over the captured photo, not just a spinner, so it reads as "your
// photo is being analyzed" rather than a generic loading state.
const ImageSearchScanModal: React.FC<Props> = ({ visible, imageUri, status, errorMessage, onClose, onRetry }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || status !== 'scanning') return;
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, status, sweep]);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [4, FRAME_SIZE - 8] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={status === 'error' ? onClose : undefined}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.frame}>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />}
            {status === 'scanning' && (
              <>
                <View style={styles.dim} />
                <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </>
            )}
            {status === 'error' && <View style={styles.errorDim} />}
          </View>

          {status === 'scanning' ? (
            <View style={styles.statusRow}>
              <ScanLine size={16} color={colors.accentText} />
              <Text style={styles.statusText}>Scanning for matching products...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.errorTitle}>Search failed</Text>
              <Text style={styles.errorText}>{errorMessage ?? 'Could not search by this photo.'}</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                  <XIcon size={16} color={colors.slate600} />
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
                  <RotateCcw size={16} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 20, alignItems: 'center', width: '100%', maxWidth: 340 },
  frame: {
    width: FRAME_SIZE, height: FRAME_SIZE, borderRadius: 18, overflow: 'hidden',
    backgroundColor: colors.slate900, marginBottom: 16,
  },
  image: { width: '100%', height: '100%' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,95,70,0.15)' },
  errorDim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)' },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: colors.emerald600,
    shadowColor: colors.emerald600, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8,
  },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: colors.emerald600 },
  cornerTL: { top: 8, left: 8, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 13.5, fontWeight: '700', color: colors.slate700 },
  errorTitle: { fontSize: 16, fontWeight: '900', color: colors.slate900, marginBottom: 6 },
  errorText: { fontSize: 13, color: colors.slate600, textAlign: 'center', marginBottom: 18, lineHeight: 19 },
  buttonRow: { flexDirection: 'row', gap: 10, width: '100%' },
  secondaryButton: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 14, backgroundColor: colors.slate100,
  },
  secondaryButtonText: { fontSize: 13.5, fontWeight: '700', color: colors.slate600 },
  primaryButton: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 14, backgroundColor: colors.emerald800,
  },
  primaryButtonText: { fontSize: 13.5, fontWeight: '700', color: colors.white },
});

export default ImageSearchScanModal;
