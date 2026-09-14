import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

const ACTION_WIDTH = 160;
const CANCEL_WIDTH = 80;
const OPEN_THRESHOLD = ACTION_WIDTH / 2;

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}

// Swipe-left-to-reveal, matching the common iOS/Android "swipe to delete" gesture: dragging a row
// left slides its content over, uncovering a Cancel + Delete pair pinned to the right edge instead
// of deleting immediately - the user explicitly asked for a confirm/cancel step, not an instant
// delete-on-swipe. Built on PanResponder (no react-native-gesture-handler dependency - this app
// doesn't have it installed, and one drag gesture doesn't need a whole gesture library).
const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, onDelete, disabled }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const translateX = useRef(new Animated.Value(0)).current;
  const openOffset = useRef(0);

  const snapTo = (value: number) => {
    openOffset.current = value;
    Animated.spring(translateX, { toValue: value, useNativeDriver: true, bounciness: 0 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        !disabled && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(0, Math.max(-ACTION_WIDTH, openOffset.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const next = openOffset.current + gesture.dx;
        snapTo(next < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0);
      },
      onPanResponderTerminate: () => snapTo(openOffset.current < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0),
    })
  ).current;

  const close = () => snapTo(0);

  return (
    <View style={styles.wrap}>
      <View style={styles.actionsLayer} pointerEvents={disabled ? 'none' : 'auto'}>
        <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={close} activeOpacity={0.8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={onDelete} activeOpacity={0.8}>
          <Trash2 size={16} color={colors.white} />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...(disabled ? {} : panResponder.panHandlers)}>
        {children}
      </Animated.View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 16, marginBottom: 10 },
  actionsLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'flex-end' },
  actionButton: { width: CANCEL_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 3 },
  cancelButton: { backgroundColor: colors.slate200 },
  cancelText: { color: colors.slate700, fontSize: 12, fontWeight: '800' },
  deleteButton: { backgroundColor: colors.rose500 },
  deleteText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});

export default SwipeableRow;
