import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

// Shared page-number footer for the two lists that now paginate (My Orders, Wishlist) - mirrors
// frontend/components/DashboardPagination.tsx's web counterpart. ShopScreen.tsx and
// AdminDashboardScreen.tsx each already have their own inline Prev/Next footer; left as-is
// (working, out of scope) rather than retrofitted to this component.
const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  if (totalItems === 0) return null;
  const startItem = Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1);
  const endItem = Math.min(totalItems, currentPage * itemsPerPage);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Showing {startItem}-{endItem} of {totalItems}</Text>
      {totalPages > 1 && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.chevronButton, currentPage === 1 && styles.disabled]}
            onPress={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} color={colors.slate600} />
          </TouchableOpacity>
          <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
          <TouchableOpacity
            style={[styles.chevronButton, currentPage === totalPages && styles.disabled]}
            onPress={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={16} color={colors.slate600} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 4 },
  label: { fontSize: 12, color: colors.slate600, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chevronButton: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pageText: { fontSize: 12.5, fontWeight: '800', color: colors.slate900 },
});

export default Pagination;
