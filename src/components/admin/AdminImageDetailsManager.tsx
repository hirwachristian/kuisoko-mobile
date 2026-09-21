import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { TextField } from './ui';

type ImageDetail = { name?: string; description?: string };

interface AdminImageDetailsManagerProps {
  images: string[];
  imageDetails: Record<string, ImageDetail>;
  onChange: (details: Record<string, ImageDetail>) => void;
  /** Shown as each field's placeholder, so it's obvious what an unset image falls back to. */
  defaultName: string;
  defaultDescription: string;
}

// Ports frontend/components/AdminImageDetailsManager.tsx 1:1 - see there for the full rationale.
// An admin who never touches this gets exactly today's behavior, since an image only gets an
// entry in `imageDetails` once at least one field on it is actually filled in.
const AdminImageDetailsManager: React.FC<AdminImageDetailsManagerProps> = ({ images, imageDetails, onChange, defaultName, defaultDescription }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  if (images.length === 0) return null;

  const updateDetail = (url: string, field: keyof ImageDetail, value: string) => {
    const next = { ...(imageDetails[url] ?? {}), [field]: value };
    const updated = { ...imageDetails };
    if (!next.name?.trim() && !next.description?.trim()) {
      delete updated[url];
    } else {
      updated[url] = next;
    }
    onChange(updated);
  };

  return (
    <View>
      <Text style={styles.hint}>Leave blank to use the product's own name/description for that photo.</Text>
      {images.map((url) => {
        const detail = imageDetails[url];
        const isCustomized = !!(detail?.name?.trim() || detail?.description?.trim());
        return (
          <View key={url} style={styles.row}>
            <Image source={{ uri: url }} style={styles.thumb} />
            <View style={{ flex: 1, gap: 6 }}>
              <TextField value={detail?.name ?? ''} onChangeText={(t) => updateDetail(url, 'name', t)} placeholder={defaultName} />
              <TextField
                value={detail?.description ?? ''}
                onChangeText={(t) => updateDetail(url, 'description', t)}
                placeholder={defaultDescription || 'Description (optional)'}
                multiline
                numberOfLines={2}
              />
              {isCustomized && <Text style={styles.customBadge}>Custom</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  hint: { fontSize: 11.5, color: colors.slate600, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: colors.slate200, borderRadius: 14, padding: 10, marginBottom: 10 },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100 },
  customBadge: { fontSize: 10, fontWeight: '800', color: colors.accentText },
});

export default AdminImageDetailsManager;
