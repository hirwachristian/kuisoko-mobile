import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Megaphone, X } from 'lucide-react-native';
import { fetchAnnouncementBanners } from '../../api/customer';
import { AnnouncementBanner as Banner } from '../../types';

const ROTATE_MS = 5000;
// Fixed brand color, not sourced from the theme - this bar is its own solid orange surface in
// both light and dark mode (matching the website's, which never re-skins for dark mode either),
// so its icon/text must stay a literal white rather than `colors.white`. That theme token is
// audited to flip to dark navy in dark mode specifically because every other use of it is a
// background/surface color, not foreground text on a colored bar like this one - reusing it here
// silently turned the icon/text dark-on-dark-orange in dark mode, on top of the actual root cause
// below.
const BAR_BG = '#f97316'; // orange-500
const FOREGROUND = '#ffffff';

// Ports frontend/components/Banner.tsx: a live site-wide announcement strip. The website scrolls a
// marquee of every active banner side-by-side; here they rotate one at a time on a timer instead,
// which reads better on a narrow phone screen while still surfacing every active announcement.
//
// Root cause of it never actually being visible: this sits above CustomerNavigator's Tab.Navigator
// (whose "Tabs" stack screen has headerShown:false, so there's no header providing top padding)
// as a plain View with no safe-area awareness - on any phone with a notch/dynamic island/status
// bar, it rendered starting at y=0, i.e. behind the status bar, not below it. Wrapping in
// SafeAreaView (top edge only - the bottom tab bar already handles its own bottom inset) fixes
// that; everything else here is the "professional and clear" redesign on top of that fix.
const AnnouncementBanner: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAnnouncementBanners().then(({ banners: fetched }) => setBanners(fetched)).catch(() => {});
  }, []);

  const visible = banners.filter((b) => !dismissedIds.has(b.id));

  useEffect(() => {
    if (visible.length <= 1) return;
    const interval = setInterval(() => setIndex((i) => (i + 1) % visible.length), ROTATE_MS);
    return () => clearInterval(interval);
  }, [visible.length]);

  if (visible.length === 0) return null;
  const current = visible[Math.min(index, visible.length - 1)];

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.bar}>
        <View style={styles.iconWrap}>
          <Megaphone size={13} color={FOREGROUND} />
        </View>
        <Text style={styles.text} numberOfLines={2}>{current.message}</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setDismissedIds((prev) => new Set(prev).add(current.id))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={15} color={FOREGROUND} />
        </TouchableOpacity>
      </View>
      {visible.length > 1 && (
        <View style={styles.dots}>
          {visible.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: BAR_BG },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  iconWrap: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  text: { flex: 1, color: FOREGROUND, fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
  closeButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingBottom: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: FOREGROUND, width: 14 },
});

export default AnnouncementBanner;
