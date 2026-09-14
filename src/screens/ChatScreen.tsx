import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, SafeAreaView, Linking, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Paperclip, Send, FileText, Download, File as FileIcon, Image as ImageIcon, Camera } from 'lucide-react-native';
import {
  fetchChatAdminStatus, fetchChatMessages, sendChatMessage, uploadChatAttachment,
} from '../api/customer';
import { ApiError } from '../api/client';
import { ChatMessage } from '../types';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AttachmentSourceSheet from '../components/AttachmentSourceSheet';

const STATUS_POLL_MS = 30000;
const OPEN_POLL_MS = 4000;

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

// Ports frontend/components/ChatWidget.tsx: one ongoing thread per customer with the shared admin
// inbox, polling (no websockets on the website either) - 30s for the online dot, 4s for messages
// while the thread is open (which also marks admin replies read server-side, same as web).
const ChatScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const styles = createStyles(colors);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAttachSheetVisible, setIsAttachSheetVisible] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const { messages: fetched } = await fetchChatMessages(token);
      setMessages(fetched);
    } catch {
      // transient network error - keep the existing list, next poll will retry
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let cancelled = false;
      loadMessages().finally(() => { if (!cancelled) setIsLoading(false); });
      const messagesInterval = setInterval(loadMessages, OPEN_POLL_MS);
      const pollStatus = () => fetchChatAdminStatus(token).then(({ online }) => setIsOnline(online)).catch(() => {});
      pollStatus();
      const statusInterval = setInterval(pollStatus, STATUS_POLL_MS);
      return () => { cancelled = true; clearInterval(messagesInterval); clearInterval(statusInterval); };
    }, [token, loadMessages])
  );

  const handleSend = async () => {
    if (!token || !text.trim() || isSending) return;
    const body = text.trim();
    setText('');
    setIsSending(true);
    setError('');
    try {
      const { message } = await sendChatMessage({ body }, token);
      setMessages((prev) => [...prev, message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setText(body);
      setError(e instanceof ApiError ? e.message : 'Could not send your message.');
    } finally {
      setIsSending(false);
    }
  };

  const sendAttachment = async (uri: string, name: string, mimeType: string) => {
    if (!token) return;
    setIsUploading(true);
    setError('');
    try {
      const { url } = await uploadChatAttachment(uri, name, mimeType, token);
      const { message } = await sendChatMessage({ attachmentUrl: url, attachmentType: mimeType, attachmentName: name }, token);
      setMessages((prev) => [...prev, message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the attachment.');
    } finally {
      setIsUploading(false);
    }
  };

  // Guards against calling getDocumentAsync a second time while a pick is already in flight -
  // the native module (ExpoDocumentPicker) throws PickingInProgressException if it's invoked
  // concurrently, and won't clear that "in progress" flag until the first call actually settles.
  const isPickingDocument = useRef(false);
  const handlePickDocument = async () => {
    if (isPickingDocument.current) return;
    isPickingDocument.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await sendAttachment(file.uri, file.name, file.mimeType ?? 'application/octet-stream');
    } finally {
      isPickingDocument.current = false;
    }
  };

  // No requestMediaLibraryPermissionsAsync() gate here on purpose - see ProductDetailScreen.tsx's
  // handlePickReviewImage for why: launchImageLibraryAsync opens the system picker out-of-process
  // and doesn't need library-wide access, and pre-requesting that broader permission ourselves is
  // what breaks in Expo Go with no way to fix it from Settings.
  const handlePickLibraryPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await sendAttachment(asset.uri, asset.fileName ?? `photo-${Date.now()}.jpg`, asset.mimeType ?? 'image/jpeg');
  };

  // Taking a photo IS a real hardware-access permission (unlike picking from the library), so it
  // still needs its own explicit request/Settings-fallback pattern.
  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        Alert.alert(
          'Camera access is off',
          'You previously denied camera access. Turn it on in Settings to take a photo.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
        );
      } else {
        Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await sendAttachment(asset.uri, asset.fileName ?? `photo-${Date.now()}.jpg`, asset.mimeType ?? 'image/jpeg');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {isOnline ? (
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Support is online</Text>
          </View>
        ) : (
          <Text style={styles.offlineText}>We usually reply within a few hours</Text>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>Send a message and our support team will get back to you here.</Text>}
          renderItem={({ item }) => {
            const isUser = item.senderRole === 'user';
            const isImage = item.attachmentType?.startsWith('image/');
            return (
              <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAdmin]}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAdmin]}>
                  {item.attachmentUrl && isImage && (
                    <Image source={{ uri: item.attachmentUrl }} style={styles.attachmentImage} resizeMode="cover" />
                  )}
                  {item.attachmentUrl && !isImage && (
                    <TouchableOpacity style={styles.attachmentFile} onPress={() => Linking.openURL(item.attachmentUrl!)}>
                      <FileText size={16} color={isUser ? colors.white : colors.slate600} />
                      <Text style={[styles.attachmentFileName, { color: isUser ? colors.white : colors.slate700 }]} numberOfLines={1}>
                        {item.attachmentName ?? 'Attachment'}
                      </Text>
                      <Download size={14} color={isUser ? colors.white : colors.slate600} />
                    </TouchableOpacity>
                  )}
                  {item.body && <Text style={[styles.bubbleText, { color: isUser ? colors.white : colors.slate900 }]}>{item.body}</Text>}
                  <Text style={[styles.bubbleTime, { color: isUser ? 'rgba(255,255,255,0.7)' : colors.slate400 }]}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            );
          }}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachButton} onPress={() => setIsAttachSheetVisible(true)} disabled={isUploading || isSending}>
            {isUploading ? <ActivityIndicator size="small" color={colors.slate600} /> : <Paperclip size={19} color={colors.slate600} />}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={colors.slate400}
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || isSending}
          >
            {isSending ? <ActivityIndicator size="small" color={colors.white} /> : <Send size={17} color={colors.white} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AttachmentSourceSheet
        visible={isAttachSheetVisible}
        title="Add Attachment"
        onClose={() => setIsAttachSheetVisible(false)}
        options={[
          { key: 'document', label: 'Choose File', Icon: FileIcon, onSelect: handlePickDocument },
          { key: 'library', label: 'Photo Library', Icon: ImageIcon, onSelect: handlePickLibraryPhoto },
          { key: 'camera', label: 'Take Photo', Icon: Camera, onSelect: handleTakePhoto },
        ]}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  header: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald600 },
  onlineText: { fontSize: 12.5, fontWeight: '700', color: colors.accentText },
  offlineText: { fontSize: 12.5, color: colors.slate400 },
  emptyText: { fontSize: 13, color: colors.slate400, textAlign: 'center', marginTop: 40, paddingHorizontal: 30 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAdmin: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleUser: { backgroundColor: colors.emerald800, borderBottomRightRadius: 4 },
  bubbleAdmin: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 6, alignSelf: 'flex-end' },
  attachmentImage: { width: 180, height: 130, borderRadius: 10, marginBottom: 6 },
  attachmentFile: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 8, marginBottom: 6 },
  attachmentFileName: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  error: { color: colors.rose600, fontSize: 12, textAlign: 'center', paddingBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.slate100,
  },
  attachButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.slate900, maxHeight: 100,
  },
  sendButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});

export default ChatScreen;
