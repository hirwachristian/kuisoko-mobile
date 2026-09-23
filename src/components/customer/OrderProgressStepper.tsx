import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { OrderStatus } from '../../types';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'Pending', label: 'Pending' },
  { status: 'Processing', label: 'Processing' },
  { status: 'Shipped', label: 'Shipped' },
  { status: 'Delivered', label: 'Delivered' },
];

// Ports frontend/pages/UserDashboard.tsx's order-detail progress stepper. A separate component
// from CheckoutStepper.tsx (that one's steps/labels are Cart/Address/Payment and it's wired into
// a working checkout flow not worth risking) even though the circle/connector visuals match.
const OrderProgressStepper: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const currentIndex = STEPS.findIndex((s) => s.status === status);
  // Cancelled/Returned aren't a point on this line - nothing to show.
  if (currentIndex === -1) return null;

  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const isDone = currentIndex > i;
        const isActive = currentIndex === i;
        return (
          <React.Fragment key={step.status}>
            <View style={styles.stepWrap}>
              <View style={[styles.circle, (isDone || isActive) && styles.circleActive]}>
                {isDone ? <Check size={13} color={colors.white} /> : <Text style={[styles.circleText, isActive && styles.circleTextActive]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.label, (isDone || isActive) && styles.labelActive]}>{step.label}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[styles.connector, isDone && styles.connectorActive]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.slate100,
    padding: 16, marginBottom: 16,
  },
  stepWrap: { alignItems: 'center', width: 60 },
  circle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  circleActive: { backgroundColor: colors.emerald800 },
  circleText: { fontSize: 12, fontWeight: '800', color: colors.slate600 },
  circleTextActive: { color: colors.white },
  label: { fontSize: 10, fontWeight: '700', color: colors.slate400, marginTop: 5, textAlign: 'center' },
  labelActive: { color: colors.accentText },
  connector: { flex: 1, height: 2, backgroundColor: colors.slate200, marginTop: 12, maxWidth: 28 },
  connectorActive: { backgroundColor: colors.emerald800 },
});

export default OrderProgressStepper;
