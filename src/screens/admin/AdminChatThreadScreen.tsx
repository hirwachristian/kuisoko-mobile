import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Send, Paperclip } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useAdminNotifications } from '../../context/AdminNotificationsContext';
import { fetchThread, sendAdminMessage, uploadFile } from '../../api/admin';
import { ChatMessage } from '../../types';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import type { AdminMoreStackParamList } from '../../navigation/AdminNavigator';

type Props = NativeStackScreenProps<AdminMoreStackParamList, 'ChatThread'>;

const AdminChatThreadScreen: React.FC<Props> = ({ route }) => {
  const { userId } = route.params;
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const { refresh: refreshAdminNotifications } = useAdminNotifications();
  const styles = createStyles(colors);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  // GET /chat/messages/:userId marks this thread's messages read server-side as a side effect
  // (backend/src/routes/chat.ts) - refresh the "More" tab badge right after so it doesn't wait for
  // the next poll tick.
  const load = useCallback(async () => {
    if (!token) return;
    const { messages: fetched } = await fetchThread(userId, token);
    setMessages(fetched);
    refreshAdminNotifications();
  }, [userId, token, refreshAdminNotifications]);

  useFocusEffect(useCallback(() => { load().finally(() => setIsLoading(false)); }, [load]));

  const handleSend = async () => {
    if (!token || !body.trim()) return;
    setIsSending(true);
    try {
      const { message } = await sendAdminMessage(userId, { body: body.trim() }, token);
      setMessages((prev) => [...prev, message]);
      setBody('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAttach = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to send an attachment.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !token) return;
    const asset = result.assets[0];
    setIsSending(true);
    try {
      const fileName = asset.fileName ?? `chat-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const { url } = await uploadFile(asset.uri, fileName, mimeType, token);
      const { message } = await sendAdminMessage(userId, { attachmentUrl: url, attachmentType: mimeType, attachmentName: fileName }, token);
      setMessages((prev) => [...prev, message]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send attachment.');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isAdmin = item.senderRole === 'admin';
          return (
            <View style={[styles.bubbleRow, isAdmin && styles.bubbleRowMine]}>
              <View style={[styles.bubble, isAdmin ? styles.bubbleMine : styles.bubbleTheirs]}>
                {item.attachmentUrl && item.attachmentType?.startsWith('image') && (
                  <Image source={{ uri: item.attachmentUrl }} style={styles.attachmentImage} resizeMode="cover" />
                )}
                {item.body && (
                  <Text style={[styles.bubbleText, isAdmin ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>{item.body}</Text>
                )}
                <Text style={[styles.bubbleTime, isAdmin ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={handleAttach} style={styles.attachButton} disabled={isSending}>
          <Paperclip size={20} color={colors.slate600} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Type a message..."
          placeholderTextColor={colors.slate400}
          multiline
        />
        <TouchableOpacity onPress={handleSend} style={styles.sendButton} disabled={isSending || !body.trim()}>
          {isSending ? <ActivityIndicator color={colors.white} size="small" /> : <Send size={18} color={colors.white} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.emerald800, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14 },
  bubbleTextMine: { color: colors.white },
  bubbleTextTheirs: { color: colors.slate900 },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  bubbleTimeTheirs: { color: colors.slate400 },
  attachmentImage: { width: 180, height: 180, borderRadius: 12, marginBottom: 6 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  attachButton: { padding: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.slate50,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.slate900,
    maxHeight: 100,
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.emerald800, alignItems: 'center', justifyContent: 'center' },
});

export default AdminChatThreadScreen;
