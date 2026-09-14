import { createNavigationContainerRef } from '@react-navigation/native';

// A module-level ref so code outside the component tree (the push-notification tap handler in
// App.tsx, which fires from an OS-level event, not a screen) can still navigate - React Navigation
// has no other way to reach the navigator from there.
export const navigationRef = createNavigationContainerRef();

/** Routes a tapped push notification to the screen it's about - both push types this app sends
 * (see backend/src/lib/pushNotifications.ts callers) only ever target a customer account, so both
 * destinations always exist in whichever tree is mounted by the time a signed-in user can receive
 * one. `isReady()` guards the narrow window before the container has mounted at all. */
export function navigateFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data || !navigationRef.isReady()) return;
  // The ref is intentionally untyped (no single ParamList spans both the admin and customer
  // navigators), so this leans on the same `as never`-cast escape hatch already used elsewhere in
  // this codebase for cross-stack navigation calls.
  const navigate = navigationRef.navigate as (name: string, params?: object) => void;
  if (data.type === 'order-status' && typeof data.orderId === 'string') {
    navigate('OrderDetail', { orderId: data.orderId });
  } else if (data.type === 'chat-message') {
    navigate('Chat');
  }
}
