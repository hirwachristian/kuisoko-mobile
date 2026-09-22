import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Mail, Phone, MapPin, CheckCircle2 } from 'lucide-react-native';
import { submitEnquiry, fetchContactInfo } from '../api/customer';
import { ApiError } from '../api/client';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button, TextField, FieldLabel } from '../components/admin/ui';

const ContactScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const styles = createStyles(colors);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);
  // The admin-configured support email/phone/address (Settings > Store Configuration on the
  // website) - was previously hardcoded here to placeholder values that never matched.
  const [contactInfo, setContactInfo] = useState<{ emailAddress: string; phoneNumber: string; locationLines: string[] } | null>(null);

  useEffect(() => {
    fetchContactInfo().then(setContactInfo).catch(() => {});
  }, []);

  const isValid = name.trim() && email.trim() && subject.trim() && message.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    setError('');
    try {
      await submitEnquiry({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() });
      setIsSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send your message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Get in Touch</Text>
          <Text style={styles.subheading}>Have a question? We're happy to help.</Text>

          {!!contactInfo?.emailAddress && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}><Mail size={16} color={colors.accentText} /></View>
              <Text style={styles.infoText}>{contactInfo.emailAddress}</Text>
            </View>
          )}
          {!!contactInfo?.phoneNumber && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}><Phone size={16} color={colors.accentText} /></View>
              <Text style={styles.infoText}>{contactInfo.phoneNumber}</Text>
            </View>
          )}
          {!!contactInfo?.locationLines?.length && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}><MapPin size={16} color={colors.accentText} /></View>
              <Text style={styles.infoText}>{contactInfo.locationLines.join(', ')}</Text>
            </View>
          )}

          {isSent ? (
            <View style={styles.sentCard}>
              <CheckCircle2 size={32} color={colors.emerald600} />
              <Text style={styles.sentText}>Your message has been sent. We'll get back to you soon.</Text>
            </View>
          ) : (
            <View style={styles.formCard}>
              <FieldLabel>Name</FieldLabel>
              <TextField value={name} onChangeText={setName} />
              <FieldLabel>Email</FieldLabel>
              <TextField value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <FieldLabel>Subject</FieldLabel>
              <TextField value={subject} onChangeText={setSubject} />
              <FieldLabel>Message</FieldLabel>
              <TextField value={message} onChangeText={setMessage} multiline numberOfLines={5} style={{ minHeight: 100, textAlignVertical: 'top' }} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Send Message" onPress={handleSubmit} disabled={!isValid} loading={isSubmitting} style={{ marginTop: 16 }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  heading: { fontSize: 22, fontWeight: '900', color: colors.slate900, marginBottom: 6 },
  subheading: { fontSize: 14, color: colors.slate600, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  infoIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.emerald50, alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: 13, fontWeight: '600', color: colors.slate700 },
  formCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.slate100, marginTop: 12 },
  error: { color: colors.rose600, fontSize: 13, marginTop: 14, textAlign: 'center' },
  sentCard: { backgroundColor: colors.emerald50, borderRadius: 18, padding: 24, alignItems: 'center', marginTop: 16, gap: 10 },
  sentText: { fontSize: 13, color: colors.slate700, textAlign: 'center', lineHeight: 19 },
});

export default ContactScreen;
