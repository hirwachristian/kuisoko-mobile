import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../i18n/translations';

const LANGUAGES: { code: Language; flag: string; labelKey: string }[] = [
  { code: 'en', flag: '🇺🇸', labelKey: 'lang_english' },
  { code: 'kin', flag: '🇷🇼', labelKey: 'lang_kinyarwanda' },
];

// Ports frontend/components/LanguageSwitcher.tsx: a small flag + short-label button that opens a
// list of the two languages. Uses a Modal instead of the website's click-outside-to-close popover,
// since that's the natural mobile equivalent.
const LanguageSwitcher: React.FC = () => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setIsOpen(true)}>
        <Text style={styles.flag}>{current.flag}</Text>
        <Text style={styles.label}>{t(current.labelKey)}</Text>
        <ChevronDown size={12} color={colors.slate600} />
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setIsOpen(false)}>
          <View style={styles.sheet}>
            {LANGUAGES.map((lang) => {
              const isActive = lang.code === language;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.option, isActive && styles.optionActive]}
                  onPress={() => { setLanguage(lang.code); setIsOpen(false); }}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>{t(lang.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.slate100,
  },
  flag: { fontSize: 14 },
  label: { fontSize: 11, fontWeight: '800', color: colors.slate600 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 90, paddingRight: 16 },
  sheet: {
    width: 140,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.slate100,
    overflow: 'hidden',
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  optionActive: { backgroundColor: colors.emerald50 },
  optionLabel: { fontSize: 12.5, fontWeight: '700', color: colors.slate600 },
  optionLabelActive: { color: colors.accentText },
});

export default LanguageSwitcher;
