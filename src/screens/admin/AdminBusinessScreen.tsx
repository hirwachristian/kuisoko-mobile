import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Switch, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Trash2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { fetchAppSettings, updateAppSettings, sendAnnouncement, fetchBanners, deactivateBanner } from '../../api/admin';
import { AnnouncementBanner } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { Card, SectionTitle, FieldLabel, TextField, Button, EmptyState } from '../../components/admin/ui';
import AdminPaymentMethods from '../../components/admin/AdminPaymentMethods';

const AdminBusinessScreen: React.FC = () => {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [banners, setBanners] = useState<AnnouncementBanner[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showAsBanner, setShowAsBanner] = useState(false);
  const [bannerHours, setBannerHours] = useState('24');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingToggle, setIsSavingToggle] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    const [settings, { banners: fetched }] = await Promise.all([fetchAppSettings(), fetchBanners()]);
    setMarketingEnabled(settings.marketingEmailsEnabled);
    setBanners(fetched);
  }, []);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  const handleToggleMarketing = async (value: boolean) => {
    if (!token) return;
    setMarketingEnabled(value);
    setIsSavingToggle(true);
    try {
      await updateAppSettings({ marketingEmailsEnabled: value }, token);
    } catch (e) {
      setMarketingEnabled(!value);
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update setting.');
    } finally {
      setIsSavingToggle(false);
    }
  };

  const handleSend = async () => {
    if (!token || !subject.trim() || !message.trim()) {
      Alert.alert('Missing fields', 'Subject and message are required.');
      return;
    }
    setIsSending(true);
    try {
      const result = await sendAnnouncement({
        subject: subject.trim(), message: message.trim(), showAsBanner,
        bannerDurationHours: showAsBanner ? Number(bannerHours) || 24 : null,
      }, token);
      Alert.alert('Sent', `Emailed ${result.sent} of ${result.total} subscribers.`);
      setSubject('');
      setMessage('');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send announcement.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeactivateBanner = async (id: string) => {
    if (!token) return;
    await deactivateBanner(id, token);
    await load();
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionTitle>Payment Methods</SectionTitle>
      <AdminPaymentMethods />

      <SectionTitle style={{ marginTop: 24 }}>Marketing</SectionTitle>
      <Card style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Push Alerts</Text>
          <Text style={styles.switchDescription}>Allow sending marketing emails to newsletter subscribers</Text>
        </View>
        <Switch value={marketingEnabled} onValueChange={handleToggleMarketing} disabled={isSavingToggle} trackColor={{ true: colors.emerald800, false: colors.slate200 }} />
      </Card>

      <SectionTitle style={{ marginTop: 24 }}>Send Announcement</SectionTitle>
      <Card>
        <FieldLabel>Subject</FieldLabel>
        <TextField value={subject} onChangeText={setSubject} placeholder="Announcement subject" />
        <FieldLabel>Message</FieldLabel>
        <TextField value={message} onChangeText={setMessage} placeholder="Your message" multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top' }} />
        <View style={styles.switchRowInline}>
          <Text style={styles.switchLabel}>Also show as site banner</Text>
          <Switch value={showAsBanner} onValueChange={setShowAsBanner} trackColor={{ true: colors.emerald800, false: colors.slate200 }} />
        </View>
        {showAsBanner && (
          <>
            <FieldLabel>Banner duration (hours)</FieldLabel>
            <TextField value={bannerHours} onChangeText={setBannerHours} keyboardType="numeric" placeholder="24" />
          </>
        )}
        <Button label="Send Announcement" onPress={handleSend} loading={isSending} style={{ marginTop: 14 }} />
      </Card>

      <SectionTitle style={{ marginTop: 24 }}>Active Banners</SectionTitle>
      {banners.length === 0 ? (
        <Card><EmptyState label="No active banners" /></Card>
      ) : (
        banners.map((b) => (
          <Card key={b.id} style={styles.bannerRow}>
            <Text style={styles.bannerText} numberOfLines={2}>{b.message}</Text>
            <TouchableOpacity onPress={() => handleDeactivateBanner(b.id)}><Trash2 size={16} color={colors.rose500} /></TouchableOpacity>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchRowInline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  switchDescription: { fontSize: 11.5, color: colors.slate600, marginTop: 2 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  bannerText: { flex: 1, fontSize: 13, color: colors.slate700 },
});

export default AdminBusinessScreen;
