import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, ClipboardList, Package, Users, MoreHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { AdminNotificationsProvider, useAdminNotifications } from '../context/AdminNotificationsContext';
import TabBarIcon from '../components/TabBarIcon';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminOrderDetailScreen from '../screens/admin/AdminOrderDetailScreen';
import AdminProductsScreen from '../screens/admin/AdminProductsScreen';
import AdminProductFormScreen from '../screens/admin/AdminProductFormScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminUserFormScreen from '../screens/admin/AdminUserFormScreen';
import AdminMoreMenuScreen from '../screens/admin/AdminMoreMenuScreen';
import AdminCategoriesScreen from '../screens/admin/AdminCategoriesScreen';
import AdminCategoryDetailScreen from '../screens/admin/AdminCategoryDetailScreen';
import AdminCouponsScreen from '../screens/admin/AdminCouponsScreen';
import AdminCouponFormScreen from '../screens/admin/AdminCouponFormScreen';
import AdminReturnsScreen from '../screens/admin/AdminReturnsScreen';
import AdminReturnDetailScreen from '../screens/admin/AdminReturnDetailScreen';
import AdminEnquiriesScreen from '../screens/admin/AdminEnquiriesScreen';
import AdminEnquiryDetailScreen from '../screens/admin/AdminEnquiryDetailScreen';
import AdminMessagesScreen from '../screens/admin/AdminMessagesScreen';
import AdminChatThreadScreen from '../screens/admin/AdminChatThreadScreen';
import AdminStoreConfigScreen from '../screens/admin/AdminStoreConfigScreen';
import AdminBusinessScreen from '../screens/admin/AdminBusinessScreen';
import AdminAccountSecurityScreen from '../screens/admin/AdminAccountSecurityScreen';

export type AdminOrdersStackParamList = {
  OrdersList: undefined;
  OrderDetail: { orderId: string };
};
export type AdminProductsStackParamList = {
  ProductsList: undefined;
  ProductForm: { productId?: string };
};
export type AdminUsersStackParamList = {
  UsersList: undefined;
  UserForm: { userId?: string };
};
export type AdminMoreStackParamList = {
  MoreMenu: undefined;
  Categories: undefined;
  CategoryDetail: { categoryId: string };
  Coupons: undefined;
  CouponForm: { couponId?: string };
  Returns: undefined;
  ReturnDetail: { returnId: string };
  Enquiries: undefined;
  EnquiryDetail: { enquiryId: string };
  Messages: undefined;
  ChatThread: { userId: string; name: string };
  StoreConfig: undefined;
  Business: undefined;
  AccountSecurity: undefined;
};

const OrdersStack = createNativeStackNavigator<AdminOrdersStackParamList>();
const OrdersStackNavigator = () => {
  const { colors } = useAppTheme();
  const stackScreenOptions = {
    headerTintColor: colors.slate900,
    headerStyle: { backgroundColor: colors.white },
    headerTitleStyle: { fontWeight: '800' as const },
    headerShadowVisible: true,
  };
  return (
    <OrdersStack.Navigator screenOptions={stackScreenOptions}>
      <OrdersStack.Screen name="OrdersList" component={AdminOrdersScreen} options={{ title: 'Orders' }} />
      <OrdersStack.Screen name="OrderDetail" component={AdminOrderDetailScreen} options={{ title: 'Order' }} />
    </OrdersStack.Navigator>
  );
};

const ProductsStack = createNativeStackNavigator<AdminProductsStackParamList>();
const ProductsStackNavigator = () => {
  const { colors } = useAppTheme();
  const stackScreenOptions = {
    headerTintColor: colors.slate900,
    headerStyle: { backgroundColor: colors.white },
    headerTitleStyle: { fontWeight: '800' as const },
    headerShadowVisible: true,
  };
  return (
    <ProductsStack.Navigator screenOptions={stackScreenOptions}>
      <ProductsStack.Screen name="ProductsList" component={AdminProductsScreen} options={{ title: 'Products' }} />
      <ProductsStack.Screen name="ProductForm" component={AdminProductFormScreen} options={{ title: 'Product' }} />
    </ProductsStack.Navigator>
  );
};

const UsersStack = createNativeStackNavigator<AdminUsersStackParamList>();
const UsersStackNavigator = () => {
  const { colors } = useAppTheme();
  const stackScreenOptions = {
    headerTintColor: colors.slate900,
    headerStyle: { backgroundColor: colors.white },
    headerTitleStyle: { fontWeight: '800' as const },
    headerShadowVisible: true,
  };
  return (
    <UsersStack.Navigator screenOptions={stackScreenOptions}>
      <UsersStack.Screen name="UsersList" component={AdminUsersScreen} options={{ title: 'Users' }} />
      <UsersStack.Screen name="UserForm" component={AdminUserFormScreen} options={{ title: 'User' }} />
    </UsersStack.Navigator>
  );
};

const MoreStack = createNativeStackNavigator<AdminMoreStackParamList>();
const MoreStackNavigator = () => {
  const { colors } = useAppTheme();
  const stackScreenOptions = {
    headerTintColor: colors.slate900,
    headerStyle: { backgroundColor: colors.white },
    headerTitleStyle: { fontWeight: '800' as const },
    headerShadowVisible: true,
  };
  return (
    <MoreStack.Navigator screenOptions={stackScreenOptions}>
      <MoreStack.Screen name="MoreMenu" component={AdminMoreMenuScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Categories" component={AdminCategoriesScreen} options={{ title: 'Categories' }} />
      <MoreStack.Screen name="CategoryDetail" component={AdminCategoryDetailScreen} options={{ title: 'Category' }} />
      <MoreStack.Screen name="Coupons" component={AdminCouponsScreen} options={{ title: 'Coupons' }} />
      <MoreStack.Screen name="CouponForm" component={AdminCouponFormScreen} options={{ title: 'Coupon' }} />
      <MoreStack.Screen name="Returns" component={AdminReturnsScreen} options={{ title: 'Returns' }} />
      <MoreStack.Screen name="ReturnDetail" component={AdminReturnDetailScreen} options={{ title: 'Return Request' }} />
      <MoreStack.Screen name="Enquiries" component={AdminEnquiriesScreen} options={{ title: 'Enquiries' }} />
      <MoreStack.Screen name="EnquiryDetail" component={AdminEnquiryDetailScreen} options={{ title: 'Enquiry' }} />
      <MoreStack.Screen name="Messages" component={AdminMessagesScreen} options={{ title: 'Messages' }} />
      <MoreStack.Screen name="ChatThread" component={AdminChatThreadScreen} options={({ route }) => ({ title: route.params.name })} />
      <MoreStack.Screen name="StoreConfig" component={AdminStoreConfigScreen} options={{ title: 'Store Configuration' }} />
      <MoreStack.Screen name="Business" component={AdminBusinessScreen} options={{ title: 'Business & Notifications' }} />
      <MoreStack.Screen name="AccountSecurity" component={AdminAccountSecurityScreen} options={{ title: 'Account & Security' }} />
    </MoreStack.Navigator>
  );
};

const Tab = createBottomTabNavigator();

const AdminTabs: React.FC = () => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { pendingOrdersCount, unreadUsersCount, moreCount } = useAdminNotifications();
  // The default tab bar height/padding ignores the device's safe-area inset, so on phones with a
  // home indicator (no physical home button) the icons/labels end up crammed just above it - this
  // adds the real inset on top of a comfortable base padding instead of a fixed guess.
  const bottomPadding = Math.max(insets.bottom, 8);
  return (
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={LayoutDashboard} color={color} focused={focused} /> }} />
      <Tab.Screen name="Orders" component={OrdersStackNavigator} options={{ tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={ClipboardList} color={color} focused={focused} badge={pendingOrdersCount} /> }} />
      <Tab.Screen name="Products" component={ProductsStackNavigator} options={{ tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={Package} color={color} focused={focused} /> }} />
      <Tab.Screen name="Users" component={UsersStackNavigator} options={{ tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={Users} color={color} focused={focused} badge={unreadUsersCount} /> }} />
      <Tab.Screen name="More" component={MoreStackNavigator} options={{ tabBarIcon: ({ color, focused }) => <TabBarIcon Icon={MoreHorizontal} color={color} focused={focused} badge={moreCount} /> }} />
    </Tab.Navigator>
  );
};

const AdminNavigator: React.FC = () => (
  <AdminNotificationsProvider>
    <AdminTabs />
  </AdminNotificationsProvider>
);

export default AdminNavigator;
