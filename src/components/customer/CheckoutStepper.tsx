import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

const STEPS = ['Cart', 'Address', 'Payment'] as const;

// Ports frontend/pages/CartCheckout.tsx's numbered stepper (Cart -> Address -> Payment) that sits
// above the flow on the website - since each step here is its own React Navigation screen rather
// than one component switching on `step`, this renders standalone at the top of each of the three
// screens instead of being driven by shared state.
const CheckoutStepper: React.FC<{ currentStep: 1 | 2 | 3 }> = ({ currentStep }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const stepNumber = i + 1;
        const isDone = currentStep > stepNumber;
        const isActive = currentStep === stepNumber;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepWrap}>
              <View style={[styles.circle, (isDone || isActive) && styles.circleActive]}>
                {isDone ? <Check size={13} color={colors.white} /> : <Text style={[styles.circleText, (isDone || isActive) && styles.circleTextActive]}>{stepNumber}</Text>}
              </View>
              <Text style={[styles.label, (isDone || isActive) && styles.labelActive]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[styles.connector, isDone && styles.connectorActive]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  stepWrap: { alignItems: 'center', width: 64 },
  circle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  circleActive: { backgroundColor: colors.emerald800 },
  circleText: { fontSize: 12, fontWeight: '800', color: colors.slate600 },
  circleTextActive: { color: colors.white },
  label: { fontSize: 10.5, fontWeight: '700', color: colors.slate400, marginTop: 5 },
  labelActive: { color: colors.accentText },
  connector: { flex: 1, height: 2, backgroundColor: colors.slate200, marginTop: 12, maxWidth: 32 },
  connectorActive: { backgroundColor: colors.emerald800 },
});

export default CheckoutStepper;
