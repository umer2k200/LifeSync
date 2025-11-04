import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SyncService } from '@/lib/sync';
import { ArrowLeft, Calendar, Filter, Trash2, PieChart, Edit2, X } from 'lucide-react-native';
import { format } from 'date-fns';
import { showConfirmDestructive, showSuccess } from '@/lib/alert';
import { Button } from '@/components/Button';
import { PieChart as GiftedPieChart } from 'react-native-gifted-charts';

interface Expense {
  id: string;
  amount: number;
  description: string | null;
  expense_date: string;
  category_id?: string | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
  color?: string;
}

export default function ExpenseHistoryScreen() {
  const { colors } = useTheme();
  const { currency } = useCurrency();
  const { user } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Can be null (all), 'no-category', or category id
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSelectedCategory, setEditSelectedCategory] = useState<string | null>(null);
  const [editExpenseDate, setEditExpenseDate] = useState('');

  useEffect(() => {
    if (user) {
      const loadAll = async () => {
        setLoading(true);
        try {
          await Promise.all([loadCategories(), loadExpenses()]);
        } finally {
          setLoading(false);
        }
      };
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Reload categories when screen comes into focus to ensure latest data
  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        loadCategories();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  useEffect(() => {
    filterExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedCategory, allExpenses]);

  const loadCategories = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<ExpenseCategory>('expense_categories', user.id);
    setCategories(data);
  };

  const loadExpenses = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Expense>('expenses', user.id);
    setAllExpenses(data);
  };

  const filterExpenses = () => {
    // Filter by month first
    let filtered = allExpenses.filter((expense) => {
      const expenseDate = new Date(expense.expense_date);
      return (
        expenseDate.getMonth() === selectedMonth.getMonth() &&
        expenseDate.getFullYear() === selectedMonth.getFullYear()
      );
    });

    // Filter by category if selected
    if (selectedCategory) {
      if (selectedCategory === 'no-category') {
        // Filter expenses with no category
        filtered = filtered.filter((expense) => !expense.category_id || expense.category_id === null);
      } else {
        // Filter by specific category
        filtered = filtered.filter((expense) => expense.category_id === selectedCategory);
      }
    }

    setExpenses(filtered.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()));
  };

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return 'Others';
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Others';
  };


  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
  };

  const monthlyTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Category breakdown data
  const categoryBreakdown = useMemo(() => {
    const breakdown: { [key: string]: number } = {};
    expenses.forEach((expense) => {
      const categoryId = expense.category_id;
      let categoryName: string;
      if (!categoryId || categoryId === null) {
        categoryName = 'No Category';
      } else {
        const category = categories.find((c) => c.id === categoryId);
        categoryName = category ? category.name : 'Others';
      }
      breakdown[categoryName] = (breakdown[categoryName] || 0) + Number(expense.amount);
    });

    const colors_palette = [colors.primary, colors.accent, colors.success, colors.warning, colors.error, '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B', '#14B8A6'];
    
    const pieData = Object.entries(breakdown)
      .map(([name, value], index) => {
        // Use secondary color for "No Category"
        let categoryColor: string;
        if (name === 'No Category') {
          categoryColor = colors.secondary || colors.textSecondary;
        } else {
          const category = categories.find((c) => c.name === name);
          categoryColor = category?.color || colors_palette[index % colors_palette.length];
        }
        
        return {
          value: Math.round(value),
          color: categoryColor,
          text: `${Math.round(value)}`,
          label: name,
        };
      })
      .sort((a, b) => b.value - a.value);

    return pieData;
  }, [expenses, categories, colors]);

  const openEditModal = (expense: Expense) => {
    setEditExpenseId(expense.id);
    setEditAmount(expense.amount.toString());
    setEditDescription(expense.description || '');
    setEditSelectedCategory(expense.category_id || null);
    setEditExpenseDate(expense.expense_date);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditExpenseId(null);
    setEditAmount('');
    setEditDescription('');
    setEditSelectedCategory(null);
    setEditExpenseDate('');
    setEditModalVisible(false);
  };

  const updateExpense = async () => {
    if (!editAmount.trim() || !user || !editExpenseId) return;

    const expenseData: any = {
      amount: parseFloat(editAmount),
      description: editDescription.trim() || null,
      expense_date: editExpenseDate,
    };

    // Only add category_id if one is selected
    if (editSelectedCategory) {
      expenseData.category_id = editSelectedCategory;
    } else {
      expenseData.category_id = null;
    }

    await SyncService.updateWithFallback('expenses', user.id, editExpenseId, expenseData);
    showSuccess('Success', 'Expense updated successfully');
    closeEditModal();
    await loadExpenses();
  };

  const deleteExpense = async (expenseId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Expense', 'Are you sure you want to delete this expense?', async () => {
      await SyncService.deleteWithFallback('expenses', user.id, expenseId);
      await loadExpenses();
    });
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Expense History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <LoadingSpinner message="Loading expense history..." />
        ) : (
          <>
            {/* Month Selector */}
            <Card style={styles.monthSelectorCard}>
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={previousMonth} style={styles.monthButton}>
              <Text style={[styles.monthButtonText, { color: colors.primary }]}>‹</Text>
            </TouchableOpacity>
            <View style={styles.monthDisplay}>
              <Calendar size={20} color={colors.primary} />
              <Text style={[styles.monthText, { color: colors.text }]}>
                {format(selectedMonth, 'MMMM yyyy')}
              </Text>
            </View>
            <TouchableOpacity onPress={nextMonth} style={styles.monthButton}>
              <Text style={[styles.monthButtonText, { color: colors.primary }]}>›</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.monthTotal, { color: colors.text }]}>
            Total: {currency.symbol} {Math.round(monthlyTotal).toLocaleString()}
            {selectedCategory && (
              <Text style={[styles.categoryTotal, { color: colors.textSecondary }]}>
                {' '}({selectedCategory === 'no-category' ? 'No Category' : getCategoryName(selectedCategory)})
              </Text>
            )}
          </Text>
        </Card>

        {/* Category Filter */}
        <Card style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <Filter size={18} color={colors.primary} />
            <Text style={[styles.filterTitle, { color: colors.text }]}>Filter by Category</Text>
          </View>
          <View style={styles.categoryFilterContainer}>
            <TouchableOpacity
              style={[
                styles.categoryFilterButton,
                {
                  backgroundColor: selectedCategory === null ? colors.primary : colors.surface,
                  borderColor: selectedCategory === null ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text
                style={[
                  styles.categoryFilterText,
                  {
                    color: selectedCategory === null ? '#FFFFFF' : colors.text,
                  },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.categoryFilterButton,
                {
                  backgroundColor: selectedCategory === 'no-category' ? colors.secondary : colors.surface,
                  borderColor: selectedCategory === 'no-category' ? colors.secondary : colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(selectedCategory === 'no-category' ? null : 'no-category')}
            >
              <Text
                style={[
                  styles.categoryFilterText,
                  {
                    color: selectedCategory === 'no-category' ? '#FFFFFF' : colors.text,
                  },
                ]}
              >
                No Category
              </Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryFilterButton,
                  {
                    backgroundColor: selectedCategory === category.id ? (category.color || colors.primary) : colors.surface,
                    borderColor: selectedCategory === category.id ? (category.color || colors.primary) : colors.border,
                  },
                ]}
                onPress={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
              >
                <Text
                  style={[
                    styles.categoryFilterText,
                    {
                      color: selectedCategory === category.id ? '#FFFFFF' : colors.text,
                    },
                  ]}
                >
                  {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Category Breakdown Chart */}
        {expenses.length > 0 && categoryBreakdown.length > 0 && (
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <PieChart size={20} color={colors.primary} />
              <Text style={[styles.chartTitle, { color: colors.text }]}>Category Breakdown</Text>
            </View>
            <View style={styles.chartContainer}>
              <GiftedPieChart
                data={categoryBreakdown}
                donut
                radius={90}
                innerRadius={60}
                innerCircleColor={colors.surface}
                    centerLabelComponent={() => (
                      <View style={styles.pieCenterLabel}>
                        <Text style={[styles.pieCenterValue, { color: colors.text }]}>
                          {categoryBreakdown.length}
                        </Text>
                        <Text style={[styles.pieCenterText, { color: colors.textSecondary }]}>
                          {categoryBreakdown.length === 1 ? 'Category' : 'Categories'}
                        </Text>
                      </View>
                    )}
              />
              <View style={styles.pieLegend}>
                {categoryBreakdown.slice(0, 5).map((item, index) => (
                  <View key={index} style={styles.pieLegendItem}>
                    <View style={[styles.pieLegendColor, { backgroundColor: item.color }]} />
                    <Text style={[styles.pieLegendText, { color: colors.text }]} numberOfLines={1}>
                      {item.label}: {currency.symbol} {item.value.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        )}

        {/* Expense List */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: expenses.length > 0 ? 8 : 0 }]}>Expenses</Text>
        {expenses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No expenses for this month.
            </Text>
          </Card>
        ) : (
          expenses.map((expense) => {
            const categoryName = getCategoryName(expense.category_id);
            return (
              <Card key={expense.id} style={styles.expenseCard}>
                <View style={styles.expenseRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.expenseHeader}>
                      <Text style={[styles.expenseAmount, { color: colors.text }]}>
                        {currency.symbol} {Math.round(Number(expense.amount)).toLocaleString()}
                      </Text>
                    </View>
                    {expense.description && (
                      <Text style={[styles.expenseDescription, { color: colors.textSecondary }]}>
                        {expense.description}
                      </Text>
                    )}
                    <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                      {format(new Date(expense.expense_date), 'MMM dd, yyyy')}
                    </Text>
                  </View>
                  <View style={styles.rightActions}>
                    {expense.category_id && (
                      <View
                        style={[
                          styles.categoryBadge,
                          { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>
                          {categoryName}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => openEditModal(expense)}
                      style={styles.editButton}
                    >
                      <Edit2 size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteExpense(expense.id)}
                      style={styles.deleteButton}
                    >
                      <Trash2 size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      {/* Edit Expense Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Expense</Text>
              <TouchableOpacity onPress={closeEditModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Amount"
              placeholderTextColor={colors.textSecondary}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={editDescription}
              onChangeText={setEditDescription}
            />
            <Text style={[styles.inputLabel, { color: colors.text }]}>Category (Optional)</Text>
            <View style={styles.categoryContainer}>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor: editSelectedCategory === null ? colors.secondary : colors.surface,
                    borderColor: editSelectedCategory === null ? colors.secondary : colors.border,
                  },
                ]}
                onPress={() => setEditSelectedCategory(null)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    {
                      color: editSelectedCategory === null ? '#FFFFFF' : colors.text,
                    },
                  ]}
                >
                  No Category
                </Text>
              </TouchableOpacity>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    {
                      backgroundColor: editSelectedCategory === category.id ? colors.primary : colors.surface,
                      borderColor: editSelectedCategory === category.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setEditSelectedCategory(category.id)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      {
                        color: editSelectedCategory === category.id ? '#FFFFFF' : colors.text,
                      },
                    ]}
                  >
                    {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Update Expense" onPress={updateExpense} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 60,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    monthSelectorCard: {
      marginBottom: 20,
      padding: 20,
    },
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    monthButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthButtonText: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    monthDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    monthText: {
      fontSize: 18,
      fontWeight: '600',
    },
    monthTotal: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    categoryTotal: {
      fontSize: 16,
      fontWeight: 'normal',
    },
    filterCard: {
      marginBottom: 24,
      padding: 16,
    },
    filterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    filterTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    categoryFilterContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryFilterButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 2,
      minWidth: 70,
      alignItems: 'center',
    },
    categoryFilterText: {
      fontSize: 13,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    expenseCard: {
      marginBottom: 12,
    },
    expenseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    expenseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    expenseAmount: {
      fontSize: 20,
      fontWeight: 'bold',
      flex: 1,
    },
    rightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    categoryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    categoryBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    expenseDescription: {
      fontSize: 14,
      marginBottom: 4,
    },
    expenseDate: {
      fontSize: 12,
    },
    deleteButton: {
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editButton: {
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    input: {
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 12,
      color: colors.text,
    },
    categoryContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    categoryButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 2,
      minWidth: 80,
      alignItems: 'center',
    },
    categoryButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    emptyCard: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      textAlign: 'center',
    },
    analyticsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    analyticsCard: {
      flex: 1,
      minWidth: 100,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    analyticsValue: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 8,
      textAlign: 'center',
    },
    analyticsLabel: {
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
    },
    chartCard: {
      marginBottom: 24,
      padding: 16,
    },
    chartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    chartContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    pieCenterLabel: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    pieCenterValue: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    pieCenterText: {
      fontSize: 12,
      marginTop: 4,
    },
    pieLegend: {
      marginTop: 16,
      width: '100%',
    },
    pieLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    pieLegendColor: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    pieLegendText: {
      fontSize: 14,
      flex: 1,
    },
  });

