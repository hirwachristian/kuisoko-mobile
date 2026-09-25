import { apiFetch, createUploadFormData, API_BASE_URL, ApiError } from './client';
import {
  User, Product, Order, CartLine, GroupOrderStatusResponse, DeliveryAddress, ProductReview,
  AnnouncementBanner, ChatMessage, SavedAddress,
} from '../types';

// ---- Sign up ----
export interface SignUpInput {
  fullName: string;
  username: string;
  email: string;
  phoneNumber?: string;
  password: string;
}
export const signUp = (data: SignUpInput) =>
  apiFetch<{ user: User; token: string }>('/auth/signup', { method: 'POST', body: JSON.stringify(data) });

export interface UsernameCheckResult {
  available: boolean;
  error?: string;
  suggestions?: string[];
}
export const checkUsername = (username: string) =>
  apiFetch<UsernameCheckResult>(`/auth/check-username?username=${encodeURIComponent(username)}`);

// ---- Forgot / reset password (username-based, 3-step) ----
export const requestPasswordReset = (username: string) =>
  apiFetch<{ maskedEmail: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ username }) });
export const confirmPasswordResetRequest = (username: string) =>
  apiFetch<{ message: string }>('/auth/forgot-password/confirm', { method: 'POST', body: JSON.stringify({ username }) });
export const resetPassword = (token: string, newPassword: string) =>
  apiFetch<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });

// ---- Cart (server-persisted per account) ----
export const fetchCart = (token: string) => apiFetch<{ items: CartLine[] }>('/cart', {}, token);
export const upsertCartLine = (productId: string, data: Partial<CartLine>, token: string) =>
  apiFetch<void>(`/cart/${productId}`, { method: 'PUT', body: JSON.stringify(data) }, token);
export const removeCartLine = (productId: string, token: string) =>
  apiFetch<void>(`/cart/${productId}`, { method: 'DELETE' }, token);
export const clearCart = (token: string) => apiFetch<void>('/cart', { method: 'DELETE' }, token);

// ---- Wishlist (server-persisted per account) ----
export const fetchWishlist = (token: string) => apiFetch<{ productIds: string[] }>('/wishlist', {}, token);
export const addToWishlist = (productId: string, token: string) =>
  apiFetch<void>(`/wishlist/${productId}`, { method: 'POST' }, token);
export const removeFromWishlist = (productId: string, token: string) =>
  apiFetch<void>(`/wishlist/${productId}`, { method: 'DELETE' }, token);

// ---- Address Book (saved delivery addresses, server-persisted per account) ----
export type SavedAddressInput = Omit<SavedAddress, 'id' | 'lat' | 'lng'>;
export const fetchAddresses = (token: string) => apiFetch<{ addresses: SavedAddress[] }>('/addresses', {}, token);
export const createAddress = (data: SavedAddressInput, token: string) =>
  apiFetch<{ address: SavedAddress }>('/addresses', { method: 'POST', body: JSON.stringify(data) }, token);
export const updateAddress = (id: string, data: Partial<SavedAddressInput>, token: string) =>
  apiFetch<{ address: SavedAddress }>(`/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
export const deleteAddress = (id: string, token: string) =>
  apiFetch<void>(`/addresses/${id}`, { method: 'DELETE' }, token);
export const setDefaultAddress = (id: string, token: string) =>
  apiFetch<{ address: SavedAddress }>(`/addresses/${id}/default`, { method: 'POST' }, token);

// ---- Shipping & coupons (checkout) ----
export const calculateShipping = (district: string, subtotal: number) =>
  apiFetch<{ fee: number; zoneName: string; isFreeShipping: boolean }>('/shipping/calculate', { method: 'POST', body: JSON.stringify({ district, subtotal }) });
export const validateCoupon = (code: string, subtotal: number) =>
  apiFetch<{ code: string; discountAmount: number }>('/coupons/validate', { method: 'POST', body: JSON.stringify({ code, subtotal }) });

// ---- Checkout email verification (required before every order) ----
export const requestCheckoutVerification = (email: string, name?: string) =>
  apiFetch<{ success: true }>('/orders/verification/request', { method: 'POST', body: JSON.stringify({ email, name }) });
export const verifyCheckoutCode = (email: string, code: string) =>
  apiFetch<{ token: string }>('/orders/verification/verify', { method: 'POST', body: JSON.stringify({ email, code }) });

// ---- Orders (customer) ----
export interface PlaceOrderItem {
  productId?: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}
export interface PlaceOrderInput {
  customerName: string;
  deliveryAddress: DeliveryAddress;
  currency?: string;
  paymentMethod?: string;
  couponCode?: string;
  items: PlaceOrderItem[];
  verificationToken: string;
}
export const placeOrder = (data: PlaceOrderInput, token?: string | null) =>
  apiFetch<{ order: Order }>('/orders', { method: 'POST', body: JSON.stringify(data) }, token);
export const fetchMyOrders = (token: string) => apiFetch<{ orders: Order[] }>('/orders', {}, token);
export const fetchMyOrder = (id: string, token: string) => apiFetch<{ order: Order }>(`/orders/${id}`, {}, token);
export const fetchRiderLocation = (orderId: string, token: string) =>
  apiFetch<{
    riderId: string | null; riderName: string | null;
    location: { lat: number; lng: number; updatedAt: string } | null;
    isSharing: boolean; destination: { lat: number; lng: number } | null;
    arrivalNotifiedAt: string | null; riderReassignedAt: string | null;
  }>(`/orders/${orderId}/rider-location`, {}, token);
// Public - the same GET /settings/footer the website reads its footer contact info from. Only
// storeLat/storeLng are needed here, to plot the store's own marker on the delivery tracking map
// (frontend/components/RiderLocationMap.tsx reads the identical two fields off it for the same
// purpose) - not worth typing the rest of the footer response (contact links, copyright text) for
// a screen that only ever uses these two numbers.
export const fetchStoreLocation = () =>
  apiFetch<{ storeLat: number | null; storeLng: number | null }>('/settings/footer');
// Same endpoint, but the admin-configured contact details shown on ContactScreen - kept separate
// from fetchStoreLocation above since that one's typed to just the two map-marker fields.
export const fetchContactInfo = () =>
  apiFetch<{ emailAddress: string; phoneNumber: string; locationLines: string[] }>('/settings/footer');
// Admin-managed replacement for the hardcoded hero/about image arrays - the same pool the website's
// Home.tsx/AboutSection.tsx now read from (backend/src/routes/siteImages.ts), no auth required.
export const fetchSiteImages = () =>
  apiFetch<{ heroImages: string[]; aboutImages: string[] }>('/site-images/public');
export const requestReturn = (orderId: string, reason: string, token: string) =>
  apiFetch<{ id: string }>('/returns', { method: 'POST', body: JSON.stringify({ orderId, reason }) }, token);
export const acknowledgeReturnResolution = (returnId: string, token: string) =>
  apiFetch<void>(`/returns/${returnId}/acknowledge`, { method: 'PATCH' }, token);

// ---- MTN MoMo ----
export const requestMomoPayment = (orderId: string, phoneNumber: string) =>
  apiFetch<{ referenceId: string }>('/momo/request-to-pay', { method: 'POST', body: JSON.stringify({ orderId, phoneNumber }) });
export const fetchMomoStatus = (referenceId: string) =>
  apiFetch<{ status: 'PENDING' | 'SUCCESSFUL' | 'FAILED'; reason?: string }>(`/momo/status/${referenceId}`);

// ---- Wallet ----
// Same MTN MoMo/Paypack request->poll->settle contract as checkout above, but authenticated
// (a wallet requires an account) and crediting a balance instead of settling an order - see
// backend/src/lib/wallet.ts and backend/src/routes/wallet.ts.
export interface WalletSummary { balance: number; pendingDeposits: number; lifetimeTopups: number }
export interface WalletTransaction {
  id: string;
  type: 'topup' | 'purchase' | 'refund';
  amount: number;
  balanceAfter: number;
  reference: string | null;
  description: string;
  createdAt: string;
}
export const fetchWallet = (token: string) => apiFetch<WalletSummary>('/wallet', {}, token);
export const fetchWalletTransactions = (token: string) => apiFetch<{ transactions: WalletTransaction[] }>('/wallet/transactions', {}, token);
export const requestWalletTopupMomo = (phoneNumber: string, amount: number, token: string) =>
  apiFetch<{ referenceId: string }>('/wallet/topup/momo', { method: 'POST', body: JSON.stringify({ phoneNumber, amount }) }, token);
export const requestWalletTopupPaypack = (phoneNumber: string, amount: number, token: string) =>
  apiFetch<{ referenceId: string }>('/wallet/topup/paypack', { method: 'POST', body: JSON.stringify({ phoneNumber, amount }) }, token);
export const fetchWalletTopupStatus = (reference: string, token: string) =>
  apiFetch<{ status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' }>(`/wallet/topup/status/${reference}`, {}, token);
export const exportWalletStatementCsv = async (token: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/wallet/transactions/export`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new ApiError(response.status, 'Could not export wallet statement.');
  return response.text();
};

// ---- Group orders ----
export interface StartGroupOrderInput {
  productId: string;
  quantity?: number;
  customerName: string;
  deliveryAddress: DeliveryAddress;
  paymentMethod?: string;
}
export const startGroupOrder = (data: StartGroupOrderInput) =>
  apiFetch<{ code: string; order: Order }>('/group-orders', { method: 'POST', body: JSON.stringify(data) });
export const fetchGroupOrderStatus = (code: string) => apiFetch<GroupOrderStatusResponse>(`/group-orders/${code}`);
export interface JoinGroupOrderInput {
  quantity?: number;
  customerName: string;
  deliveryAddress: DeliveryAddress;
  paymentMethod?: string;
}
export const joinGroupOrder = (code: string, data: JoinGroupOrderInput) =>
  apiFetch<{ order: Order }>(`/group-orders/${code}/join`, { method: 'POST', body: JSON.stringify(data) });

// ---- Reviews (customer submits on a product) ----
export const submitReview = (productId: string, data: { rating: number; comment?: string; image?: string }, token: string) =>
  apiFetch<{ review: ProductReview }>(`/products/${productId}/reviews`, { method: 'POST', body: JSON.stringify(data) }, token);

// POST /uploads only requires being signed in (any role) - matches frontend/components/ReviewForm.tsx's
// upload-then-attach-the-url flow, not an admin-only endpoint.
export const uploadReviewImage = async (fileUri: string, fileName: string, mimeType: string, token: string) => {
  const formData = await createUploadFormData('file', fileUri, fileName, mimeType);
  return apiFetch<{ url: string }>('/uploads', { method: 'POST', body: formData }, token);
};
export const deleteUploadedFile = (url: string, token: string) =>
  apiFetch<void>('/uploads', { method: 'DELETE', body: JSON.stringify({ url }) }, token);

// ---- Public contact form ----
export const submitEnquiry = (data: { name: string; email: string; subject: string; message: string }) =>
  apiFetch<{ enquiry: unknown }>('/enquiries', { method: 'POST', body: JSON.stringify(data) });

// ---- Email change (dashboard-specific, separate from password) ----
export const requestEmailChange = (newEmail: string, token: string) =>
  apiFetch<{ message: string }>('/users/me/email-change', { method: 'POST', body: JSON.stringify({ newEmail }) }, token);
export const confirmEmailChange = (token: string) =>
  apiFetch<{ message: string }>('/users/email-change/confirm', { method: 'POST', body: JSON.stringify({ token }) });

// ---- Product fetch used across the customer app (Shop/Home already have fetchProducts via admin.ts's public GET) ----
export const fetchProductDetail = (id: string) => apiFetch<{ product: Product }>(`/products/${id}`);

// ---- Co-purchase & restock ----
export const fetchAlsoBought = (productId: string) => apiFetch<{ products: Product[] }>(`/products/${productId}/also-bought`);
export const requestRestockNotification = (productId: string, data: { email: string; color?: string; size?: string }) =>
  apiFetch<{ message: string }>(`/products/${productId}/notify-restock`, { method: 'POST', body: JSON.stringify(data) });

// ---- Visual/photo product search (public, no auth) ----
// Backend computes a perceptual hash of the uploaded photo and ranks the catalog by Hamming
// distance (backend/src/routes/products.ts POST /products/search-by-image) - a real, if
// lightweight, self-hosted visual search rather than a stub. Field name must be 'image' to match
// the backend's multer.single('image'); rate-limited to 20 requests/15min per IP.
export const searchProductsByImage = async (fileUri: string, fileName: string, mimeType: string) => {
  const formData = await createUploadFormData('image', fileUri, fileName, mimeType);
  return apiFetch<{ products: Product[] }>('/products/search-by-image', { method: 'POST', body: formData });
};

// ---- Newsletter ----
export const fetchNewsletterStatus = (token: string) => apiFetch<{ subscribed: boolean }>('/newsletter/status', {}, token);
export const subscribeToNewsletter = (token: string) => apiFetch<{ subscriber: unknown }>('/newsletter/subscribe', { method: 'POST' }, token);
export const unsubscribeFromNewsletter = (email: string) =>
  apiFetch<void>('/newsletter/unsubscribe', { method: 'POST', body: JSON.stringify({ email }) });

// ---- Announcement banners ----
export const fetchAnnouncementBanners = () => apiFetch<{ banners: AnnouncementBanner[] }>('/announcements/banners');

// ---- Push notifications (mobile-only - the website has no equivalent) ----
export const registerPushToken = (token: string, platform: 'ios' | 'android', authToken: string) =>
  apiFetch<void>('/users/me/push-token', { method: 'POST', body: JSON.stringify({ token, platform }) }, authToken);
export const unregisterPushToken = (token: string, authToken: string) =>
  apiFetch<void>('/users/me/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }, authToken);

// ---- Profile (name/phone/address/password/profile photo) ----
export interface UpdateProfileInput {
  name?: string;
  username?: string;
  phoneNumber?: string;
  address?: string;
  password?: string;
  currentPassword?: string;
  profileImage?: string | null;
}
export const updateProfile = (data: UpdateProfileInput, token: string) =>
  apiFetch<{ user: User }>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }, token);

// Same generic "upload any file, get a URL" helper as uploadReviewImage below - a named alias so
// the profile-photo call site reads clearly rather than looking like it's (mis-)reusing a
// review-photo function.
export const uploadProfilePhoto = uploadReviewImage;

// ---- Two-factor authentication (enable/disable for an already-signed-in account) ----
// Same backend routes as api/admin.ts's identical trio (POST /auth/2fa/enable/start|confirm,
// POST /auth/2fa/disable - generic, not admin-only) - duplicated here rather than importing from
// admin.ts, matching this file's existing convention of owning its own copy of shared upload
// helpers rather than reaching into the admin API module.
export const start2FAEnable = (token: string) =>
  apiFetch<{ message: string }>('/auth/2fa/enable/start', { method: 'POST' }, token);
export const confirm2FAEnable = (code: string, token: string) =>
  apiFetch<{ user: User; message: string }>('/auth/2fa/enable/confirm', { method: 'POST', body: JSON.stringify({ code }) }, token);
export const disable2FA = (password: string, token: string) =>
  apiFetch<{ user: User; message: string }>('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) }, token);

// ---- Chat (one ongoing thread per customer with the shared admin inbox) ----
export const fetchChatAdminStatus = (token: string) => apiFetch<{ online: boolean }>('/chat/admin-status', {}, token);
export const fetchChatMessages = (token: string) => apiFetch<{ messages: ChatMessage[] }>('/chat/messages', {}, token);
export const fetchChatUnreadCount = (token: string) => apiFetch<{ count: number }>('/chat/unread-count', {}, token);
export interface SendChatMessageInput {
  body?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
}
export const sendChatMessage = (data: SendChatMessageInput, token: string) =>
  apiFetch<{ message: ChatMessage }>('/chat/messages', { method: 'POST', body: JSON.stringify(data) }, token);
export const uploadChatAttachment = async (fileUri: string, fileName: string, mimeType: string, token: string) => {
  const formData = await createUploadFormData('file', fileUri, fileName, mimeType);
  return apiFetch<{ url: string; originalName: string }>('/uploads', { method: 'POST', body: formData }, token);
};
