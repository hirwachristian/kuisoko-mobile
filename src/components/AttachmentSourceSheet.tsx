import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { X as XIcon } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';

export interface AttachmentSourceOption {
  key: string;
  label: string;
  Icon: LucideIcon;
  onSelect: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  options: AttachmentSourceOption[];
  onClose: () => void;
}

// Shared by every screen that lets the user pick "where from" before opening a native
// picker/camera (chat attachments, admin product photos/videos). Closing this sheet Modal and
// immediately launching another native modal presentation (image/document picker, camera) in the
// same tick is a classic iOS conflict - "presenting while dismissing" - that fails completely
// silently: no error, the picker just never appears. This defers the actual onSelect call until
// the sheet has genuinely finished closing: via Modal's onDismiss on iOS (the only platform it
// fires on - react-native/Libraries/Modal/Modal.js gates it behind Platform.OS === 'ios'), and a
// short timer on Android sized to the default ~300ms slide-out, since Android's Modal never calls
// onDismiss at all.
const AttachmentSourceSheet: React.FC<Props> = ({ visible, title, options, onClose }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const pendingKey = useRef<string | null>(null);

  const choose = (key: string) => {
    pendingKey.current = key;
    onClose();
  };

  const runPending = () => {
    const key = pendingKey.current;
    pendingKey.current = null;
    if (!key) return;
    options.find((o) => o.key === key)?.onSelect();
  };

  useEffect(() => {
    if (Platform.OS === 'ios' || visible || !pendingKey.current) return;
    const timer = setTimeout(runPending, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? runPending : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}><XIcon size={20} color={colors.slate600} /></TouchableOpacity>
          </View>
          {options.map((option, i) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.option, i === options.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => choose(option.key)}
            >
              <View style={styles.optionIcon}><option.Icon size={18} color={colors.accentText} /></View>
              <Text style={styles.optionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900', color: colors.slate900 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  optionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 14.5, fontWeight: '700', color: colors.slate900 },
});

export default AttachmentSourceSheet;
