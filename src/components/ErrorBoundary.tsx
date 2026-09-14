import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors } from '../theme';
import { captureException } from '../lib/errorReporting';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// A single uncaught render error anywhere in the tree used to take down the entire app with a
// blank/red screen and no way back short of force-quitting. This is the one place that can't use
// useAppTheme() (a crash inside the theme/navigation tree itself must still be catchable), so it
// renders with the static light-mode `colors` export instead of the live theme.
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { componentStack: info.componentStack ?? undefined });
  }

  handleReset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <AlertTriangle size={32} color={colors.rose500} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>The app hit an unexpected error. Try again, or restart the app if it keeps happening.</Text>
        <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 32 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.rose50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '900', color: colors.slate900, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.slate600, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  button: { marginTop: 24, backgroundColor: colors.emerald800, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
});

export default ErrorBoundary;
