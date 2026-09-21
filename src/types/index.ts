// Mirrors the relevant slice of frontend/types.ts and the backend's admin API response shapes
// (see backend/src/routes/*.ts) - kept to what the mobile app's screens actually render/send.

export interface ProductVariant {
  id: string;
  sku?: string;
  color?: string;
  size?: string;
  price: number;
  stock: number;
}

export interface ProductReview {
  id: string;
  userName: string;
  userUsername?: string;
  rating: number;
  comment: string | null;
  image: string | null;
  isHidden?: boolean;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discount?: number;
  category: string;
  subCategory: string;
  images: string[];
  videoUrls?: string[];
  rating: number;
  reviews: number;
  stock: number;
  featured?: boolean;
  groupBuyEnabled?: boolean;
  colorImages?: Record<string, string>;
  /** Per-image name/description override, keyed by image URL (one of `images`) - both optional.
   * Falls back to this product's own name/description wherever an image has no entry here. */
  imageDetails?: Record<string, { name?: string; description?: string }>;
  variants: ProductVariant[];
  reviewsList?: ProductReview[];
  ratingBreakdown?: Record<string, number>;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  role: 'user' | 'admin' | 'rider';
  profileImage?: string | null;
  isActive?: boolean;
  unread?: boolean;
  twoFactorEnabled?: boolean;
  registrationDate?: string;
}

export type OrderStatus = 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed';

export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  images: string[];
  price: number;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface DeliveryAddress {
  fullName: string;
  phoneNumber: string;
  email: string;
  country: string;
  cityTown: string;
  district: string;
  streetAddress: string;
  houseBuildingNumber?: string;
  additionalInfo?: string;
}

export interface TrackingEvent {
  id?: string;
  status: string;
  date: string;
  description: string;
}

export interface ReturnInfo {
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  adminNote?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
  customerUnread: boolean;
}

export interface Order {
  id: string;
  orderNumber?: string;
  userId?: string;
  customerName: string;
  deliveryAddress: DeliveryAddress;
  date: string;
  subtotal?: number;
  shippingFee?: number;
  shippingZone?: string;
  tax?: number;
  couponCode?: string;
  discountAmount?: number;
  total: number;
  currency?: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  items: OrderItem[];
  trackingHistory?: TrackingEvent[];
  unread?: boolean;
  riderId?: string | null;
  riderName?: string | null;
  deliveryVerificationCode?: string | null;
  riderStopAlertAt?: string | null;
  riderStopAlertUnread?: boolean;
  deliveryConfirmedAt?: string | null;
  deliveryConfirmedUnread?: boolean;
  returnRequest?: ReturnInfo | null;
}

export interface CategorySection {
  id: string;
  category_id: string;
  title: string;
  titleKin: string | null;
  items: string[];
  itemsKin: string[];
}

export interface Category {
  id: string;
  name: string;
  nameKin: string | null;
  sections: CategorySection[];
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  total: number;
  currency?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
  unread: boolean;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'replied';
  replyBody: string | null;
  repliedAt: string | null;
  unread: boolean;
  createdAt: string;
}

export interface ChatConversation {
  userId: string;
  name: string;
  email: string;
  profileImage: string | null;
  lastMessageBody: string | null;
  lastMessageAttachmentUrl: string | null;
  lastMessageAttachmentType: string | null;
  lastMessageAt: string;
  lastMessageSenderRole: 'user' | 'admin';
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  senderRole: 'user' | 'admin';
  senderId: string | null;
  body: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  createdAt: string;
  readByUser: boolean;
  readByAdmin: boolean;
}

export interface ShippingZone {
  id: string;
  name: string;
  districts: string[];
  fee: number;
  isDefault: boolean;
}

export interface AppSettings {
  maintenanceMode: boolean;
  defaultCurrency: string;
  defaultLanguage: string;
  marketingEmailsEnabled: boolean;
  currencies: { code: string; symbol: string; label: string; exchangeRate: number }[];
  languages: { code: string; label: string }[];
}

export interface AnnouncementBanner {
  id: string;
  message: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  productName: string;
  userName: string;
  rating: number;
  comment: string | null;
  image: string | null;
  isHidden: boolean;
  unread: boolean;
  date: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
  unread: boolean;
}

export interface CartLine {
  productId: string;
  quantity: number;
  selectedColor?: string | null;
  selectedSize?: string | null;
  // The exact product photo shown when this line was added - lets a product with no color
  // variants (e.g. several plain photos of different cap styles) still carry the specific photo
  // the customer was looking at through cart, checkout, and the saved order, instead of always
  // falling back to the product's first image.
  selectedImage?: string | null;
  unitPrice?: number | null;
}

// A cart line joined against the live product catalog - what every cart/checkout screen actually
// renders (the server only stores CartLine; the product's name/image/current price/stock come
// from whatever GET /products already returned).
export interface CartItem extends CartLine {
  product: Product;
}

export interface GroupOrderTier {
  minParticipants: number;
  discountPercent: number;
}

export interface GroupOrderStatusResponse {
  code: string;
  status: 'open' | 'full' | 'expired';
  expiresAt: string;
  maxParticipants: number;
  tiers: GroupOrderTier[];
  participantCount: number;
  currentDiscountPercent: number;
  product: { id: string; name: string; image: string; price: number; discount: number };
}
