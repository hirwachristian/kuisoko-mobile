import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchEnquiries } from '../../api/admin';
import { Enquiry } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { EmptyState, StatusBadge } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'Enquiries'>;

const AdminEnquiriesScreen: React.FC<Props> = ({ navigation }) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const { enquiries: fetched } = await fetchEnquiries(token);
    setEnquiries(fetched);
  }, [token]);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={enquiries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<EmptyState label="No enquiries" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('EnquiryDetail', { enquiryId: item.id })}>
            <View style={styles.cardTop}>
              <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.name}>{item.name} · {item.email}</Text>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
            {item.unread && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  card: { position: 'relative', backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate100, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  subject: { fontSize: 14, fontWeight: '800', color: colors.slate900, flex: 1 },
  name: { fontSize: 11.5, color: colors.slate400, fontWeight: '600', marginBottom: 4 },
  message: { fontSize: 12.5, color: colors.slate600 },
  unreadDot: { position: 'absolute', top: 14, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose500 },
});

export default AdminEnquiriesScreen;
