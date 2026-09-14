import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, LayoutGrid, ShoppingCart, Heart, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import TabBarIcon from '../components/TabBarIcon';
import AnnouncementBanner from '../components/customer/AnnouncementBanner';
import ChatFab from '../components/customer/ChatFab';
import { DeliveryAddress } from '../types';
import { PlaceOrderItem } from '../api/customer';

import HomeScreen from '../screens/HomeScreen';
import ShopScreen from '../screens/ShopScreen';
import CartScreen from '../screens/CartScreen';
import WishlistScreen from '../screens/WishlistScreen';
import AccountScreen from '../screens/AccountScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import GroupOrderScreen from '../screens/GroupOrderScreen';
import CheckoutAddressScreen from '../screens/checkout/CheckoutAddressScreen';
import CheckoutPaymentScreen from '../screens/checkout/CheckoutPaymentScreen';
import CheckoutConfirmationScreen from '../screens/checkout/CheckoutConfirmationScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import AboutScreen from '../screens/AboutScreen';
import ContactScreen from '../screens/ContactScreen';
import ChatScreen from '../screens/ChatScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FaqScreen from '../screens/FaqScreen';
import ShippingPolicyScreen from '../screens/ShippingPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';

export type CustomerStackParamList = {
  Tabs: undefined;
  ProductDetail: { productId: string };
  GroupOrder: { code?: string; productId?: string };
  CheckoutAddress: { directBuyItem?: PlaceOrderItem } | undefined;
  CheckoutPayment: { addressData: DeliveryAddress; shippingFee?: number; shippingZoneName?: string; directBuyItem?: PlaceOrderItem };
  CheckoutConfirmation: { orderId: string };
  OrderHistory: undefined;
  OrderDetail: { orderId: string };
  About: undefined;
  Contact: undefined;
  Chat: undefined;
  EditProfile: undefined;
  Faq: undefined;
  ShippingPolicy: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

export type CustomerTabParamList = {
  Home: undefined;
  // `category`/`deals` left out entirely means "leave whatever filter is already active alone"
  // (e.g. just switching to the Shop tab); `null`/`false` means "explicitly clear this filter" -
  // distinct from omitting the key, which ShopScreen.tsx's focus-effect relies on to tell "go to
  // Shop with no filter" (Explore More, See All, Continue Shopping) apart from a plain tab press.
  Shop: { category?: string | null; deals?: boolean } | undefined;
  Cart: undefined;
  Wishlist: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();
const Tab = createBottomTabNavigator<CustomerTabParamList>();

const CartTabIcon: React.FC<{ color: string; focused: boolean }> = ({ color, focused }) => {
  const { itemCount } = useCart();
  return <TabBarIcon Icon={ShoppingCart} color={color} focused={focused} badge={itemCount > 0 ? itemCount : undefined} />;
};

const WishlistTabIcon: React.FC<{ color: string; focused: boolean }> = ({ color, focused }) => {
  const { productIds } = useWishlist();
  return <TabBarIcon Icon={Heart} color={color} focused={focused} badge={productIds.length > 0 ? productIds.length : undefined} />;
};

const CustomerTabs: React.FC = () => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  return (
    <View style={styles.tabsWrap}>
      <AnnouncementBanner />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accentText,
          tabBarInactiveTintColor: colors.slate400,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: colors.slate100,
            backgroundColor: colors.white,
            height: 58 + bottomPadding,
            paddingBottom: bottomPadding,
            paddingTop: 10,
            shadowColor: colors.slate900,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 8,
          },
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
          tabBarItemStyle: { paddingTop: 2 },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={Home} color={color} focused={focused} /> }} />
        <Tab.Screen name="Shop" component={ShopScreen} options={{ tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={LayoutGrid} color={color} focused={focused} /> }} />
        <Tab.Screen name="Cart" component={CartScreen} options={{ tabBarIcon: ({ color, focused }) => <CartTabIcon color={color} focused={focused} /> }} />
        <Tab.Screen name="Wishlist" component={WishlistScreen} options={{ tabBarIcon: ({ color, focused }) => <WishlistTabIcon color={color} focused={focused} /> }} />
        <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={User} color={color} focused={focused} /> }} />
      </Tab.Navigator>
      <ChatFab />
    </View>
  );
};

const styles = StyleSheet.create({ tabsWrap: { flex: 1 } });

// One shared stack wraps the whole tab bar so any tab can push Product Detail, Checkout, Group
// Order, Order History/Detail, About, or Contact - keeps those as single screens instead of
// duplicating them per-tab-stack, and mirrors the website's flat routing (any page can link to
// /product/:id or /cart regardless of where you started).
const CustomerNavigator: React.FC = () => {
  const { colors } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.slate900,
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { fontWeight: '800' as const },
        headerShadowVisible: true,
      }}
    >
      <Stack.Screen name="Tabs" component={CustomerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="GroupOrder" component={GroupOrderScreen} options={{ title: 'Group Order' }} />
      <Stack.Screen name="CheckoutAddress" component={CheckoutAddressScreen} options={{ title: 'Delivery Address' }} />
      <Stack.Screen name="CheckoutPayment" component={CheckoutPaymentScreen} options={{ title: 'Payment' }} />
      <Stack.Screen name="CheckoutConfirmation" component={CheckoutConfirmationScreen} options={{ title: 'Order Placed', headerBackVisible: false }} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ title: 'My Orders' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order Details' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About Us' }} />
      <Stack.Screen name="Contact" component={ContactScreen} options={{ title: 'Contact Us' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Support Chat' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Faq" component={FaqScreen} options={{ title: 'FAQ' }} />
      <Stack.Screen name="ShippingPolicy" component={ShippingPolicyScreen} options={{ title: 'Shipping Policy' }} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ title: 'Terms of Service' }} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
    </Stack.Navigator>
  );
};

export default CustomerNavigator;
