import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useAdminNotifications } from '../../context/AdminNotificationsContext';
import { fetchEnquiry, replyToEnquiry, deleteEnquiry } from '../../api/admin';
import { Enquiry } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, SectionTitle, StatusBadge, Button, TextField } from '../../components/admin/ui';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'EnquiryDetail'>;

const AdminEnquiryDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { enquiryId } = route.params;
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const { refresh: refreshAdminNotifications } = useAdminNotifications();
  const styles = createStyles(colors);
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // GET /enquiries/:id marks it read server-side as a side effect (backend/src/routes/enquiries.ts)
  // - refresh the "More" tab badge right after so it doesn't wait for the next poll tick.
  const load = useCallback(async () => {
    if (!token) return;
    const { enquiry: fetched } = await fetchEnquiry(enquiryId, token);
    setEnquiry(fetched);
    refreshAdminNotifications();
  }, [enquiryId, token, refreshAdminNotifications]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleReply = async () => {
    if (!token || !replyBody.trim()) return;
    setIsSending(true);
    try {
      const { enquiry: updated } = await replyToEnquiry(enquiryId, replyBody.trim(), token);
      setEnquiry(updated);
      setReplyBody('');
      Alert.alert('Sent', 'Your reply was emailed to the customer.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send reply.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete enquiry', 'Delete this enquiry permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (!token) return; await deleteEnquiry(enquiryId, token); navigation.goBack(); } },
    ]);
  };

  if (!enquiry) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.topRow}>
          <Text style={styles.subject}>{enquiry.subject}</Text>
          <StatusBadge status={enquiry.status} />
        </View>
        <Text style={styles.from}>{enquiry.name} · {enquiry.email}</Text>
        <Text style={styles.date}>{new Date(enquiry.createdAt).toLocaleString()}</Text>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.messageText}>{enquiry.message}</Text>
        </Card>

        {enquiry.replyBody && (
          <>
            <SectionTitle style={{ marginTop: 20 }}>Your Reply</SectionTitle>
            <Card>
              <Text style={styles.messageText}>{enquiry.replyBody}</Text>
              {enquiry.repliedAt && <Text style={styles.date}>Sent {new Date(enquiry.repliedAt).toLocaleString()}</Text>}
            </Card>
          </>
        )}

        {enquiry.status === 'new' && (
          <>
            <SectionTitle style={{ marginTop: 20 }}>Reply</SectionTitle>
            <TextField
              value={replyBody}
              onChangeText={setReplyBody}
              placeholder="Type your reply..."
              multiline
              numberOfLines={5}
              style={{ height: 110, textAlignVertical: 'top' }}
            />
            <Button label="Send Reply" onPress={handleReply} loading={isSending} style={{ marginTop: 12 }} />
          </>
        )}

        <Button label="Delete Enquiry" variant="danger" onPress={handleDelete} style={{ marginTop: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  subject: { fontSize: 18, fontWeight: '900', color: colors.slate900, flex: 1 },
  from: { fontSize: 12.5, color: colors.slate600, marginTop: 6, fontWeight: '600' },
  date: { fontSize: 11.5, color: colors.slate400, marginTop: 2, fontWeight: '600' },
  messageText: { fontSize: 13.5, color: colors.slate700, lineHeight: 20 },
});

export default AdminEnquiryDetailScreen;
