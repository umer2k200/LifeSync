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
import { ArrowLeft, Calendar, Trash2, Edit2, X } from 'lucide-react-native';
import { format } from 'date-fns';
import { showConfirmDestructive, showSuccess, showError } from '@/lib/alert';
import { Button } from '@/components/Button';

interface Loan {
  id: string;
  type: string; // 'borrowed' | 'lent'
  person_name: string;
  amount: number;
  remaining_amount: number;
  due_date: string | null;
  description: string | null;
  is_settled: boolean;
  created_at: string;
}

export default function LoansHistoryScreen() {
  const { colors } = useTheme();
  const { currency } = useCurrency();
  const { user } = useAuth();
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLoanId, setEditLoanId] = useState<string | null>(null);
  const [editPersonName, setEditPersonName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editRemainingAmount, setEditRemainingAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  useEffect(() => {
    if (user) {
      const loadAll = async () => {
        setLoading(true);
        try {
          await loadLoans();
        } finally {
          setLoading(false);
        }
      };
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    filterLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, allLoans]);

  const loadLoans = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Loan>('loans', user.id);
    // Only show 'borrowed' type loans (loans to pay back)
    const borrowedLoans = data.filter((loan) => loan.type === 'borrowed');
    setAllLoans(borrowedLoans);
  };

  const filterLoans = () => {
    // Filter by month first (based on created_at)
    let filtered = allLoans.filter((loan) => {
      const loanDate = new Date(loan.created_at);
      return (
        loanDate.getMonth() === selectedMonth.getMonth() &&
        loanDate.getFullYear() === selectedMonth.getFullYear()
      );
    });

    // Only show settled/completed loans in history
    filtered = filtered.filter((loan) => loan.is_settled);

    setLoans(filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
  };

  const monthlyTotal = loans.reduce((sum, l) => sum + Number(l.amount), 0);
  const settledCount = loans.length; // All loans shown are settled

  const openEditModal = (loan: Loan) => {
    setEditLoanId(loan.id);
    setEditPersonName(loan.person_name);
    setEditAmount(loan.amount.toString());
    setEditRemainingAmount(loan.remaining_amount.toString());
    setEditDescription(loan.description || '');
    setEditDueDate(loan.due_date || '');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditLoanId(null);
    setEditPersonName('');
    setEditAmount('');
    setEditRemainingAmount('');
    setEditDescription('');
    setEditDueDate('');
    setEditModalVisible(false);
  };

  const updateLoan = async () => {
    if (!editPersonName.trim() || !editAmount.trim() || !editRemainingAmount.trim() || !user || !editLoanId) {
      showError('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const loanData = {
        person_name: editPersonName.trim(),
        amount: parseFloat(editAmount),
        remaining_amount: parseFloat(editRemainingAmount),
        description: editDescription.trim() || null,
        due_date: editDueDate || null,
        is_settled: parseFloat(editRemainingAmount) === 0,
      };

      await SyncService.updateWithFallback('loans', user.id, editLoanId, loanData);
      showSuccess('Success', 'Loan updated successfully');
      closeEditModal();
      await loadLoans();
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
        await loadLoans();
      } catch (error) {
        console.error('Error deleting loan:', error);
      }
    });
  };

  // Settle loan functionality removed since history only shows settled loans

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Loans History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <LoadingSpinner message="Loading loans history..." />
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
              </Text>
              <Text style={[styles.monthOutstanding, { color: colors.success }]}>
                Settled Loans: {settledCount}
              </Text>
            </Card>

            {/* Status Filter and Chart removed since we only show settled loans */}

            {/* Loans List */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: loans.length > 0 ? 8 : 0 }]}>Settled Loans</Text>
            {loans.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No settled loans in this month.
                </Text>
              </Card>
            ) : (
              loans.map((loan) => (
                <Card key={loan.id} style={styles.expenseCard}>
                  <View style={styles.expenseRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.expenseAmount, { color: colors.text }]}>
                        {currency.symbol} {Math.round(Number(loan.amount)).toLocaleString()}
                      </Text>
                      <Text style={[styles.expenseDescription, { color: colors.text, fontWeight: '600' }]}>
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
                      {loan.due_date && (
                        <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                          Due: {format(new Date(loan.due_date), 'MMM dd, yyyy')}
                        </Text>
                      )}
                      <Text style={[styles.expenseDate, { color: colors.success, fontWeight: '600' }]}>
                        Settled
                      </Text>
                    </View>
                    <View style={styles.rightActions}>
                      <TouchableOpacity
                        onPress={() => openEditModal(loan)}
                        style={styles.editButton}
                      >
                        <Edit2 size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteLoan(loan.id)}
                        style={styles.deleteButton}
                      >
                        <Trash2 size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))
            )}

            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      {/* Edit Loan Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Loan</Text>
              <TouchableOpacity onPress={closeEditModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Person's name *"
              placeholderTextColor={colors.textSecondary}
              value={editPersonName}
              onChangeText={setEditPersonName}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Total Amount *"
              placeholderTextColor={colors.textSecondary}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Remaining Amount *"
              placeholderTextColor={colors.textSecondary}
              value={editRemainingAmount}
              onChangeText={setEditRemainingAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={3}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Due Date (YYYY-MM-DD) (optional)"
              placeholderTextColor={colors.textSecondary}
              value={editDueDate}
              onChangeText={setEditDueDate}
            />
            <Button title="Update Loan" onPress={updateLoan} />
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
      marginBottom: 8,
    },
    monthOutstanding: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
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
      gap: 8,
    },
    expenseAmount: {
      fontSize: 20,
      fontWeight: 'bold',
      flex: 1,
    },
    settledBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    settledBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    rightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    settleButton: {
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
    emptyCard: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
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

