import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MessageCircle } from 'lucide-react-native';
import { fetchChatUnreadCount } from '../../api/customer';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import type { CustomerStackParamList } from '../../navigation/CustomerNavigator';

const CLOSED_POLL_MS = 20000;

// Ports frontend/components/ChatWidget.tsx's floating action button: only rendered for a signed-in
// customer (`user.role === 'user'`) - guests and admins see nothing, matching the website's
// `isEligible` gate - fixed bottom-right over every tab, with an unread badge polled every 20s.
const ChatFab: React.FC = () => {
  const { colors } = useAppTheme();
  const { token, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const styles = createStyles(colors);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!token || user?.role !== 'user') return;
    const poll = () => fetchChatUnreadCount(token).then(({ count }) => setUnreadCount(count)).catch(() => {});
    poll();
    const interval = setInterval(poll, CLOSED_POLL_MS);
    return () => clearInterval(interval);
  }, [token, user?.role]);

  if (!token || user?.role !== 'user') return null;

  return (
    <TouchableOpacity
      style={styles.fab}
      activeOpacity={0.85}
      onPress={() => { setUnreadCount(0); navigation.navigate('Chat'); }}
    >
      <MessageCircle size={24} color={colors.white} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 78, right: 18, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.emerald800, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.rose500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.white,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});

export default ChatFab;
