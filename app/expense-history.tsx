import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { SyncService } from '@/lib/sync';
import { ArrowLeft, Calendar } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface Expense {
  id: string;
  amount: number;
  description: string | null;
  expense_date: string;
}

export default function ExpenseHistoryScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    if (user) {
      loadExpenses();
    }
  }, [user, selectedMonth]);

  const loadExpenses = async () => {
    if (!user) return;
    const allExpenses = await SyncService.fetchWithFallback<Expense>('expenses', user.id);
    
    // Filter expenses for the selected month
    const filteredExpenses = allExpenses.filter((expense) => {
      const expenseDate = new Date(expense.expense_date);
      return (
        expenseDate.getMonth() === selectedMonth.getMonth() &&
        expenseDate.getFullYear() === selectedMonth.getFullYear()
      );
    });
    
    setExpenses(filteredExpenses.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()));
  };

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
  };

  // Prepare data for line graph (daily view)
  const getGraphData = () => {
    const firstDay = startOfMonth(selectedMonth);
    const lastDay = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start: firstDay, end: lastDay });

    // Create a map of expenses by day
    const expensesByDay = new Map<number, number>();
    expenses.forEach((expense) => {
      const day = new Date(expense.expense_date).getDate();
      const current = expensesByDay.get(day) || 0;
      expensesByDay.set(day, current + expense.amount);
    });

    // Get all values to calculate max
    const values = Array.from(expensesByDay.values());
    const maxValue = Math.max(...values, 1); // At least 1 to avoid division by zero

    return days.map((day) => ({
      day: day.getDate(),
      amount: expensesByDay.get(day.getDate()) || 0,
      percentage: maxValue > 0 ? ((expensesByDay.get(day.getDate()) || 0) / maxValue) * 100 : 0,
    }));
  };

  const monthlyTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const graphData = getGraphData();
  const maxAmount = Math.max(...graphData.map((d) => d.amount), 1);

  const styles = createStyles(colors);

  // Line Graph Component
  const LineGraph = ({ data }: { data: Array<{ day: number; amount: number; percentage: number }> }) => {
    const { colors } = useTheme();
    const [width, setWidth] = React.useState(0);
    const height = 180;
    const padding = 16;
    const bottomPadding = 20; // Space for x-axis labels
    
    if (!data || data.length === 0) return null;
    
    const maxVal = Math.max(...data.map((p) => p.amount), 1);
    const points = data.map((p, idx) => {
      const x = width <= 0 ? 0 : padding + (idx * (width - padding * 2)) / Math.max(1, data.length - 1);
      const y = padding + (height - padding * 2 - bottomPadding) - ((p.amount / maxVal) * (height - padding * 2 - bottomPadding));
      return { x, y };
    });

    return (
      <View>
        <View style={[styles.sparkContainer, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent, i) => (
            <View
              key={`grid-${i}`}
              style={{
                position: 'absolute',
                left: padding,
                top: padding + (percent / 100) * (height - padding * 2 - bottomPadding),
                right: padding,
                height: 1,
                backgroundColor: colors.border,
                opacity: 0.3,
              }}
            />
          ))}
          
          {/* Line segments */}
          {points.map((pt, i) => {
            if (i === 0) return null;
            const prev = points[i - 1];
            const dx = pt.x - prev.x;
            const dy = pt.y - prev.y;
            const length = Math.sqrt(dx * dx + dy * dy) || 0;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={`seg-${i}`}
                style={{
                  position: 'absolute',
                  left: prev.x,
                  top: prev.y,
                  width: length,
                  height: 3,
                  backgroundColor: colors.primary,
                  transform: [{ rotateZ: `${angle}deg` }],
                }}
              />
            );
          })}
          
          {/* Dots */}
          {points.map((pt, i) => (
            <View
              key={`dot-${i}`}
              style={{
                position: 'absolute',
                left: pt.x - 4,
                top: pt.y - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.background,
              }}
            />
          ))}
        </View>
        
        {/* X-axis labels */}
        <View style={styles.xAxisContainer}>
          {data.map((d, idx) => {
            const x = width <= 0 ? 0 : padding + (idx * (width - padding * 2)) / Math.max(1, data.length - 1);
            // Only show every 5th day or first and last
            const shouldShow = idx === 0 || idx === data.length - 1 || (idx + 1) % 5 === 0;
            if (!shouldShow) return null;
            
            return (
              <Text
                key={`xlabel-${idx}`}
                style={[
                  styles.xAxisLabel,
                  {
                    color: colors.textSecondary,
                    left: x - 10,
                  }
                ]}
              >
                {d.day}
              </Text>
            );
          })}
        </View>
      </View>
    );
  };

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
          </Text>
        </Card>

        {/* Graph */}
        <Card style={styles.graphCard}>
          <Text style={[styles.graphTitle, { color: colors.text }]}>Daily Expenses</Text>
          <LineGraph data={graphData} />
          <View style={styles.graphLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                Max: Rs. {Math.round(maxAmount).toLocaleString()}
              </Text>
            </View>
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
          expenses.map((expense) => (
            <Card key={expense.id} style={styles.expenseCard}>
              <View style={styles.expenseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expenseAmount, { color: colors.text }]}>
                    Rs. {Math.round(Number(expense.amount)).toLocaleString()}
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
              </View>
            </Card>
          ))
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
    graphCard: {
      marginBottom: 24,
      padding: 20,
    },
    graphTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
    },
    sparkContainer: {
      width: '100%',
      position: 'relative',
      paddingBottom: 8,
    },
    xAxisContainer: {
      width: '100%',
      height: 20,
      position: 'relative',
      marginTop: 4,
    },
    xAxisLabel: {
      fontSize: 10,
      position: 'absolute',
      width: 20,
      textAlign: 'center',
    },
    graphLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 8,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
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
  });

