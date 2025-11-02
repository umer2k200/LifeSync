import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SyncService } from '@/lib/sync';
import { CheckCircle2, Circle, Droplet, X, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { showError, showConfirmDestructive } from '@/lib/alert';

interface Habit {
  id: string;
  name: string;
  current_streak: number;
  best_streak: number;
}

export default function HabitsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [allHabitLogs, setAllHabitLogs] = useState<any[]>([]);
  const [waterIntake, setWaterIntake] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editHabitId, setEditHabitId] = useState<string | null>(null);
  const [habitName, setHabitName] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Reload habits when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        loadData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [habitsData, logsData, allLogsData, waterData] = await Promise.all([
      SyncService.fetchWithFallback<Habit>('habits', user.id),
      SyncService.fetchWithFallback('habit_logs', user.id, (q: any) =>
        q.eq('completed_at', format(new Date(), 'yyyy-MM-dd'))
      ),
      SyncService.fetchWithFallback('habit_logs', user.id), // Load all logs for calendar
      SyncService.fetchWithFallback('water_logs', user.id, (q: any) =>
        q.eq('date', format(new Date(), 'yyyy-MM-dd'))
      ),
    ]);
    setHabits(habitsData);
    setHabitLogs(logsData);
    setAllHabitLogs(allLogsData);
    const totalWater = waterData.reduce((sum: number, log: any) => sum + log.amount_ml, 0);
    setWaterIntake(totalWater);
    } finally {
      setLoading(false);
    }
  };

  const toggleHabit = async (habitId: string) => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const existing = habitLogs.find((log) => log.habit_id === habitId);

    if (existing) {
      await SyncService.deleteWithFallback('habit_logs', user.id, existing.id);
    } else {
      await SyncService.insertWithFallback('habit_logs', user.id, {
        habit_id: habitId,
        completed_at: today,
      });
    }
    loadData();
  };

  const addWater = async (amount: number) => {
    if (!user) return;
    await SyncService.insertWithFallback('water_logs', user.id, {
      amount_ml: amount,
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    loadData();
  };

  const openEditModal = (habit: Habit) => {
    setEditHabitId(habit.id);
    setHabitName(habit.name);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditHabitId(null);
    setHabitName('');
  };

  const saveHabit = async () => {
    if (!user) return;
    if (!habitName.trim()) {
      showError('Error', 'Please enter a habit name');
      return;
    }

    if (editHabitId) {
      // Update existing habit
      await SyncService.updateWithFallback('habits', user.id, editHabitId, {
        name: habitName.trim(),
      });
    } else {
      // Create new habit
      await SyncService.insertWithFallback('habits', user.id, {
        name: habitName.trim(),
      });
    }

    closeModal();
    loadData();
  };

  const deleteHabit = async (habitId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Habit', 'Are you sure you want to delete this habit? This will also delete all its logs.', async () => {
      await SyncService.deleteWithFallback('habits', user.id, habitId);
      loadData();
    });
  };

  const isHabitCompleted = (habitId: string) => {
    return habitLogs.some((log) => log.habit_id === habitId);
  };

  // Calendar helpers
  const getCompletedDates = () => {
    const dateMap: { [key: string]: number } = {};
    allHabitLogs.forEach((log) => {
      const date = log.completed_at;
      if (date) {
        dateMap[date] = (dateMap[date] || 0) + 1;
      }
    });
    return dateMap;
  };

  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding days from previous month to start on Sunday
    const firstDay = monthStart.getDay();
    const paddingDays: Date[] = [];
    for (let i = 0; i < firstDay; i++) {
      const date = new Date(monthStart);
      date.setDate(date.getDate() - firstDay + i);
      paddingDays.push(date);
    }
    
    return [...paddingDays, ...days];
  };

  const completedDates = getCompletedDates();
  const calendarDays = getCalendarDays();

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentMonth(newDate);
  };

  const styles = createStyles(colors);
  const waterGoal = 2500;
  const waterProgress = Math.min((waterIntake / waterGoal) * 100, 100);

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Habits" 
        subtitle="Track your daily progress" 
        onAddPress={() => {
          setEditHabitId(null);
          setHabitName('');
          setModalVisible(true);
        }} 
      />

      <ScrollView style={styles.content}>
        {loading ? (
          <LoadingSpinner message="Loading habits..." />
        ) : (
          <>
            {/* Calendar */}
            <Card style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth('prev')}>
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.calendarTitle, { color: colors.text }]}>
              {format(currentMonth, 'MMMM yyyy')}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth('next')}>
              <ChevronRight size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          {/* Day labels */}
          <View style={styles.dayLabels}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={[styles.dayLabel, { color: colors.textSecondary }]}>
                {day}
              </Text>
            ))}
          </View>
          
          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const completedCount = completedDates[dateStr] || 0;
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);
              const hasCompletion = completedCount > 0;
              
              return (
                <View
                  key={`${day.getTime()}-${index}`}
                  style={[
                    styles.calendarDay,
                    !isCurrentMonth && styles.calendarDayOtherMonth,
                    isCurrentDay && { borderWidth: 2, borderColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      { color: isCurrentMonth ? colors.text : colors.textSecondary },
                      isCurrentDay && { color: colors.primary, fontWeight: 'bold' },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  {hasCompletion && (
                    <View
                      style={[
                        styles.completionDot,
                        {
                          backgroundColor: completedCount >= habits.length ? colors.success : colors.primary,
                        },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
          
          {/* Legend */}
          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                Some habits
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                All habits
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.waterCard}>
          <View style={styles.waterHeader}>
            <Droplet size={24} color={colors.primary} />
            <Text style={[styles.waterTitle, { color: colors.text }]}>Water Intake</Text>
          </View>
          <Text style={[styles.waterAmount, { color: colors.text }]}>
            {waterIntake} / {waterGoal} ml
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${waterProgress}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <View style={styles.waterButtons}>
            <TouchableOpacity
              style={[styles.waterButton, { backgroundColor: colors.surface }]}
              onPress={() => addWater(250)}
            >
              <Text style={[styles.waterButtonText, { color: colors.primary }]}>+250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.waterButton, { backgroundColor: colors.surface }]}
              onPress={() => addWater(500)}
            >
              <Text style={[styles.waterButtonText, { color: colors.primary }]}>+500ml</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Habits</Text>
        {habits.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No habits yet. Add some to track your progress!
            </Text>
          </Card>
        ) : (
          habits.map((habit) => {
            const completed = isHabitCompleted(habit.id);
            return (
              <Card key={habit.id} style={styles.habitCard}>
                <View style={styles.habitContent}>
                  <TouchableOpacity onPress={() => toggleHabit(habit.id)} activeOpacity={0.7}>
                    {completed ? (
                      <CheckCircle2 size={28} color={colors.success} />
                    ) : (
                      <Circle size={28} color={colors.border} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => toggleHabit(habit.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.habitName, { color: colors.text }]}>
                      {habit.name}
                    </Text>
                    <Text style={[styles.habitStreak, { color: colors.textSecondary }]}>
                      Current: {habit.current_streak} days | Best: {habit.best_streak} days
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.habitActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => openEditModal(habit)}
                    >
                      <Edit2 size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                      onPress={() => deleteHabit(habit.id)}
                    >
                      <Trash2 size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        <View style={{ height: 80 }} />
          </>
        )}
      </ScrollView>

      {/* Add Habit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editHabitId ? 'Edit Habit' : 'New Habit'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Habit name (e.g., Morning walk)"
              placeholderTextColor={colors.textSecondary}
              value={habitName}
              onChangeText={setHabitName}
            />

            <Button title={editHabitId ? 'Update Habit' : 'Add Habit'} onPress={saveHabit} />
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
    waterCard: {
      marginBottom: 24,
    },
    waterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    waterTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    waterAmount: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    progressBar: {
      height: 12,
      backgroundColor: colors.surface,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 16,
    },
    progressFill: {
      height: '100%',
      borderRadius: 6,
    },
    waterButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    waterButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    waterButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    habitCard: {
      marginBottom: 12,
    },
    habitContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    habitName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    habitStreak: {
      fontSize: 13,
    },
    habitActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
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
      minHeight: 220,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    input: {
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      marginBottom: 16,
    },
    calendarCard: {
      marginBottom: 24,
    },
    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    calendarTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    dayLabels: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    dayLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    calendarDay: {
      width: '13%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      position: 'relative',
      minHeight: 40,
    },
    calendarDayOtherMonth: {
      opacity: 0.3,
    },
    calendarDayText: {
      fontSize: 14,
      fontWeight: '500',
    },
    completionDot: {
      position: 'absolute',
      bottom: 4,
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    calendarLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(128, 128, 128, 0.2)',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
    },
  });
