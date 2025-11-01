import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SyncService } from '@/lib/sync';
import { TrendingDown, X, CheckCircle2, Plus, History, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';

interface Expense {
  id: string;
  amount: number;
  description: string | null;
  expense_date: string;
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

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanModalVisible, setLoanModalVisible] = useState(false);
  const [loanName, setLoanName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDescription, setLoanDescription] = useState('');

  useEffect(() => {
    if (user) {
      loadExpenses();
      loadLoans();
    }
  }, [user]);

  const loadExpenses = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Expense>('expenses', user.id);
    setExpenses(data.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()));
  };

  const addExpense = async () => {
    if (!amount.trim() || !user) return;
    await SyncService.insertWithFallback('expenses', user.id, {
      amount: parseFloat(amount),
      description: description.trim() || null,
      expense_date: format(new Date(), 'yyyy-MM-dd'),
    });
    setAmount('');
    setDescription('');
    setModalVisible(false);
    loadExpenses();
  };

  const loadLoans = async () => {
    if (!user) return;
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

  const settleLoan = async (loanId: string) => {
    if (!user) return;
    await SyncService.updateWithFallback('loans', user.id, loanId, {
      remaining_amount: 0,
      is_settled: true,
    });
    loadLoans();
  };

  const thisMonth = expenses.filter(
    (e) => new Date(e.expense_date).getMonth() === new Date().getMonth()
  );
  const monthlyTotal = thisMonth.reduce((sum, e) => sum + Number(e.amount), 0);

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Expenses"
        subtitle="Track your spending"
        onAddPress={() => setModalVisible(true)}
      />

      <ScrollView style={styles.content}>
        <Card style={styles.statCard}>
          <TrendingDown size={24} color={colors.error} />
          <Text style={[styles.statValue, { color: colors.text }]}>Rs. {Math.round(monthlyTotal).toLocaleString()}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Month</Text>
        </Card>

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

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 0 }]}>Loans to Pay Back</Text>
          <TouchableOpacity
            style={[styles.addLoanButton, { backgroundColor: colors.primary }]}
            onPress={() => setLoanModalVisible(true)}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {loans.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No loans yet.</Text>
          </Card>
        ) : (
          loans.map((loan) => (
            <Card key={loan.id} style={styles.expenseCard}>
              <View style={styles.expenseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expenseAmount, { color: colors.text }]}>
                    Rs. {Math.round(Number(loan.remaining_amount)).toLocaleString()}
                  </Text>
                  <Text style={[styles.expenseDescription, { color: colors.textSecondary }]}>To: {loan.person_name}</Text>
                  {loan.description && (
                    <Text style={[styles.expenseDescription, { color: colors.textSecondary }]}>{loan.description}</Text>
                  )}
                  <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>Opened {format(new Date(loan.created_at), 'MMM dd, yyyy')}</Text>
                </View>
                {!loan.is_settled ? (
                  <TouchableOpacity onPress={() => settleLoan(loan.id)} style={{ padding: 8 }}>
                    <CheckCircle2 size={24} color={colors.success} />
                  </TouchableOpacity>
                ) : (
                  <Text style={{ color: colors.success, fontWeight: '600' }}>Settled</Text>
                )}
              </View>
            </Card>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
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
            <Button title="Add Expense" onPress={addExpense} />
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
    statCard: {
      alignItems: 'center',
      padding: 20,
      marginBottom: 24,
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
    emptyCard: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      textAlign: 'center',
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
  });
