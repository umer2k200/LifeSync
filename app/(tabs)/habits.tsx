import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SyncService } from '@/lib/sync';
import { CheckCircle2, Circle, Droplet, X, ChevronLeft, ChevronRight, Edit2, Trash2, Settings, Bell } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { showError, showConfirmDestructive, showSuccess } from '@/lib/alert';
import { NotificationScheduler } from '@/lib/notificationScheduler';

interface Habit {
  id: string;
  name: string;
  current_streak: number;
  best_streak: number;
}

interface WaterReminderSettings {
  id?: string;
  enabled: boolean;
  interval_hours: number;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
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
  
  // Water reminder settings state
  const [waterReminderModalVisible, setWaterReminderModalVisible] = useState(false);
  const [waterReminderSettings, setWaterReminderSettings] = useState<WaterReminderSettings>({
    enabled: false,
    interval_hours: 2,
    start_hour: 8,
    start_minute: 0,
    end_hour: 22,
    end_minute: 0,
  });

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
      const [habitsData, logsData, allLogsData, waterData, reminderSettings] = await Promise.all([
      SyncService.fetchWithFallback<Habit>('habits', user.id),
      SyncService.fetchWithFallback('habit_logs', user.id, (q: any) =>
        q.eq('completed_at', format(new Date(), 'yyyy-MM-dd'))
      ),
      SyncService.fetchWithFallback('habit_logs', user.id), // Load all logs for calendar
      SyncService.fetchWithFallback('water_logs', user.id, (q: any) =>
        q.eq('date', format(new Date(), 'yyyy-MM-dd'))
      ),
      SyncService.fetchWithFallback<WaterReminderSettings>('water_reminder_settings', user.id),
    ]);
    setHabits(habitsData);
    setHabitLogs(logsData);
    setAllHabitLogs(allLogsData);
    const totalWater = waterData.reduce((sum: number, log: any) => sum + log.amount_ml, 0);
    setWaterIntake(totalWater);
    
    // Load water reminder settings
    if (reminderSettings && reminderSettings.length > 0) {
      setWaterReminderSettings(reminderSettings[0]);
    }
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

  const saveWaterReminderSettings = async () => {
    if (!user) return;
    
    // Validate settings
    if (waterReminderSettings.interval_hours < 1 || waterReminderSettings.interval_hours > 12) {
      showError('Error', 'Interval must be between 1 and 12 hours');
      return;
    }
    
    if (waterReminderSettings.start_hour < 0 || waterReminderSettings.start_hour > 23 ||
        waterReminderSettings.end_hour < 0 || waterReminderSettings.end_hour > 23) {
      showError('Error', 'Hours must be between 0 and 23');
      return;
    }
    
    if (waterReminderSettings.start_minute < 0 || waterReminderSettings.start_minute > 59 ||
        waterReminderSettings.end_minute < 0 || waterReminderSettings.end_minute > 59) {
      showError('Error', 'Minutes must be between 0 and 59');
      return;
    }
    
    const startTime = waterReminderSettings.start_hour * 60 + waterReminderSettings.start_minute;
    const endTime = waterReminderSettings.end_hour * 60 + waterReminderSettings.end_minute;
    
    if (endTime <= startTime) {
      showError('Error', 'End time must be after start time');
      return;
    }

    try {
      if (waterReminderSettings.id) {
        // Update existing settings
        await SyncService.updateWithFallback('water_reminder_settings', user.id, waterReminderSettings.id, {
          ...waterReminderSettings,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Create new settings
        const result = await SyncService.insertWithFallback('water_reminder_settings', user.id, {
          ...waterReminderSettings,
          updated_at: new Date().toISOString(),
        });
        if (result && result.id) {
          setWaterReminderSettings({ ...waterReminderSettings, id: result.id });
        }
      }
      
      // Reschedule notifications
      await NotificationScheduler.scheduleAllNotifications(user.id);
      
      setWaterReminderModalVisible(false);
      showSuccess('Success', 'Water reminder settings saved!');
    } catch (error) {
      console.error('Error saving water reminder settings:', error);
      showError('Error', 'Failed to save settings. Please try again.');
    }
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
            <TouchableOpacity
              style={styles.waterSettingsButton}
              onPress={() => setWaterReminderModalVisible(true)}
            >
              <Bell size={20} color={waterReminderSettings.enabled ? colors.primary : colors.textSecondary} />
            </TouchableOpacity>
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
          {waterReminderSettings.enabled && (
            <Text style={[styles.reminderStatus, { color: colors.textSecondary }]}>
              Reminders: Every {waterReminderSettings.interval_hours} hour(s) from{' '}
              {String(waterReminderSettings.start_hour).padStart(2, '0')}:
              {String(waterReminderSettings.start_minute).padStart(2, '0')} to{' '}
              {String(waterReminderSettings.end_hour).padStart(2, '0')}:
              {String(waterReminderSettings.end_minute).padStart(2, '0')}
            </Text>
          )}
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

      {/* Water Reminder Settings Modal */}
      <Modal visible={waterReminderModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Water Reminder Settings</Text>
              <TouchableOpacity onPress={() => setWaterReminderModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: colors.text }]}>Enable Reminders</Text>
                <Switch
                  value={waterReminderSettings.enabled}
                  onValueChange={(value) =>
                    setWaterReminderSettings({ ...waterReminderSettings, enabled: value })
                  }
                  trackColor={{ false: colors.surface, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {waterReminderSettings.enabled && (
                <>
                  <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>
                    Interval (hours)
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                    placeholder="2"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={String(waterReminderSettings.interval_hours)}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 2;
                      setWaterReminderSettings({
                        ...waterReminderSettings,
                        interval_hours: Math.max(1, Math.min(12, value)),
                      });
                    }}
                  />

                  <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>
                    Start Time
                  </Text>
                  <View style={styles.timeRow}>
                    <TextInput
                      style={[
                        styles.timeInput,
                        { backgroundColor: colors.surface, color: colors.text },
                      ]}
                      placeholder="08"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      maxLength={2}
                      value={String(waterReminderSettings.start_hour).padStart(2, '0')}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        setWaterReminderSettings({
                          ...waterReminderSettings,
                          start_hour: Math.max(0, Math.min(23, value)),
                        });
                      }}
                    />
                    <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>
                    <TextInput
                      style={[
                        styles.timeInput,
                        { backgroundColor: colors.surface, color: colors.text },
                      ]}
                      placeholder="00"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      maxLength={2}
                      value={String(waterReminderSettings.start_minute).padStart(2, '0')}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        setWaterReminderSettings({
                          ...waterReminderSettings,
                          start_minute: Math.max(0, Math.min(59, value)),
                        });
                      }}
                    />
                  </View>

                  <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>End Time</Text>
                  <View style={styles.timeRow}>
                    <TextInput
                      style={[
                        styles.timeInput,
                        { backgroundColor: colors.surface, color: colors.text },
                      ]}
                      placeholder="22"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      maxLength={2}
                      value={String(waterReminderSettings.end_hour).padStart(2, '0')}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        setWaterReminderSettings({
                          ...waterReminderSettings,
                          end_hour: Math.max(0, Math.min(23, value)),
                        });
                      }}
                    />
                    <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>
                    <TextInput
                      style={[
                        styles.timeInput,
                        { backgroundColor: colors.surface, color: colors.text },
                      ]}
                      placeholder="00"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      maxLength={2}
                      value={String(waterReminderSettings.end_minute).padStart(2, '0')}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        setWaterReminderSettings({
                          ...waterReminderSettings,
                          end_minute: Math.max(0, Math.min(59, value)),
                        });
                      }}
                    />
                  </View>
                </>
              )}

              <Button
                title="Save Settings"
                onPress={saveWaterReminderSettings}
                style={{ marginTop: 24 }}
              />
            </ScrollView>
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
    waterSettingsButton: {
      marginLeft: 'auto',
      padding: 8,
    },
    reminderStatus: {
      fontSize: 12,
      marginTop: 8,
      textAlign: 'center',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timeInput: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      fontSize: 16,
      textAlign: 'center',
    },
    timeSeparator: {
      fontSize: 20,
      fontWeight: 'bold',
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
