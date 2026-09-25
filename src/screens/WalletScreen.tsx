import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Wallet as WalletIcon, Clock, TrendingUp, Download, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Check } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import {
  fetchWallet, fetchWalletTransactions, requestWalletTopupMomo, requestWalletTopupPaypack,
  fetchWalletTopupStatus, exportWalletStatementCsv, WalletSummary, WalletTransaction,
} from '../api/customer';
import { ApiError } from '../api/client';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;
const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

type Provider = 'momo' | 'paypack';
type TopupStage = 'idle' | 'waiting';

const TYPE_META: Record<WalletTransaction['type'], { icon: typeof ArrowDownToLine; sign: string }> = {
  topup: { icon: ArrowDownToLine, sign: '+' },
  refund: { icon: RotateCcw, sign: '+' },
  purchase: { icon: ArrowUpFromLine, sign: '-' },
};

// Ports frontend/pages/CartCheckout.tsx's / CheckoutPaymentScreen.tsx's mobile-money
// request->poll->settle flow for a wallet top-up instead of an order payment - same 3s-interval
// polling capped at 40 attempts, pointed at /api/wallet/topup/* instead of /api/momo|paypack/*.
const WalletScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const styles = createStyles(colors);

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [provider, setProvider] = useState<Provider>('momo');
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [amount, setAmount] = useState('10000');
  const [stage, setStage] = useState<TopupStage>('idle');
  const [error, setError] = useState('');
  const pollAttempts = useRef(0);

  const load = useCallback(() => {
    if (!token) return;
    Promise.all([fetchWallet(token), fetchWalletTransactions(token)])
      .then(([summaryRes, txRes]) => {
        setSummary(summaryRes);
        setTransactions(txRes.transactions);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pollTopupStatus = (reference: string) => {
    const interval = setInterval(async () => {
      pollAttempts.current += 1;
      if (!token) { clearInterval(interval); return; }
      try {
        const { status } = await fetchWalletTopupStatus(reference, token);
        if (status === 'SUCCESSFUL') {
          clearInterval(interval);
          setStage('idle');
          load();
        } else if (status === 'FAILED') {
          clearInterval(interval);
          setError(t('mobile_wallet_topup_failed'));
          setStage('idle');
        } else if (pollAttempts.current >= 40) {
          clearInterval(interval);
          setError(t('mobile_wallet_topup_timeout'));
          setStage('idle');
        }
      } catch {
        // transient network error - keep polling until attempt cap
      }
    }, 3000);
  };

  const handleTopup = async () => {
    if (!token || !phone.trim() || !amount) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    setError('');
    setStage('waiting');
    pollAttempts.current = 0;
    try {
      const request = provider === 'momo' ? requestWalletTopupMomo : requestWalletTopupPaypack;
      const { referenceId } = await request(phone.trim(), amountNum, token);
      pollTopupStatus(referenceId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start the top-up.');
      setStage('idle');
    }
  };

  const handleExportStatement = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const csv = await exportWalletStatementCsv(token);
      const file = new File(Paths.cache, `kuisoko-wallet-statement-${Date.now()}.csv`);
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Wallet Statement' });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not export statement.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
      </SafeAreaView>
    );
  }

  if (stage === 'waiting') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.emerald800} />
        <Text style={styles.waitingText}>{t('mobile_wallet_waiting')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.statGrid}>
          <View style={[styles.statCard, { flexBasis: '100%' }]}>
            <View>
              <Text style={styles.statLabel}>{t('mobile_wallet_available_balance')}</Text>
              <Text style={styles.balanceValue}>{formatPrice(summary?.balance ?? 0)}</Text>
            </View>
            <View style={[styles.statIconWrap, { backgroundColor: colors.emerald50 }]}>
              <WalletIcon size={18} color={colors.accentText} />
            </View>
          </View>
          <View style={styles.statCard}>
            <View>
              <Text style={styles.statLabel}>{t('mobile_wallet_pending_deposits')}</Text>
              <Text style={styles.statValue}>{formatPrice(summary?.pendingDeposits ?? 0)}</Text>
            </View>
            <View style={[styles.statIconWrap, { backgroundColor: colors.amber50 }]}>
              <Clock size={16} color={colors.amber800} />
            </View>
          </View>
          <View style={styles.statCard}>
            <View>
              <Text style={styles.statLabel}>{t('mobile_wallet_lifetime_topups')}</Text>
              <Text style={styles.statValue}>{formatPrice(summary?.lifetimeTopups ?? 0)}</Text>
            </View>
            <View style={[styles.statIconWrap, { backgroundColor: colors.emerald50 }]}>
              <TrendingUp size={16} color={colors.accentText} />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.exportButton} onPress={handleExportStatement} disabled={isExporting}>
          {isExporting ? <ActivityIndicator size="small" color={colors.accentText} /> : <Download size={15} color={colors.accentText} />}
          <Text style={styles.exportButtonText}>{t('mobile_wallet_download_statement')}</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.heading}>{t('mobile_wallet_topup_title')}</Text>

          <Text style={styles.label}>{t('mobile_wallet_select_operator')}</Text>
          <View style={styles.operatorRow}>
            {(['momo', 'paypack'] as Provider[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.operatorButton, provider === p && styles.operatorButtonActive]}
                onPress={() => setProvider(p)}
                activeOpacity={0.8}
              >
                <Text style={[styles.operatorLabel, provider === p && styles.operatorLabelActive]}>
                  {p === 'momo' ? t('mobile_wallet_mtn_momo') : t('mobile_wallet_airtel_money')}
                </Text>
                {provider === p && <Check size={16} color={colors.accentText} />}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('mobile_wallet_phone_number')}</Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholder="07XXXXXXXX"
            placeholderTextColor={colors.slate400}
          />

          <Text style={styles.label}>{t('mobile_wallet_select_amount')}</Text>
          <View style={styles.amountGrid}>
            {PRESET_AMOUNTS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[styles.amountChip, amount === String(preset) && styles.amountChipActive]}
                onPress={() => setAmount(String(preset))}
              >
                <Text style={[styles.amountChipText, amount === String(preset) && styles.amountChipTextActive]}>
                  {preset.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder={t('mobile_wallet_custom_amount_placeholder')}
            placeholderTextColor={colors.slate400}
          />

          <TouchableOpacity
            style={[styles.button, (!phone.trim() || !amount) && styles.buttonDisabled]}
            onPress={handleTopup}
            disabled={!phone.trim() || !amount}
          >
            <Text style={styles.buttonText}>{t('mobile_wallet_authorize_deposit')}</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>{t('mobile_wallet_transaction_history')}</Text>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>{t('mobile_wallet_no_transactions')}</Text>
          ) : (
            transactions.map((tx) => {
              const meta = TYPE_META[tx.type];
              const Icon = meta.icon;
              const color = tx.type === 'purchase' ? colors.slate700 : colors.accentText;
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIconWrap, { backgroundColor: colors.slate50 }]}>
                    <Icon size={15} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txDescription} numberOfLines={1}>{tx.description}</Text>
                    <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color }]}>{meta.sign} {formatPrice(tx.amount)}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, gap: 16 },
  waitingText: { fontSize: 14, color: colors.slate600, textAlign: 'center', paddingHorizontal: 40 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.slate100, padding: 14,
  },
  statLabel: { fontSize: 10.5, fontWeight: '700', color: colors.slate600, textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 16, fontWeight: '900', color: colors.slate900, marginTop: 2 },
  balanceValue: { fontSize: 24, fontWeight: '900', color: colors.slate900, marginTop: 4 },
  statIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exportButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white,
    borderRadius: 14, borderWidth: 1, borderColor: colors.slate100, paddingVertical: 12, marginBottom: 16,
  },
  exportButtonText: { fontSize: 13, fontWeight: '800', color: colors.accentText },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: colors.slate100,
  },
  heading: { fontSize: 16, fontWeight: '900', color: colors.slate900, marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '700', color: colors.slate700, marginBottom: 8 },
  operatorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  operatorButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    borderWidth: 1.5, borderColor: colors.slate100, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  operatorButtonActive: { borderColor: colors.emerald600, backgroundColor: colors.emerald50 },
  operatorLabel: { fontSize: 13, fontWeight: '700', color: colors.slate700 },
  operatorLabelActive: { color: colors.accentText },
  input: {
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.slate50, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.slate900, marginBottom: 16,
  },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  amountChip: {
    borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13,
  },
  amountChipActive: { borderColor: colors.emerald600, backgroundColor: colors.emerald50 },
  amountChipText: { fontSize: 12.5, fontWeight: '700', color: colors.slate700 },
  amountChipTextActive: { color: colors.accentText },
  button: { backgroundColor: colors.orange500, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  error: { color: colors.rose600, fontSize: 13, marginTop: 12, textAlign: 'center' },
  emptyText: { fontSize: 13, color: colors.slate400, textAlign: 'center', paddingVertical: 20 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  txIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txDescription: { fontSize: 13, fontWeight: '700', color: colors.slate900 },
  txDate: { fontSize: 11, color: colors.slate400, marginTop: 1 },
  txAmount: { fontSize: 13, fontWeight: '800' },
});

export default WalletScreen;
