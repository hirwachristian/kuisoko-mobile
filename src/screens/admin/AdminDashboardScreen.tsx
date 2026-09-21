import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl, TouchableOpacity, Image, Alert, FlatList } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { Users as UsersIcon, Box, Folder, ClipboardList, Wallet, RefreshCw, FileText, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { fetchProducts, fetchUsers, fetchOrders, fetchCategories } from '../../api/admin';
import { Product, Order, User, Category } from '../../types';
import { AppColors } from '../../theme';
import { Card, SectionTitle, EmptyState } from '../../components/admin/ui';
import AnimatedStatCard from '../../components/admin/AnimatedStatCard';
import DonutChart, { DonutSegment } from '../../components/admin/DonutChart';
import ExplodedPieChart from '../../components/admin/ExplodedPieChart';
import HorizontalBarChart from '../../components/admin/HorizontalBarChart';
import CategoryBarChart from '../../components/admin/CategoryBarChart';
import NotificationBell from '../../components/admin/NotificationBell';
import Logo from '../../components/Logo';

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const SPARKLINE_DAYS = 14;
const statusColors: Record<string, string> = {
  Pending: '#fde68a',
  Processing: '#f97316',
  Shipped: '#059669',
  Delivered: '#065f46',
  Cancelled: '#f43f5e',
  Returned: '#94a3b8',
};
const categoryPalette = ['#065f46', '#f97316', '#f43f5e', '#059669', '#475569', '#fb923c'];
const topProductPalette = ['#065f46', '#047857', '#f97316', '#fb923c', '#475569'];

// Direct ports of frontend/components/AdminDashboardContent.tsx's buildDailySeries /
// computeTrendPercent - same bucketing and "second half vs first half" comparison, so the
// sparklines and trend arrows mean exactly the same thing as they do on the website.
function buildDailySeries(records: { date: string; value?: number }[], days = SPARKLINE_DAYS): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = new Array(days).fill(0);
  for (const r of records) {
    const d = new Date(r.date);
    if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) series[idx] += r.value ?? 1;
  }
  return series;
}
function computeTrendPercent(series: number[]): number | null {
  const half = Math.floor(series.length / 2);
  const recent = series.slice(half).reduce((a, b) => a + b, 0);
  const prior = series.slice(0, half).reduce((a, b) => a + b, 0);
  if (prior === 0) return null;
  return ((recent - prior) / prior) * 100;
}

const AdminDashboardScreen: React.FC = () => {
  const { token, user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  // Inventory Overview - stock-level filter (out/low/in, mirroring ProductCard's 4-tier
  // getStockLevel with medium+high collapsed into "In Stock"), an optional category filter, and
  // its own page - matches the same redesign on the website.
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'out' | 'low' | 'in'>('all');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>('all');
  const [inventoryPage, setInventoryPage] = useState(1);
  // A changed filter starts a fresh browse rather than landing on whatever page happened to be
  // selected under the previous filter. Must run unconditionally (before the isLoading early
  // return below) to satisfy the rules of hooks.
  useEffect(() => {
    setInventoryPage(1);
  }, [inventoryStockFilter, inventoryCategoryFilter]);
  // Bumped on every refresh and used as a `key` on each animated chart below - changing an
  // element's key forces React to unmount and remount it, which resets its internal Animated
  // values and re-fires its mount-time entrance animation. That's the RN equivalent of the
  // website's refresh button doing a full `window.location.reload()`: every count-up, sparkline,
  // bar and donut plays from scratch again, not just when the underlying numbers changed.
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    const [p, o, u, c] = await Promise.all([
      fetchProducts(),
      fetchOrders(token),
      fetchUsers(token),
      fetchCategories(),
    ]);
    setProducts(p.products);
    setOrders(o.orders);
    setUsers(u.users);
    setCategories(c.categories);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
    setRefreshKey((k) => k + 1);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalSections = categories.reduce((sum, c) => sum + c.sections.length, 0);
  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');

  // Collapses the 4-tier scale (out/low/medium/high, matching ProductCard.tsx's own
  // getStockLevel) into the 3 an admin actually restocks against.
  const inventoryStockTier = (stock: number): 'out' | 'low' | 'in' => {
    if (stock <= 0) return 'out';
    if (stock < 10) return 'low';
    return 'in';
  };
  const INVENTORY_PER_PAGE = 5;
  const categoryScopedProducts = inventoryCategoryFilter === 'all' ? products : products.filter((p) => p.category === inventoryCategoryFilter);
  const filteredInventory = inventoryStockFilter === 'all'
    ? categoryScopedProducts
    : categoryScopedProducts.filter((p) => inventoryStockTier(p.stock) === inventoryStockFilter);
  const inventoryTotalPages = Math.max(1, Math.ceil(filteredInventory.length / INVENTORY_PER_PAGE));
  const inventoryRows = filteredInventory.slice((inventoryPage - 1) * INVENTORY_PER_PAGE, inventoryPage * INVENTORY_PER_PAGE);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);

  const usersDailySeries = buildDailySeries(users.filter((u) => u.registrationDate).map((u) => ({ date: u.registrationDate! })));
  const usersTrendPercent = computeTrendPercent(usersDailySeries);
  const ordersDailySeries = buildDailySeries(orders.map((o) => ({ date: o.date })));
  const ordersTrendPercent = computeTrendPercent(ordersDailySeries);
  const revenueDailySeries = buildDailySeries(paidOrders.map((o) => ({ date: o.date, value: o.total })));
  const revenueTrendPercent = computeTrendPercent(revenueDailySeries);

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusSegments: DonutSegment[] = Object.entries(statusCounts).map(([status, count]) => ({
    label: status,
    value: count,
    color: statusColors[status] ?? colors.slate400,
  }));

  const productCategory = new Map(products.map((p) => [p.id, p.category]));
  const revenueByCategory = new Map<string, number>();
  orders.forEach((o) => {
    o.items.forEach((item) => {
      const category = (item.productId && productCategory.get(item.productId)) || 'Other';
      revenueByCategory.set(category, (revenueByCategory.get(category) ?? 0) + item.price * item.quantity);
    });
  });
  const categorySegments: DonutSegment[] = [...revenueByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({ label, value: Math.round(value), color: categoryPalette[i % categoryPalette.length] }));

  const productsByCategory = categories.map((cat) => ({
    name: cat.name,
    count: products.filter((p) => p.category === cat.name).length,
  }));

  const productRevenue = new Map<string, { name: string; revenue: number }>();
  orders.forEach((o) => {
    o.items.forEach((item) => {
      const key = item.productId ?? item.name;
      const existing = productRevenue.get(key);
      const revenue = item.price * item.quantity;
      if (existing) existing.revenue += revenue;
      else productRevenue.set(key, { name: item.name, revenue });
    });
  });
  const topProducts = [...productRevenue.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p, i) => ({ label: p.name, value: Math.round(p.revenue), color: topProductPalette[i % topProductPalette.length] }));

  const handleDownloadReport = async () => {
    setIsGeneratingReport(true);
    try {
      const html = buildReportHtml({
        adminName: user?.name ?? 'Admin', adminEmail: user?.email ?? 'admin@example.com',
        totalUsers: users.length, totalProducts: products.length, totalStock, totalCategories: categories.length,
        totalSections, totalOrders: orders.length, totalRevenue,
        revenueByCategory: [...revenueByCategory.entries()].sort((a, b) => b[1] - a[1]),
        topProducts: [...productRevenue.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
        statusCounts,
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Store Summary Report' });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not generate report.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald800} />}
      >
        <View style={styles.header}>
          <View>
            <Logo height={26} />
            <Text style={styles.headerSubtitle}>Admin Dashboard</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={handleRefresh}>
              <RefreshCw size={18} color={colors.slate700} />
            </TouchableOpacity>
            <NotificationBell />
            <View style={styles.avatar}>
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? 'A'}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.statGrid}>
          <AnimatedStatCard
            key={`users-${refreshKey}`}
            label="Total Users" value={users.length} Icon={UsersIcon} color="emerald"
            caption="Registered accounts" sparkline={usersDailySeries} trendPercent={usersTrendPercent}
          />
          <AnimatedStatCard
            key={`products-${refreshKey}`}
            label="Total Products" value={products.length} Icon={Box} color="orange"
            caption={`Total stock: ${totalStock}`}
          />
          <AnimatedStatCard
            key={`categories-${refreshKey}`}
            label="Categories" value={categories.length} Icon={Folder} color="blue"
            caption={`Sub-sections: ${totalSections}`}
          />
          <AnimatedStatCard
            key={`orders-${refreshKey}`}
            label="Total Orders" value={orders.length} Icon={ClipboardList} color="purple"
            caption={`Revenue: ${formatPrice(totalRevenue)}`} sparkline={ordersDailySeries} trendPercent={ordersTrendPercent}
          />
          <AnimatedStatCard
            key={`revenue-${refreshKey}`}
            label="Total Revenue" value={totalRevenue} formatValue={formatPrice} Icon={Wallet} color="amber"
            caption="Confirmed payments only" sparkline={revenueDailySeries} trendPercent={revenueTrendPercent}
          />
        </View>

        {productsByCategory.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <CategoryBarChart key={`category-bar-${refreshKey}`} data={productsByCategory} />
          </View>
        )}

        <SectionTitle style={{ marginTop: 24 }}>Category Split</SectionTitle>
        <Card>
          {categorySegments.length === 0 ? (
            <EmptyState label="No sales yet" />
          ) : (
            <DonutChart key={`category-donut-${refreshKey}`} segments={categorySegments} formatValue={formatPrice} totalCaption="REVENUE" centerLabel={formatPrice(totalRevenue)} />
          )}
        </Card>

        <SectionTitle style={{ marginTop: 24 }}>Top Selling Products</SectionTitle>
        <Card>
          {topProducts.length === 0 ? (
            <EmptyState label="No sales yet" />
          ) : (
            <HorizontalBarChart key={`top-products-${refreshKey}`} data={topProducts} formatValue={formatPrice} />
          )}
        </Card>

        <SectionTitle style={{ marginTop: 24 }}>Order Status</SectionTitle>
        <Card>
          {statusSegments.length === 0 ? (
            <EmptyState label="No orders yet" />
          ) : (
            <ExplodedPieChart key={`status-pie-${refreshKey}`} segments={statusSegments} />
          )}
        </Card>

        <View style={styles.inventoryHeader}>
          <SectionTitle style={{ marginBottom: 0 }}>Inventory Overview</SectionTitle>
          <TouchableOpacity style={styles.reportButton} onPress={handleDownloadReport} disabled={isGeneratingReport}>
            {isGeneratingReport ? <ActivityIndicator size="small" color={colors.white} /> : <FileText size={14} color={colors.white} />}
            <Text style={styles.reportButtonText}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* Stock-level filter (with live counts) plus an optional category filter, both scoped to
            each other so switching category re-counts the chips against just that category. */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.inventoryFilterList}
          contentContainerStyle={styles.inventoryFilterRow}
          data={(['all', 'in', 'low', 'out'] as const)}
          keyExtractor={(k) => k}
          renderItem={({ item: key }) => {
            const label = key === 'all' ? 'All' : key === 'in' ? 'In Stock' : key === 'low' ? 'Low Stock' : 'Out of Stock';
            const count = key === 'all' ? categoryScopedProducts.length : categoryScopedProducts.filter((p) => inventoryStockTier(p.stock) === key).length;
            const active = inventoryStockFilter === key;
            return (
              <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setInventoryStockFilter(key)}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label} ({count})</Text>
              </TouchableOpacity>
            );
          }}
        />
        {categories.length > 0 && (
          <View style={styles.pickerWrap}>
            <Picker selectedValue={inventoryCategoryFilter} onValueChange={setInventoryCategoryFilter} mode="dropdown">
              <Picker.Item label="All categories" value="all" />
              {categories.map((c) => <Picker.Item key={c.id} label={c.name} value={c.name} />)}
            </Picker>
          </View>
        )}

        <View style={styles.inventoryCard}>
          {inventoryRows.length === 0 ? (
            <EmptyState label="No products match this filter" />
          ) : (
            inventoryRows.map((p, i) => {
              const tier = inventoryStockTier(p.stock);
              const tierStyle = tier === 'out'
                ? { bg: '#fef2f2', fg: colors.rose600 }
                : tier === 'low'
                ? { bg: '#fffbeb', fg: '#b45309' }
                : { bg: colors.emerald50, fg: colors.accentText };
              const tierLabel = tier === 'out' ? 'Out of Stock' : tier === 'low' ? 'Low Stock' : 'In Stock';
              return (
                <View key={p.id} style={[styles.inventoryRow, i === inventoryRows.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inventoryName} numberOfLines={2}>{p.name}</Text>
                    <Text style={styles.inventoryCategory}>{p.category}</Text>
                  </View>
                  <Text style={styles.inventoryPrice}>{formatPrice(p.price)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: tierStyle.bg }]}>
                    <Text style={[styles.statusPillText, { color: tierStyle.fg }]}>{tierLabel}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
        {filteredInventory.length > 0 && (
          <View style={styles.paginationRow}>
            <Text style={styles.paginationLabel}>
              {`${Math.min(filteredInventory.length, (inventoryPage - 1) * INVENTORY_PER_PAGE + 1)}-${Math.min(filteredInventory.length, inventoryPage * INVENTORY_PER_PAGE)} of ${filteredInventory.length}`}
            </Text>
            <View style={styles.paginationButtons}>
              <TouchableOpacity
                style={[styles.paginationButton, inventoryPage === 1 && styles.paginationButtonDisabled]}
                disabled={inventoryPage === 1}
                onPress={() => setInventoryPage((pg) => pg - 1)}
              >
                <ChevronLeft size={16} color={inventoryPage === 1 ? colors.slate400 : colors.slate700} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paginationButton, inventoryPage === inventoryTotalPages && styles.paginationButtonDisabled]}
                disabled={inventoryPage === inventoryTotalPages}
                onPress={() => setInventoryPage((pg) => pg + 1)}
              >
                <ChevronRight size={16} color={inventoryPage === inventoryTotalPages ? colors.slate400 : colors.slate700} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

function buildReportHtml(data: {
  adminName: string; adminEmail: string; totalUsers: number; totalProducts: number; totalStock: number;
  totalCategories: number; totalSections: number; totalOrders: number; totalRevenue: number;
  revenueByCategory: [string, number][]; topProducts: { name: string; revenue: number }[]; statusCounts: Record<string, number>;
}): string {
  const rows = (pairs: [string, string][]) =>
    pairs.map(([label, value]) => `<tr><td style="padding:8px 4px 8px 0;font-size:14px;border-bottom:1px solid #eee;color:#555;">${label}</td><td style="padding:8px 0;font-size:14px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">${value}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;">
    <div style="width:100%;box-sizing:border-box;padding:32px;color:#1a1a1a;background:#fff;font-family:sans-serif;">
      <h1 style="font-size:26px;font-weight:900;margin:0 0 6px;">Store Summary Report</h1>
      <p style="font-size:14px;color:#666;margin:0 0 32px;">Generated ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
      <h2 style="font-size:18px;font-weight:800;border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:16px;">Overview</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tbody>${rows([
        ['Total Users', String(data.totalUsers)],
        ['Total Products', String(data.totalProducts)],
        ['Total Stock', String(data.totalStock)],
        ['Total Categories', String(data.totalCategories)],
        ['Total Sub-Sections', String(data.totalSections)],
        ['Total Orders', String(data.totalOrders)],
        ['Total Revenue', formatPrice(data.totalRevenue)],
      ])}</tbody></table>
      <h2 style="font-size:18px;font-weight:800;border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:16px;">Revenue by Category</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tbody>${rows(data.revenueByCategory.map(([name, value]) => [name, formatPrice(value)]))}</tbody></table>
      <h2 style="font-size:18px;font-weight:800;border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:16px;">Top-Selling Products</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tbody>${rows(data.topProducts.map((p) => [p.name, formatPrice(p.revenue)]))}</tbody></table>
      <h2 style="font-size:18px;font-weight:800;border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:16px;">Orders by Status</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tbody>${rows(Object.entries(data.statusCounts).map(([s, c]) => [s, String(c)]))}</tbody></table>
      <div style="margin-top:40px;">
        <p style="font-size:13px;color:#666;"><strong>Issued by:</strong> ${data.adminName}</p>
        <p style="font-size:13px;color:#666;"><strong>Email:</strong> ${data.adminEmail}</p>
      </div>
      <div style="margin-top:48px;padding-top:28px;border-top:2px solid #0B5D3B;text-align:center;">
        <p style="font-size:20px;font-weight:900;margin:0 0 4px;color:#0B5D3B;">KuISOKO</p>
        <p style="font-size:13px;margin:0;color:#888;">Generated by the KuISOKO Admin Dashboard.</p>
      </div>
    </div>
  </body></html>`;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  headerSubtitle: { fontSize: 13, color: colors.slate600, marginTop: 6, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.emerald600, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  inventoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  reportButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.emerald800, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  reportButtonText: { color: colors.white, fontSize: 11.5, fontWeight: '800' },
  inventoryCard: { backgroundColor: colors.orange50, borderRadius: 20, borderWidth: 1, borderColor: colors.slate100, padding: 6 },
  inventoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  inventoryName: { fontSize: 12.5, fontWeight: '700', color: colors.slate900 },
  inventoryCategory: { fontSize: 11, color: colors.slate600, marginTop: 2 },
  inventoryPrice: { fontSize: 12.5, fontWeight: '800', color: colors.slate900 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  inventoryFilterList: { flexGrow: 0, marginBottom: 8 },
  inventoryFilterRow: { gap: 8, paddingBottom: 2 },
  filterChip: {
    height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate200, justifyContent: 'center', alignItems: 'center',
  },
  filterChipActive: { backgroundColor: colors.emerald800, borderColor: colors.emerald800 },
  filterChipText: { fontSize: 11.5, fontWeight: '700', color: colors.slate700 },
  filterChipTextActive: { color: colors.white },
  pickerWrap: { marginBottom: 10, borderWidth: 1, borderColor: colors.slate200, borderRadius: 12, backgroundColor: colors.white },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  paginationLabel: { fontSize: 11.5, color: colors.slate600 },
  paginationButtons: { flexDirection: 'row', gap: 8 },
  paginationButton: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  paginationButtonDisabled: { opacity: 0.4 },
});

export default AdminDashboardScreen;
