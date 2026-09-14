import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken, unregisterPushToken } from '../api/customer';

// Notifications this app cares about (order status, chat replies) should still show while the app
// is open in the foreground, not just when backgrounded - matches how a native app is expected to
// behave, unlike the default Expo behavior of suppressing foreground alerts.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Remembered so logout can unregister the exact token this device registered, without needing to
// re-derive it (getExpoPushTokenAsync is itself a network call, not worth repeating on sign-out).
let registeredToken: string | null = null;

/** Best-effort: requests notification permission and registers this device's Expo push token
 * against the signed-in account. Never throws - a user must still be able to sign in/use the app
 * even if push registration fails (denied permission, simulator with no push capability, no
 * network, etc.). Requires a real device - the push service has nothing to register a token
 * against on a simulator/emulator. */
export async function registerForPushNotifications(authToken: string): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    registeredToken = expoPushToken;
    await registerPushToken(expoPushToken, Platform.OS === 'ios' ? 'ios' : 'android', authToken);
  } catch {
    // Best-effort - see function comment.
  }
}

/** Best-effort: tells the backend to stop sending pushes to this device's token. Called on
 * logout, before the auth token itself is discarded. */
export async function unregisterPushNotifications(authToken: string): Promise<void> {
  if (!registeredToken) return;
  try {
    await unregisterPushToken(registeredToken, authToken);
  } catch {
    // Best-effort - a stale token left behind just means one extra no-op send later, not a bug
    // worth surfacing to the user on their way out.
  } finally {
    registeredToken = null;
  }
}
