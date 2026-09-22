import { apiFetch, ApiError, API_BASE_URL, createUploadFormData } from './client';
import {
  Order, OrderStatus, Product, User, Category, CategorySection, Coupon, ReturnRequest, Enquiry,
  ChatConversation, ChatMessage, ShippingZone, AppSettings, AnnouncementBanner, Review, NewsletterSubscriber,
} from '../types';

// Every function takes the admin's token explicitly (mirrors AuthContext's own apiFetch calls)
// rather than reading from context internally, so these stay plain, testable functions.

// ---- Orders ----
export const fetchOrders = (token: string) => apiFetch<{ orders: Order[] }>('/orders', {}, token);
export const fetchOrder = (id: string, token: string) => apiFetch<{ order: Order }>(`/orders/${id}`, {}, token);
export const updateOrderStatus = (id: string, status: OrderStatus, token: string) =>
  apiFetch<{ order: Order }>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token);
export const confirmOrderPayment = (id: string, token: string) =>
  apiFetch<{ order: Order }>(`/orders/${id}/confirm-payment`, { method: 'PATCH' }, token);
export const assignOrderRider = (id: string, riderId: string | null, token: string) =>
  apiFetch<{ order: Order }>(`/orders/${id}/rider`, { method: 'PATCH', body: JSON.stringify({ riderId }) }, token);
export const deleteOrder = (id: string, token: string) =>
  apiFetch<void>(`/orders/${id}`, { method: 'DELETE' }, token);
export const markOrderRead = (id: string, token: string) =>
  apiFetch<{ order: Order }>(`/orders/${id}/read`, { method: 'PATCH' }, token);
export const acknowledgeRiderStop = (id: string, token: string) =>
  apiFetch<{ order: Order }>(`/orders/${id}/acknowledge-rider-stop`, { method: 'PATCH' }, token);
export const acknowledgeDelivery = (id: string, token: string) =>
  apiFetch<{ order: Order }>(`/orders/${id}/acknowledge-delivery`, { method: 'PATCH' }, token);
export const sendInvoice = (id: string, pdfBase64: string, token: string) =>
  apiFetch<{ success: true }>(`/orders/${id}/send-invoice`, { method: 'POST', body: JSON.stringify({ pdfBase64 }) }, token);

// ---- Products ----
export const fetchProducts = () => apiFetch<{ products: Product[] }>('/products');
export const fetchProduct = (id: string) => apiFetch<{ product: Product }>(`/products/${id}`);
export type ProductInput = Omit<Product, 'id' | 'rating' | 'reviews' | 'variants'> & {
  variants: (Omit<Product['variants'][number], 'id'> & { id?: string })[];
};
export const createProduct = (data: Partial<ProductInput>, token: string) =>
  apiFetch<{ product: Product }>('/products', { method: 'POST', body: JSON.stringify(data) }, token);
export const updateProduct = (id: string, data: Partial<ProductInput>, token: string) =>
  apiFetch<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
export const deleteProduct = (id: string, token: string) =>
  apiFetch<void>(`/products/${id}`, { method: 'DELETE' }, token);

// CSV export/import bypass apiFetch since the response/request isn't JSON.
export const exportProductsCsv = async (token: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/products/export/csv`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new ApiError(response.status, 'Could not export products.');
  return response.text();
};
export interface ImportCsvResult { created: number; updated: number; errors: { row: number; message: string }[] }
export const importProductsCsv = async (fileUri: string, fileName: string, token: string): Promise<ImportCsvResult> => {
  const formData = await createUploadFormData('file', fileUri, fileName, 'text/csv');
  return apiFetch<ImportCsvResult>('/products/import/csv', { method: 'POST', body: formData }, token);
};

// ---- Uploads (product images, profile images, chat attachments) ----
export const uploadFile = async (
  fileUri: string,
  fileName: string,
  mimeType: string,
  token: string
): Promise<{ url: string; originalName: string }> => {
  const formData = await createUploadFormData('file', fileUri, fileName, mimeType);
  return apiFetch<{ url: string; originalName: string }>('/uploads', { method: 'POST', body: formData }, token);
};

// ---- Users ----
export const fetchUsers = (token: string) => apiFetch<{ users: User[] }>('/users', {}, token);
export const markUserRead = (id: string, token: string) =>
  apiFetch<{ user: User }>(`/users/${id}/read`, { method: 'PATCH' }, token);
export interface UserInput {
  name: string;
  username?: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  role?: 'user' | 'admin' | 'rider';
  password: string;
}
export const createUser = (data: UserInput, token: string) =>
  apiFetch<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(data) }, token);
export const updateUser = (id: string, data: Partial<UserInput & { isActive: boolean }>, token: string) =>
  apiFetch<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
export const deleteUser = (id: string, token: string) =>
  apiFetch<void>(`/users/${id}`, { method: 'DELETE' }, token);

// ---- Categories ----
export const fetchCategories = () => apiFetch<{ categories: Category[] }>('/categories');
export const createCategory = (data: { name: string; nameKin?: string }, token: string) =>
  apiFetch<{ category: { id: string; name: string; nameKin: string | null } }>('/categories', { method: 'POST', body: JSON.stringify(data) }, token);
export const updateCategory = (id: string, data: { name?: string; nameKin?: string }, token: string) =>
  apiFetch<{ category: { id: string; name: string; nameKin: string | null } }>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
export const deleteCategory = (id: string, token: string) =>
  apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }, token);
export const createSection = (categoryId: string, data: { title: string; titleKin?: string; items?: string[]; itemsKin?: string[] }, token: string) =>
  apiFetch<{ section: CategorySection }>(`/categories/${categoryId}/sections`, { method: 'POST', body: JSON.stringify(data) }, token);
export const updateSection = (categoryId: string, sectionId: string, data: { title?: string; titleKin?: string; items?: string[]; itemsKin?: string[] }, token: string) =>
  apiFetch<{ section: CategorySection }>(`/categories/${categoryId}/sections/${sectionId}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
export const deleteSection = (categoryId: string, sectionId: string, token: string) =>
  apiFetch<void>(`/categories/${categoryId}/sections/${sectionId}`, { method: 'DELETE' }, token);
export const translateTexts = (texts: string[], token: string) =>
  apiFetch<{ translations: (string | null)[] }>('/categories/translate', { method: 'POST', body: JSON.stringify({ texts }) }, token);

// ---- Coupons ----
export const fetchCoupons = (token: string) => apiFetch<{ coupons: Coupon[] }>('/coupons', {}, token);
export interface CouponInput {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  usageLimit?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}
export const createCoupon = (data: CouponInput, token: string) =>
  apiFetch<{ coupon: Coupon }>('/coupons', { method: 'POST', body: JSON.stringify(data) }, token);
export const updateCoupon = (id: string, data: Partial<CouponInput>, token: string) =>
  apiFetch<{ coupon: Coupon }>(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
export const deleteCoupon = (id: string, token: string) =>
  apiFetch<void>(`/coupons/${id}`, { method: 'DELETE' }, token);

// ---- Returns ----
export const fetchReturns = (token: string) => apiFetch<{ returnRequests: ReturnRequest[] }>('/returns', {}, token);
export const markReturnRead = (id: string, token: string) =>
  apiFetch<void>(`/returns/${id}/read`, { method: 'PATCH' }, token);
export const approveReturn = (id: string, token: string) =>
  apiFetch<{ returnRequest: ReturnRequest }>(`/returns/${id}/approve`, { method: 'POST' }, token);
export const rejectReturn = (id: string, note: string, token: string) =>
  apiFetch<{ returnRequest: ReturnRequest }>(`/returns/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }, token);

// ---- Enquiries ----
export const fetchEnquiries = (token: string) => apiFetch<{ enquiries: Enquiry[] }>('/enquiries', {}, token);
export const fetchEnquiryUnreadCount = (token: string) => apiFetch<{ count: number }>('/enquiries/unread-count', {}, token);
export const fetchEnquiry = (id: string, token: string) => apiFetch<{ enquiry: Enquiry }>(`/enquiries/${id}`, {}, token);
export const replyToEnquiry = (id: string, replyBody: string, token: string) =>
  apiFetch<{ enquiry: Enquiry }>(`/enquiries/${id}/reply`, { method: 'POST', body: JSON.stringify({ replyBody }) }, token);
export const deleteEnquiry = (id: string, token: string) =>
  apiFetch<void>(`/enquiries/${id}`, { method: 'DELETE' }, token);

// ---- Chat (admin side) ----
export const fetchConversations = (token: string) => apiFetch<{ conversations: ChatConversation[] }>('/chat/conversations', {}, token);
export const fetchAdminUnreadCount = (token: string) => apiFetch<{ count: number }>('/chat/admin-unread-count', {}, token);
export const fetchThread = (userId: string, token: string) => apiFetch<{ messages: ChatMessage[] }>(`/chat/messages/${userId}`, {}, token);
export const sendAdminMessage = (
  userId: string,
  data: { body?: string; attachmentUrl?: string; attachmentType?: string; attachmentName?: string },
  token: string
) => apiFetch<{ message: ChatMessage }>(`/chat/messages/${userId}`, { method: 'POST', body: JSON.stringify(data) }, token);

// ---- Store configuration (shipping) ----
export const fetchShippingZones = () => apiFetch<{ zones: ShippingZone[] }>('/shipping/zones');
export const createShippingZone = (data: { name: string; districts?: string[]; fee: number; isDefault?: boolean }, token: string) =>
  apiFetch<{ zone: ShippingZone }>('/shipping/zones', { method: 'POST', body: JSON.stringify(data) }, token);
export const updateShippingZone = (id: string, data: Partial<{ name: string; districts: string[]; fee: number; isDefault: boolean }>, token: string) =>
  apiFetch<{ zone: ShippingZone }>(`/shipping/zones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
export const deleteShippingZone = (id: string, token: string) =>
  apiFetch<void>(`/shipping/zones/${id}`, { method: 'DELETE' }, token);
export const fetchFreeShippingThreshold = () => apiFetch<{ freeShippingThreshold: number }>('/shipping/settings');
export const updateFreeShippingThreshold = (freeShippingThreshold: number, token: string) =>
  apiFetch<{ freeShippingThreshold: number }>('/shipping/settings', { method: 'PATCH', body: JSON.stringify({ freeShippingThreshold }) }, token);

// ---- Business & notifications ----
export interface PaymentMethod { name: string; enabled: boolean; detail: string }
export const fetchPaymentMethods = () => apiFetch<{ paymentMethods: PaymentMethod[] }>('/settings/payment-methods');
export const updatePaymentMethods = (methods: PaymentMethod[], token: string) =>
  apiFetch<{ paymentMethods: PaymentMethod[] }>('/settings/payment-methods', { method: 'PUT', body: JSON.stringify({ methods }) }, token);
export const fetchAppSettings = () => apiFetch<AppSettings>('/settings/app');
export const updateAppSettings = (data: Partial<AppSettings>, token: string) =>
  apiFetch<AppSettings>('/settings/app', { method: 'PATCH', body: JSON.stringify(data) }, token);
export const sendAnnouncement = (
  data: { subject: string; message: string; showAsBanner?: boolean; bannerDurationHours?: number | null },
  token: string
) => apiFetch<{ sent: number; total: number; banner: AnnouncementBanner | null }>('/announcements/send', { method: 'POST', body: JSON.stringify(data) }, token);
export const fetchBanners = () => apiFetch<{ banners: AnnouncementBanner[] }>('/announcements/banners');
export const deactivateBanner = (id: string, token: string) =>
  apiFetch<void>(`/announcements/banners/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }, token);

// ---- My own account (used by Account & Security) ----
export interface UpdateMeInput {
  name?: string; username?: string; phoneNumber?: string; address?: string;
  profileImage?: string | null; password?: string; currentPassword?: string;
}
export const updateMe = (data: UpdateMeInput, token: string) =>
  apiFetch<{ user: User }>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }, token);
export const start2FAEnable = (token: string) =>
  apiFetch<{ message: string }>('/auth/2fa/enable/start', { method: 'POST' }, token);
export const confirm2FAEnable = (code: string, token: string) =>
  apiFetch<{ user: User; message: string }>('/auth/2fa/enable/confirm', { method: 'POST', body: JSON.stringify({ code }) }, token);
export const disable2FA = (password: string, token: string) =>
  apiFetch<{ user: User; message: string }>('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) }, token);

// ---- Notifications feed sources (reviews + newsletter subscribers) ----
export const fetchReviews = (token: string) => apiFetch<{ reviews: Review[] }>('/reviews', {}, token);
export const markReviewRead = (id: string, token: string) =>
  apiFetch<void>(`/reviews/${id}/read`, { method: 'PATCH' }, token);
export const fetchSubscribers = (token: string) => apiFetch<{ subscribers: NewsletterSubscriber[] }>('/newsletter', {}, token);
export const markSubscriberRead = (id: string, token: string) =>
  apiFetch<void>(`/newsletter/${id}/read`, { method: 'PATCH' }, token);

// ---- Notification dismissal (composite ids like "order-<id>", "user-<id>", etc. - same shape
// the website's NotificationPanel.tsx builds, so hiding one here also hides it there) ----
export const fetchDismissedNotificationIds = (token: string) => apiFetch<{ ids: string[] }>('/notifications/dismissed', {}, token);
export const dismissNotifications = (ids: string[], token: string) =>
  apiFetch<void>('/notifications/dismissed', { method: 'POST', body: JSON.stringify({ ids }) }, token);
