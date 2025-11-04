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
import { showConfirmDestructive, showSuccess, showError } from '@/lib/alert';
import { Button } from '@/components/Button';
import { PieChart as GiftedPieChart } from 'react-native-gifted-charts';

interface Income {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  income_date: string;
}

export default function IncomeHistoryScreen() {
  const { colors } = useTheme();
  const { currency } = useCurrency();
  const { user } = useAuth();
  const router = useRouter();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [allIncomes, setAllIncomes] = useState<Income[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedSource, setSelectedSource] = useState<string | null>(null); // Can be null (all) or source name
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editIncomeId, setEditIncomeId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIncomeDate, setEditIncomeDate] = useState('');

  useEffect(() => {
    if (user) {
      const loadAll = async () => {
        setLoading(true);
        try {
          await loadIncomes();
        } finally {
          setLoading(false);
        }
      };
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    filterIncomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedSource, allIncomes]);

  const loadIncomes = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Income>('incomes', user.id);
    setAllIncomes(data);
  };

  const filterIncomes = () => {
    // Filter by month first
    let filtered = allIncomes.filter((income) => {
      const incomeDate = new Date(income.income_date);
      return (
        incomeDate.getMonth() === selectedMonth.getMonth() &&
        incomeDate.getFullYear() === selectedMonth.getFullYear()
      );
    });

    // Filter by source if selected
    if (selectedSource) {
      filtered = filtered.filter((income) => income.source === selectedSource);
    }

    setIncomes(filtered.sort((a, b) => new Date(b.income_date).getTime() - new Date(a.income_date).getTime()));
  };

  // Get unique sources
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    allIncomes.forEach((income) => {
      if (income.source) {
        sources.add(income.source);
      }
    });
    return Array.from(sources).sort();
  }, [allIncomes]);

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
  };

  const monthlyTotal = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

  // Source breakdown data
  const sourceBreakdown = useMemo(() => {
    const breakdown: { [key: string]: number } = {};
    incomes.forEach((income) => {
      const source = income.source || 'Unknown';
      breakdown[source] = (breakdown[source] || 0) + Number(income.amount);
    });

    const colors_palette = [colors.primary, colors.accent, colors.success, colors.warning, colors.error, '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B', '#14B8A6'];
    
    const pieData = Object.entries(breakdown)
      .map(([name, value], index) => {
        return {
          value: Math.round(value),
          color: colors_palette[index % colors_palette.length],
          text: `${Math.round(value)}`,
          label: name,
        };
      })
      .sort((a, b) => b.value - a.value);

    return pieData;
  }, [incomes, colors]);

  const openEditModal = (income: Income) => {
    setEditIncomeId(income.id);
    setEditAmount(income.amount.toString());
    setEditSource(income.source);
    setEditDescription(income.description || '');
    setEditIncomeDate(income.income_date);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditIncomeId(null);
    setEditAmount('');
    setEditSource('');
    setEditDescription('');
    setEditIncomeDate('');
    setEditModalVisible(false);
  };

  const updateIncome = async () => {
    if (!editAmount.trim() || !editSource.trim() || !user || !editIncomeId) {
      showError('Error', 'Please enter amount and source');
      return;
    }

    try {
      const incomeData = {
        amount: parseFloat(editAmount),
        source: editSource.trim(),
        description: editDescription.trim() || null,
        income_date: editIncomeDate,
      };

      await SyncService.updateWithFallback('incomes', user.id, editIncomeId, incomeData);
      showSuccess('Success', 'Income updated successfully');
      closeEditModal();
      await loadIncomes();
    } catch (error) {
      console.error('Error updating income:', error);
      showError('Error', 'Failed to update income. Please try again.');
    }
  };

  const deleteIncome = async (incomeId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Income', 'Are you sure you want to delete this income? This action cannot be undone.', async () => {
      try {
        await SyncService.deleteWithFallback('incomes', user.id, incomeId);
        await loadIncomes();
      } catch (error) {
        console.error('Error deleting income:', error);
      }
    });
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Income History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <LoadingSpinner message="Loading income history..." />
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
                {selectedSource && (
                  <Text style={[styles.categoryTotal, { color: colors.textSecondary }]}>
                    {' '}({selectedSource})
                  </Text>
                )}
              </Text>
            </Card>

            {/* Source Filter */}
            {uniqueSources.length > 0 && (
              <Card style={styles.filterCard}>
                <View style={styles.filterHeader}>
                  <Filter size={18} color={colors.primary} />
                  <Text style={[styles.filterTitle, { color: colors.text }]}>Filter by Source</Text>
                </View>
                <View style={styles.categoryFilterContainer}>
                  <TouchableOpacity
                    style={[
                      styles.categoryFilterButton,
                      {
                        backgroundColor: selectedSource === null ? colors.primary : colors.surface,
                        borderColor: selectedSource === null ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedSource(null)}
                  >
                    <Text
                      style={[
                        styles.categoryFilterText,
                        {
                          color: selectedSource === null ? '#FFFFFF' : colors.text,
                        },
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {uniqueSources.map((source) => (
                    <TouchableOpacity
                      key={source}
                      style={[
                        styles.categoryFilterButton,
                        {
                          backgroundColor: selectedSource === source ? colors.success : colors.surface,
                          borderColor: selectedSource === source ? colors.success : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedSource(selectedSource === source ? null : source)}
                    >
                      <Text
                        style={[
                          styles.categoryFilterText,
                          {
                            color: selectedSource === source ? '#FFFFFF' : colors.text,
                          },
                        ]}
                      >
                        {source}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            )}

            {/* Source Breakdown Chart */}
            {incomes.length > 0 && sourceBreakdown.length > 0 && (
              <Card style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <PieChart size={20} color={colors.primary} />
                  <Text style={[styles.chartTitle, { color: colors.text }]}>Source Breakdown</Text>
                </View>
                <View style={styles.chartContainer}>
                  <GiftedPieChart
                    data={sourceBreakdown}
                    donut
                    radius={90}
                    innerRadius={60}
                    innerCircleColor={colors.surface}
                    centerLabelComponent={() => (
                      <View style={styles.pieCenterLabel}>
                        <Text style={[styles.pieCenterValue, { color: colors.text }]}>
                          {sourceBreakdown.length}
                        </Text>
                        <Text style={[styles.pieCenterText, { color: colors.textSecondary }]}>
                          {sourceBreakdown.length === 1 ? 'Source' : 'Sources'}
                        </Text>
                      </View>
                    )}
                  />
                  <View style={styles.pieLegend}>
                    {sourceBreakdown.slice(0, 5).map((item, index) => (
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

            {/* Income List */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: incomes.length > 0 ? 8 : 0 }]}>Incomes</Text>
            {incomes.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No income entries for this month.
                </Text>
              </Card>
            ) : (
              incomes.map((income) => (
                <Card key={income.id} style={styles.expenseCard}>
                  <View style={styles.expenseRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.expenseHeader}>
                        <Text style={[styles.expenseAmount, { color: colors.success }]}>
                          {currency.symbol} {Math.round(Number(income.amount)).toLocaleString()}
                        </Text>
                      </View>
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
                    <View style={styles.rightActions}>
                      <TouchableOpacity
                        onPress={() => openEditModal(income)}
                        style={styles.editButton}
                      >
                        <Edit2 size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteIncome(income.id)}
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

      {/* Edit Income Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Income</Text>
              <TouchableOpacity onPress={closeEditModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Amount *"
              placeholderTextColor={colors.textSecondary}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Source * (e.g., Salary, Freelance, Investment)"
              placeholderTextColor={colors.textSecondary}
              value={editSource}
              onChangeText={setEditSource}
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
            <Button title="Update Income" onPress={updateIncome} />
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

