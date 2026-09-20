import { apiFetch } from './client';

export interface RiderDestination {
  lat: number;
  lng: number;
}

export interface RiderOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryPhoneNumber: string;
  deliveryStreetAddress: string;
  deliveryCityTown: string;
  deliveryDistrict: string;
  deliveryAdditionalInfo: string | null;
  destination: RiderDestination | null;
  acceptedAt: string | null;
}

export interface RiderHistoryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryStreetAddress: string;
  deliveryCityTown: string;
  deliveryDistrict: string;
  deliveredAt: string | null;
}

export interface ReassignedNotice {
  id: string;
  orderNumber: string;
  reassignedAt: string;
  newRiderName: string | null;
}

// Ports backend/src/routes/riders.ts exactly - see there for the full contract (narrow
// projections, one-active-delivery-at-a-time rule, etc.).
export const fetchMyDeliveries = (token: string) =>
  apiFetch<{ orders: RiderOrder[] }>('/riders/me/orders', {}, token);

export const acceptDelivery = (orderId: string, token: string) =>
  apiFetch<{ success: true }>(`/riders/me/orders/${orderId}/accept`, { method: 'POST' }, token);

export const verifyDelivery = (orderId: string, code: string, token: string) =>
  apiFetch(`/riders/me/orders/${orderId}/verify-delivery`, { method: 'POST', body: JSON.stringify({ code }) }, token);

export const fetchMyDeliveryHistory = (token: string) =>
  apiFetch<{ orders: RiderHistoryOrder[] }>('/riders/me/history', {}, token);

export const fetchReassignedNotices = (token: string) =>
  apiFetch<{ notices: ReassignedNotice[] }>('/riders/me/reassigned-notices', {}, token);

export const postRiderLocation = (lat: number, lng: number, token: string) =>
  apiFetch('/riders/me/location', { method: 'POST', body: JSON.stringify({ lat, lng }) }, token);

// `keepalive` (fetch's own option, no RN equivalent needed) let the website's version survive a
// page unload mid-request - not applicable here, since backgrounding the RN app doesn't tear down
// its JS context the same way a closed browser tab does.
export const notifyRiderStoppedSharing = (token: string) =>
  apiFetch('/riders/me/stop-sharing', { method: 'POST' }, token);
