import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SyncService } from '@/lib/sync';
import { TrendingDown, TrendingUp, X, Plus, History, ChevronRight, DollarSign, List, Edit2, Trash2, CheckCircle2 } from 'lucide-react-native';
import { format } from 'date-fns';
import { showError, showSuccess, showConfirmDestructive } from '@/lib/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  icon?: string;
}

interface Income {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  income_date: string;
  created_at: string;
}

interface Loan {
  id: string;
  type: string; // 'borrowed' | 'lent' (we'll use 'borrowed' for pay-back loans)
  person_name: string;
  amount: number;
  remaining_amount: number;
  due_date: string | null;
  description: string | null;
  is_settled: boolean;
  created_at: string;
}

type TabType = 'expenses' | 'incomes' | 'loans';

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const { currency } = useCurrency();
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [editIncomeId, setEditIncomeId] = useState<string | null>(null);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [editExpenseModalVisible, setEditExpenseModalVisible] = useState(false);
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseDescription, setEditExpenseDescription] = useState('');
  const [editExpenseSelectedCategory, setEditExpenseSelectedCategory] = useState<string | null>(null);
  const [editExpenseDate, setEditExpenseDate] = useState('');
  const [editLoanId, setEditLoanId] = useState<string | null>(null);
  const [editLoanModalVisible, setEditLoanModalVisible] = useState(false);
  const [editLoanPersonName, setEditLoanPersonName] = useState('');
  const [editLoanAmount, setEditLoanAmount] = useState('');
  const [editLoanDescription, setEditLoanDescription] = useState('');
  const [editLoanDueDate, setEditLoanDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeDescription, setIncomeDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  
  const [loanModalVisible, setLoanModalVisible] = useState(false);
  const [loanName, setLoanName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDescription, setLoanDescription] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const loadAll = async () => {
        setLoading(true);
        try {
          await Promise.all([loadCategories(), loadExpenses(), loadIncomes(), loadLoans()]);
        } finally {
          setLoading(false);
        }
      };
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Reload data when screen comes into focus (e.g., returning from expense history)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        // Always reload expenses when screen comes into focus to reflect changes from expense-history
        loadExpenses();
        loadIncomes();
        // Only reload categories if not in initial loading state
        if (!loading) {
        loadCategories(true); // Skip cleanup when reloading on focus
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadCategories = async (skipCleanup = false) => {
    if (!user) return;
    
    // Only remove old hardcoded categories once per user
    if (!skipCleanup) {
      await removeHardcodedCategoriesOnce();
    }
    
    const data = await SyncService.fetchWithFallback<ExpenseCategory>('expense_categories', user.id);
    setCategories(data.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const removeHardcodedCategoriesOnce = async () => {
    if (!user) return;
    
    // Check if cleanup has already been done for this user
    const cleanupKey = `@lifesync_expense_categories_cleaned_${user.id}`;
    const alreadyCleaned = await AsyncStorage.getItem(cleanupKey);
    
    if (alreadyCleaned === 'true') {
      // Cleanup already done, skip
      return;
    }
    
    // List of old hardcoded category names to remove (only once)
    const hardcodedCategoryNames = ['food', 'bike', 'petrol', 'shopping', 'gym', 'travel', 'bills', 'others'];
    
    try {
      // Get all categories
      const allCategories = await SyncService.fetchWithFallback<ExpenseCategory>('expense_categories', user.id);
      
      // Find and delete hardcoded categories
      const categoriesToDelete = allCategories.filter((cat) =>
        hardcodedCategoryNames.includes(cat.name.toLowerCase())
      );
      
      // Delete each hardcoded category
      for (const category of categoriesToDelete) {
        await SyncService.deleteWithFallback('expense_categories', user.id, category.id);
      }
      
      // Mark cleanup as done
      await AsyncStorage.setItem(cleanupKey, 'true');
    } catch (error) {
      console.error('Error removing hardcoded categories:', error);
    }
  };

  const createCustomCategory = async () => {
    if (!customCategoryName.trim() || !user) {
      showError('Error', 'Please enter a category name');
      return;
    }

    // Check if category already exists
    const existing = categories.find((c) => c.name.toLowerCase() === customCategoryName.trim().toLowerCase());
    if (existing) {
      showError('Error', 'Category already exists');
      return;
    }

    // Generate a random color for custom category using theme-aware colors
    const colorPalette = ['#EF4444', '#F59E0B', '#6A5ACD', '#8B5CF6', '#10B981', '#14B8A6', '#F97316', '#6B7280', '#EC4899', '#06B6D4'];
    const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];

    const newCategory = await SyncService.insertWithFallback<ExpenseCategory>('expense_categories', user.id, {
      name: customCategoryName.trim(),
      color: randomColor,
    });

    if (newCategory) {
      setCustomCategoryName('');
      setShowCustomCategoryInput(false);
      // Add the new category to the state immediately
      setCategories((prev) => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
      // Select the new category
      setSelectedCategory(newCategory.id);
      // Also reload categories to ensure sync with database
      loadCategories(true);
    }
  };

  const loadExpenses = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Expense>('expenses', user.id);
    setExpenses(data.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()));
  };

  const loadIncomes = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Income>('incomes', user.id);
    setIncomes(data.sort((a, b) => new Date(b.income_date).getTime() - new Date(a.income_date).getTime()));
  };

  const closeModal = () => {
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    setShowCustomCategoryInput(false);
    setCustomCategoryName('');
    setModalVisible(false);
  };

  const closeIncomeModal = () => {
    setIncomeAmount('');
    setIncomeSource('');
    setIncomeDescription('');
    setEditIncomeId(null);
    setIncomeModalVisible(false);
  };

  const openIncomeModal = (income?: Income) => {
    if (income) {
      setEditIncomeId(income.id);
      setIncomeAmount(income.amount.toString());
      setIncomeSource(income.source);
      setIncomeDescription(income.description || '');
    } else {
      setEditIncomeId(null);
      setIncomeAmount('');
      setIncomeSource('');
      setIncomeDescription('');
    }
    setIncomeModalVisible(true);
  };

  const addExpense = async () => {
    if (!amount.trim() || !user) {
      showError('Error', 'Please enter an amount');
      return;
    }

    try {
      const expenseData: any = {
        amount: parseFloat(amount),
        description: description.trim() || null,
        expense_date: format(new Date(), 'yyyy-MM-dd'),
      };
      
      // Only add category_id if one is selected
      if (selectedCategory) {
        expenseData.category_id = selectedCategory;
      } else {
        expenseData.category_id = null;
      }
      
      await SyncService.insertWithFallback('expenses', user.id, expenseData);
      showSuccess('Success', 'Expense added successfully');
      
      closeModal();
      loadExpenses();
    } catch (error) {
      console.error('Error adding expense:', error);
      showError('Error', 'Failed to add expense. Please try again.');
    }
  };

  const saveIncome = async () => {
    if (!incomeAmount.trim() || !incomeSource.trim() || !user) {
      showError('Error', 'Please enter amount and source');
      return;
    }

    try {
      const incomeData = {
        amount: parseFloat(incomeAmount),
        source: incomeSource.trim(),
        description: incomeDescription.trim() || null,
        income_date: format(new Date(), 'yyyy-MM-dd'),
      };

      if (editIncomeId) {
        await SyncService.updateWithFallback('incomes', user.id, editIncomeId, incomeData);
        showSuccess('Success', 'Income updated!');
      } else {
        await SyncService.insertWithFallback('incomes', user.id, incomeData);
        showSuccess('Success', 'Income added!');
      }

      closeIncomeModal();
      loadIncomes();
    } catch (error) {
      console.error('Error saving income:', error);
      showError('Error', 'Failed to save income. Please try again.');
    }
  };

  const deleteIncome = async (incomeId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Income', 'Are you sure you want to delete this income? This action cannot be undone.', async () => {
      try {
        await SyncService.deleteWithFallback('incomes', user.id, incomeId);
        loadIncomes();
      } catch (error) {
        console.error('Error deleting income:', error);
      }
    });
  };

  // Income deletion will be handled in the income history page

  const openEditExpenseModal = (expense: Expense) => {
    setEditExpenseId(expense.id);
    setEditExpenseAmount(expense.amount.toString());
    setEditExpenseDescription(expense.description || '');
    setEditExpenseSelectedCategory(expense.category_id || null);
    setEditExpenseDate(expense.expense_date);
    setEditExpenseModalVisible(true);
  };

  const closeEditExpenseModal = () => {
    setEditExpenseId(null);
    setEditExpenseAmount('');
    setEditExpenseDescription('');
    setEditExpenseSelectedCategory(null);
    setEditExpenseDate('');
    setEditExpenseModalVisible(false);
  };

  const updateExpense = async () => {
    if (!editExpenseAmount.trim() || !user || !editExpenseId) {
      showError('Error', 'Please enter an amount');
      return;
    }

    try {
      const expenseData: any = {
        amount: parseFloat(editExpenseAmount),
        description: editExpenseDescription.trim() || null,
        expense_date: editExpenseDate,
      };

      if (editExpenseSelectedCategory) {
        expenseData.category_id = editExpenseSelectedCategory;
      } else {
        expenseData.category_id = null;
      }

      await SyncService.updateWithFallback('expenses', user.id, editExpenseId, expenseData);
      showSuccess('Success', 'Expense updated successfully');
      closeEditExpenseModal();
      loadExpenses();
    } catch (error) {
      console.error('Error updating expense:', error);
      showError('Error', 'Failed to update expense. Please try again.');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Expense', 'Are you sure you want to delete this expense? This action cannot be undone.', async () => {
      try {
        await SyncService.deleteWithFallback('expenses', user.id, expenseId);
        loadExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    });
  };

  const openEditLoanModal = (loan: Loan) => {
    setEditLoanId(loan.id);
    setEditLoanPersonName(loan.person_name);
    setEditLoanAmount(loan.amount.toString());
    setEditLoanDescription(loan.description || '');
    setEditLoanDueDate(loan.due_date || '');
    setEditLoanModalVisible(true);
  };

  const closeEditLoanModal = () => {
    setEditLoanId(null);
    setEditLoanPersonName('');
    setEditLoanAmount('');
    setEditLoanDescription('');
    setEditLoanDueDate('');
    setEditLoanModalVisible(false);
  };

  const updateLoan = async () => {
    if (!editLoanPersonName.trim() || !editLoanAmount.trim() || !user || !editLoanId) {
      showError('Error', 'Please fill in all required fields');
      return;
    }

    try {
      // Find the loan to preserve the existing remaining_amount
      const existingLoan = loans.find(l => l.id === editLoanId);
      const remainingAmount = existingLoan ? existingLoan.remaining_amount : parseFloat(editLoanAmount);
      
      const loanData = {
        person_name: editLoanPersonName.trim(),
        amount: parseFloat(editLoanAmount),
        remaining_amount: remainingAmount,
        description: editLoanDescription.trim() || null,
        due_date: editLoanDueDate || null,
        is_settled: remainingAmount === 0,
      };

      await SyncService.updateWithFallback('loans', user.id, editLoanId, loanData);
      showSuccess('Success', 'Loan updated successfully');
      closeEditLoanModal();
      loadLoans();
    } catch (error) {
      console.error('Error updating loan:', error);
      showError('Error', 'Failed to update loan. Please try again.');
    }
  };

  const deleteLoan = async (loanId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Loan', 'Are you sure you want to delete this loan? This action cannot be undone.', async () => {
      try {
        await SyncService.deleteWithFallback('loans', user.id, loanId);
        loadLoans();
      } catch (error) {
        console.error('Error deleting loan:', error);
      }
    });
  };

  const settleLoan = async (loanId: string) => {
    if (!user) return;
    try {
      await SyncService.updateWithFallback('loans', user.id, loanId, {
        remaining_amount: 0,
        is_settled: true,
      });
      showSuccess('Success', 'Loan marked as settled');
      loadLoans();
    } catch (error) {
      console.error('Error settling loan:', error);
      showError('Error', 'Failed to settle loan. Please try again.');
    }
  };

  const loadLoans = async () => {
    if (!user) return;
    // Load ALL loans (no date filtering)
    const data = await SyncService.fetchWithFallback<Loan>('loans', user.id);
    setLoans(
      data
        .filter((l) => l.type === 'borrowed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    );
  };

  const addLoan = async () => {
    if (!loanName.trim() || !loanAmount.trim() || !user) return;
    await SyncService.insertWithFallback('loans', user.id, {
      type: 'borrowed',
      person_name: loanName.trim(),
      amount: parseFloat(loanAmount),
      remaining_amount: parseFloat(loanAmount),
      description: loanDescription.trim() || null,
      due_date: null,
    });
    setLoanName('');
    setLoanAmount('');
    setLoanDescription('');
    setLoanModalVisible(false);
    loadLoans();
  };

  // Loan settlement is handled in the loans history page

  const thisMonth = expenses.filter(
    (e) => new Date(e.expense_date).getMonth() === new Date().getMonth() &&
           new Date(e.expense_date).getFullYear() === new Date().getFullYear()
  );
  const monthlyTotal = thisMonth.reduce((sum, e) => sum + Number(e.amount), 0);

  const thisMonthIncomes = incomes.filter(
    (i) => new Date(i.income_date).getMonth() === new Date().getMonth() &&
           new Date(i.income_date).getFullYear() === new Date().getFullYear()
  );
  const monthlyIncome = thisMonthIncomes.reduce((sum, i) => sum + Number(i.amount), 0);

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Finance"
        subtitle={activeTab === 'expenses' ? 'Track your spending' : activeTab === 'incomes' ? 'Track your income' : 'Track your loans'}
        onAddPress={() => {
          if (activeTab === 'expenses') {
            setModalVisible(true);
          } else if (activeTab === 'incomes') {
            openIncomeModal();
          } else if (activeTab === 'loans') {
            setLoanModalVisible(true);
          }
        }}
      />

      <ScrollView style={styles.content}>
        {loading ? (
          <LoadingSpinner message="Loading..." />
        ) : (
          <>
            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'expenses' && styles.activeTab, { backgroundColor: activeTab === 'expenses' ? colors.primary : colors.surface }]}
                onPress={() => setActiveTab('expenses')}
              >
                <TrendingDown size={18} color={activeTab === 'expenses' ? '#fff' : colors.text} />
                <Text style={[styles.tabText, { color: activeTab === 'expenses' ? '#fff' : colors.text }]}>Expenses</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'incomes' && styles.activeTab, { backgroundColor: activeTab === 'incomes' ? colors.primary : colors.surface }]}
                onPress={() => setActiveTab('incomes')}
              >
                <TrendingUp size={18} color={activeTab === 'incomes' ? '#fff' : colors.text} />
                <Text style={[styles.tabText, { color: activeTab === 'incomes' ? '#fff' : colors.text }]}>Income</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'loans' && styles.activeTab, { backgroundColor: activeTab === 'loans' ? colors.primary : colors.surface }]}
                onPress={() => setActiveTab('loans')}
              >
                <DollarSign size={18} color={activeTab === 'loans' ? '#fff' : colors.text} />
                <Text style={[styles.tabText, { color: activeTab === 'loans' ? '#fff' : colors.text }]}>Loans</Text>
              </TouchableOpacity>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              {activeTab === 'expenses' && (
                <>
                  <Card style={styles.statCard}>
                    <TrendingDown size={24} color={colors.error} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{currency.symbol} {Math.round(monthlyTotal).toLocaleString()}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Month</Text>
                  </Card>
                  <Card style={styles.statCard}>
                    <List size={24} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{thisMonth.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
                  </Card>
                </>
              )}
              {activeTab === 'incomes' && (
                <>
                  <Card style={styles.statCard}>
                    <TrendingUp size={24} color={colors.success} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{currency.symbol} {Math.round(monthlyIncome).toLocaleString()}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Month</Text>
                  </Card>
                  <Card style={styles.statCard}>
                    <List size={24} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{thisMonthIncomes.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
                  </Card>
                </>
              )}
              {activeTab === 'loans' && (
                <>
                  <Card style={styles.statCard}>
                    <DollarSign size={24} color={colors.error} />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {currency.symbol} {Math.round(loans.filter(l => !l.is_settled).reduce((sum, l) => sum + Number(l.remaining_amount), 0)).toLocaleString()}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Outstanding</Text>
                  </Card>
                  <Card style={styles.statCard}>
                    <List size={24} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{loans.filter(l => !l.is_settled).length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
                  </Card>
                </>
              )}
            </View>

            {/* History Card - Only for Expenses */}
            {activeTab === 'expenses' && (
              <TouchableOpacity onPress={() => router.push('/expense-history')} activeOpacity={0.7}>
                <Card style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyLeft}>
                      <History size={24} color={colors.primary} />
                      <Text style={[styles.historyTitle, { color: colors.text }]}>History</Text>
                    </View>
                    <ChevronRight size={24} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.historySubtitle, { color: colors.textSecondary }]}>
                    View monthly expenses and graphs
                  </Text>
                </Card>
              </TouchableOpacity>
            )}

            {/* Expenses Tab Content */}
            {activeTab === 'expenses' && (
              <>
                {thisMonth.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>This Month</Text>
                    {thisMonth.map((expense) => {
                      const categoryName = categories.find(c => c.id === expense.category_id)?.name || null;
                      return (
                        <Card key={expense.id} style={styles.expenseCard}>
                          <View style={styles.expenseRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.expenseAmount, { color: colors.text }]}>
                                {currency.symbol} {Math.round(Number(expense.amount)).toLocaleString()}
                              </Text>
                              {expense.description && (
                                <Text style={[styles.expenseDescription, { color: colors.textSecondary }]}>
                                  {expense.description}
                                </Text>
                              )}
                              <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                                {format(new Date(expense.expense_date), 'MMM dd, yyyy')}
                              </Text>
                            </View>
                            <View style={styles.itemActions}>
                              {categoryName && (
                                <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                                  <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>
                                    {categoryName}
                                  </Text>
                                </View>
                              )}
                              <TouchableOpacity style={styles.editButton} onPress={() => openEditExpenseModal(expense)}>
                                <Edit2 size={18} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteExpense(expense.id)}>
                                <Trash2 size={18} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </Card>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {/* History Card - Only for Incomes */}
            {activeTab === 'incomes' && (
              <TouchableOpacity onPress={() => router.push('/income-history')} activeOpacity={0.7}>
                <Card style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyLeft}>
                      <History size={24} color={colors.primary} />
                      <Text style={[styles.historyTitle, { color: colors.text }]}>History</Text>
                    </View>
                    <ChevronRight size={24} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.historySubtitle, { color: colors.textSecondary }]}>
                    View monthly income and graphs
                  </Text>
                </Card>
              </TouchableOpacity>
            )}

            {/* Incomes Tab Content */}
            {activeTab === 'incomes' && (
              <>
                {thisMonthIncomes.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>This Month</Text>
                    {thisMonthIncomes.map((income) => (
                      <Card key={income.id} style={styles.expenseCard}>
                        <View style={styles.expenseRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.expenseAmount, { color: colors.success }]}>
                              {currency.symbol} {Math.round(Number(income.amount)).toLocaleString()}
                            </Text>
                            <Text style={[styles.expenseDescription, { color: colors.text, fontWeight: '600' }]}>
                              {income.source}
                            </Text>
                            {income.description && (
                              <Text style={[styles.expenseDescription, { color: colors.textSecondary }]}>
                                {income.description}
                              </Text>
                            )}
                            <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                              {format(new Date(income.income_date), 'MMM dd, yyyy')}
                            </Text>
                          </View>
                          <View style={styles.itemActions}>
                            <TouchableOpacity style={styles.editButton} onPress={() => openIncomeModal(income)}>
                              <Edit2 size={18} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteIncome(income.id)}>
                              <Trash2 size={18} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}

            {/* History Card - Only for Loans */}
            {activeTab === 'loans' && (
              <TouchableOpacity onPress={() => router.push('/loans-history')} activeOpacity={0.7}>
                <Card style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyLeft}>
                      <History size={24} color={colors.primary} />
                      <Text style={[styles.historyTitle, { color: colors.text }]}>History</Text>
                    </View>
                    <ChevronRight size={24} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.historySubtitle, { color: colors.textSecondary }]}>
                    View monthly loans and graphs
                  </Text>
                </Card>
              </TouchableOpacity>
            )}

            {/* Loans Tab Content */}
            {activeTab === 'loans' && (
              <>
                {loans.filter(l => !l.is_settled).length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>All Loans</Text>
                    {loans.filter(l => !l.is_settled).map((loan) => (
                      <Card key={loan.id} style={styles.expenseCard}>
                        <View style={styles.expenseRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.expenseAmount, { color: colors.text }]}>
                              {currency.symbol} {Math.round(Number(loan.remaining_amount)).toLocaleString()}
                            </Text>
                            <Text style={[styles.expenseDescription, { color: colors.textSecondary }]}>
                              To: {loan.person_name}
                            </Text>
                            
                            {loan.description && (
                              <Text style={[styles.expenseDescription, { color: colors.textSecondary }]}>
                                {loan.description}
                              </Text>
                            )}
                            <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                              Created {format(new Date(loan.created_at), 'MMM dd, yyyy')}
                            </Text>
                            {loan.is_settled && (
                              <Text style={[styles.expenseDate, { color: colors.success, fontWeight: '600' }]}>
                                Settled
                              </Text>
                            )}
                          </View>
                          <View style={styles.itemActions}>
                            {!loan.is_settled && (
                              <TouchableOpacity style={styles.settleButton} onPress={() => settleLoan(loan.id)}>
                                <CheckCircle2 size={18} color={colors.success} />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.editButton} onPress={() => openEditLoanModal(loan)}>
                              <Edit2 size={18} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteLoan(loan.id)}>
                              <Trash2 size={18} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}

        <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Expense</Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Amount"
              placeholderTextColor={colors.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
            />
            
            <Text style={[styles.inputLabel, { color: colors.text }]}>Category (Optional)</Text>
            
            {categories.length === 0 && !showCustomCategoryInput ? (
              <View style={styles.emptyCategoryContainer}>
                <Text style={[styles.emptyCategoryText, { color: colors.textSecondary }]}>
                  No categories yet. Create your first category!
                </Text>
                {/* Add Custom Category Button */}
                <TouchableOpacity
                  style={[
                    styles.addCategoryButton,
                    {
                      backgroundColor: colors.primary,
                      marginTop: 12,
                    },
                  ]}
                  onPress={() => {
                    setShowCustomCategoryInput(true);
                    setSelectedCategory(null);
                  }}
                >
                  <Plus size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.categoryContainer}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      {
                        backgroundColor: selectedCategory === category.id
                          ? colors.primary
                          : colors.surface,
                        borderColor: selectedCategory === category.id
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedCategory(category.id);
                      setShowCustomCategoryInput(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        {
                          color: selectedCategory === category.id
                            ? '#FFFFFF'
                            : colors.text,
                        },
                      ]}
                    >
                      {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Add Custom Category Button */}
                <TouchableOpacity
                  style={[
                    styles.addCategoryButton,
                    {
                      backgroundColor: showCustomCategoryInput ? colors.error : colors.primary,
                    },
                  ]}
                  onPress={() => {
                    setShowCustomCategoryInput(!showCustomCategoryInput);
                    if (!showCustomCategoryInput) {
                      setSelectedCategory(null);
                    }
                  }}
                >
                  {showCustomCategoryInput ? (
                    <X size={20} color="#FFFFFF" />
                  ) : (
                    <Plus size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            )}
            
            {/* Custom Category Input */}
            {showCustomCategoryInput && (
              <View style={styles.customCategoryContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="Category name"
                  placeholderTextColor={colors.textSecondary}
                  value={customCategoryName}
                  onChangeText={setCustomCategoryName}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.createCategoryButton, { backgroundColor: colors.primary }]}
                  onPress={createCustomCategory}
                >
                  <Text style={[styles.createCategoryButtonText, { color: '#FFFFFF' }]}>Create Category</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <Button title="Add Expense" onPress={addExpense} />
          </View>
        </View>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal visible={editExpenseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Expense</Text>
              <TouchableOpacity onPress={closeEditExpenseModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Amount *"
              placeholderTextColor={colors.textSecondary}
              value={editExpenseAmount}
              onChangeText={setEditExpenseAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={editExpenseDescription}
              onChangeText={setEditExpenseDescription}
            />
            <Text style={[styles.inputLabel, { color: colors.text }]}>Category (Optional)</Text>
            <View style={styles.categoryContainer}>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor: editExpenseSelectedCategory === null ? colors.secondary : colors.surface,
                    borderColor: editExpenseSelectedCategory === null ? colors.secondary : colors.border,
                  },
                ]}
                onPress={() => setEditExpenseSelectedCategory(null)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    {
                      color: editExpenseSelectedCategory === null ? '#FFFFFF' : colors.text,
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
                      backgroundColor: editExpenseSelectedCategory === category.id ? (category.color || colors.primary) : colors.surface,
                      borderColor: editExpenseSelectedCategory === category.id ? (category.color || colors.primary) : colors.border,
                    },
                  ]}
                  onPress={() => setEditExpenseSelectedCategory(editExpenseSelectedCategory === category.id ? null : category.id)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      {
                        color: editExpenseSelectedCategory === category.id ? '#FFFFFF' : colors.text,
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

      {/* Add Income Modal */}
      <Modal visible={incomeModalVisible} animationType="slide" transparent onRequestClose={closeIncomeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editIncomeId ? 'Edit Income' : 'Add Income'}
              </Text>
              <TouchableOpacity onPress={closeIncomeModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Amount *"
              placeholderTextColor={colors.textSecondary}
              value={incomeAmount}
              onChangeText={setIncomeAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Source * (e.g., Salary, Freelance, Investment)"
              placeholderTextColor={colors.textSecondary}
              value={incomeSource}
              onChangeText={setIncomeSource}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={incomeDescription}
              onChangeText={setIncomeDescription}
              multiline
              numberOfLines={3}
            />
            <Button title={editIncomeId ? 'Update Income' : 'Add Income'} onPress={saveIncome} />
          </View>
        </View>
      </Modal>

      {/* Edit Loan Modal */}
      <Modal visible={editLoanModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Loan</Text>
              <TouchableOpacity onPress={closeEditLoanModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Person's name *"
              placeholderTextColor={colors.textSecondary}
              value={editLoanPersonName}
              onChangeText={setEditLoanPersonName}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Total Amount *"
              placeholderTextColor={colors.textSecondary}
              value={editLoanAmount}
              onChangeText={setEditLoanAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={editLoanDescription}
              onChangeText={setEditLoanDescription}
              multiline
              numberOfLines={3}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Due Date (YYYY-MM-DD) (optional)"
              placeholderTextColor={colors.textSecondary}
              value={editLoanDueDate}
              onChangeText={setEditLoanDueDate}
            />
            <Button title="Update Loan" onPress={updateLoan} />
          </View>
        </View>
      </Modal>

      {/* Add Loan Modal */}
      <Modal visible={loanModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Loan</Text>
              <TouchableOpacity onPress={() => setLoanModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]} 
              placeholder="Person's name" 
              placeholderTextColor={colors.textSecondary} 
              value={loanName} 
              onChangeText={setLoanName} 
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]} 
              placeholder="Amount" 
              placeholderTextColor={colors.textSecondary} 
              value={loanAmount} 
              onChangeText={setLoanAmount} 
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]} 
              placeholder="Description (optional)" 
              placeholderTextColor={colors.textSecondary} 
              value={loanDescription} 
              onChangeText={setLoanDescription} 
            />
            <Button title="Add Loan" onPress={addLoan} />
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
    content: {
      flex: 1,
      padding: 20,
    },
    tabContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    activeTab: {
      // Active tab styling handled via backgroundColor
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
    },
    historyCard: {
      marginBottom: 24,
      padding: 16,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    historyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    historyTitle: {
      fontSize: 20,
      fontWeight: '600',
    },
    historySubtitle: {
      fontSize: 14,
      marginLeft: 36,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginTop: 8,
    },
    statLabel: {
      fontSize: 12,
      marginTop: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    addLoanButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    expenseCard: {
      marginBottom: 12,
    },
    expenseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    expenseAmount: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    expenseDescription: {
      fontSize: 14,
      marginBottom: 4,
    },
    expenseDate: {
      fontSize: 12,
    },
    itemActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    categoryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      alignSelf: 'center',
    },
    categoryBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    settleButton: {
      padding: 4,
    },
    emptyCard: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      textAlign: 'center',
    },
    editButton: {
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteButton: {
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
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 2,
      minWidth: 80,
      alignItems: 'center',
    },
    categoryButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    customCategoryContainer: {
      marginTop: 8,
      marginBottom: 16,
    },
    createCategoryButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
    },
    createCategoryButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    emptyCategoryContainer: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginBottom: 16,
      alignItems: 'center',
    },
    emptyCategoryText: {
      fontSize: 14,
      textAlign: 'center',
    },
    addCategoryButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
