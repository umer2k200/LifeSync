import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { SyncService } from '@/lib/sync';
import { ArrowLeft, Calendar, Filter, Trash2 } from 'lucide-react-native';
import { format } from 'date-fns';
import { showConfirmDestructive } from '@/lib/alert';

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
  const { user } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadCategories();
      loadExpenses();
    }
  }, [user]);

  useEffect(() => {
    filterExpenses();
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
      filtered = filtered.filter((expense) => expense.category_id === selectedCategory);
    }

    setExpenses(filtered.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()));
  };

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return 'Others';
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Others';
  };

  const getCategoryColor = (categoryId: string | null | undefined): string => {
    if (!categoryId) return '#6B7280';
    const category = categories.find((c) => c.id === categoryId);
    return category?.color || '#6B7280';
  };

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
  };

  const monthlyTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

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
            Total: Rs. {Math.round(monthlyTotal).toLocaleString()}
            {selectedCategory && (
              <Text style={[styles.categoryTotal, { color: colors.textSecondary }]}>
                {' '}({getCategoryName(selectedCategory)})
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

        {/* Expense List */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Expenses</Text>
        {expenses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No expenses for this month.
            </Text>
          </Card>
        ) : (
          expenses.map((expense) => {
            const categoryName = getCategoryName(expense.category_id);
            const categoryColor = getCategoryColor(expense.category_id);
            return (
              <Card key={expense.id} style={styles.expenseCard}>
                <View style={styles.expenseRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.expenseHeader}>
                      <Text style={[styles.expenseAmount, { color: colors.text }]}>
                        Rs. {Math.round(Number(expense.amount)).toLocaleString()}
                      </Text>
                      <View
                        style={[
                          styles.categoryBadge,
                          { backgroundColor: categoryColor + '20', borderColor: categoryColor },
                        ]}
                      >
                        <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                          {categoryName}
                        </Text>
                      </View>
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
                  <TouchableOpacity
                    onPress={() => deleteExpense(expense.id)}
                    style={styles.deleteButton}
                  >
                    <Trash2 size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
      justifyContent: 'space-between',
      marginBottom: 4,
      gap: 12,
    },
    expenseAmount: {
      fontSize: 20,
      fontWeight: 'bold',
      flex: 1,
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
    emptyCard: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      textAlign: 'center',
    },
  });

