import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DrawerActions, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Target,
  CheckCircle2,
  Dumbbell,
  DollarSign,
  TrendingUp,
  WifiOff,
  Settings,
  Flame,
  AlertCircle,
  Clock,
  Circle,
  Menu,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SyncService } from '@/lib/sync';
import { format, isPast, parseISO, isToday, subDays, differenceInDays } from 'date-fns';

interface QuickStat {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  route?: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  is_completed: boolean;
  priority: string;
}

interface Habit {
  id: string;
  name: string;
  current_streak: number;
}

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [habitsNotDone, setHabitsNotDone] = useState<Habit[]>([]);
  const [habitStreak, setHabitStreak] = useState(0);
  const [prayerStreak, setPrayerStreak] = useState(0);
  const [completedHabits, setCompletedHabits] = useState(0);
  const [totalHabits, setTotalHabits] = useState(0);
  const [prayersCompleted, setPrayersCompleted] = useState(0);

  useEffect(() => {
    setIsOnline(SyncService.getConnectionStatus());
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Reload stats when screen comes into focus (e.g., returning from other pages)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadStats();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const calculateHabitStreak = (habitLogs: any[]) => {
    if (habitLogs.length === 0) return 0;
    
    const logs = habitLogs
      .map((log: any) => log.completed_at)
      .filter((date: string) => date)
      .sort((a: string, b: string) => b.localeCompare(a));
    
    let streak = 0;
    let checkDate = new Date();
    
    // Start from today and work backwards
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      if (logs.includes(dateStr)) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else if (streak === 0 && differenceInDays(new Date(), checkDate) === 0) {
        // Today might not be logged yet, check yesterday
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
      
      // Prevent infinite loop
      if (differenceInDays(new Date(), checkDate) > 365) break;
    }
    
    return streak;
  };

  const calculatePrayerStreak = (prayerLogs: any[]) => {
    if (prayerLogs.length === 0) return 0;
    
    let streak = 0;
    let checkDate = new Date();
    
    // A day counts if all 5 prayers are completed
    const getPrayersForDate = (dateStr: string) => {
      return prayerLogs.filter((log: any) => log.completed_at === dateStr).length;
    };
    
    // Start from today and work backwards
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const prayersCount = getPrayersForDate(dateStr);
      if (prayersCount >= 5) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else if (streak === 0 && differenceInDays(new Date(), checkDate) === 0) {
        // Today might not be complete yet, check yesterday
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
      
      // Prevent infinite loop
      if (differenceInDays(new Date(), checkDate) > 365) break;
    }
    
    return streak;
  };

  const loadStats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [
        goalsData,
        habitsData,
        tasksData,
        expensesData,
        habitLogsData,
        allHabitLogsData,
        prayerLogsData,
        allPrayerLogsData,
      ] = await Promise.all([
        SyncService.fetchWithFallback('goals', user.id),
        SyncService.fetchWithFallback('habits', user.id),
        SyncService.fetchWithFallback('tasks', user.id),
        SyncService.fetchWithFallback('expenses', user.id, (q: any) =>
          q.gte('expense_date', format(new Date(), 'yyyy-MM-01'))
        ),
        SyncService.fetchWithFallback('habit_logs', user.id, (q: any) =>
          q.eq('completed_at', today)
        ),
        SyncService.fetchWithFallback('habit_logs', user.id),
        SyncService.fetchWithFallback('prayer_logs', user.id, (q: any) =>
          q.eq('completed_at', today)
        ),
        SyncService.fetchWithFallback('prayer_logs', user.id),
      ]);

      // Fix stats calculation
      const activeGoals = goalsData.filter((g: any) => !g.is_completed).length;
      const todayTasksCount = tasksData.filter((t: any) => {
        if (!t.due_date) return false;
        return isToday(parseISO(t.due_date));
      }).length;
      const monthlyExpenses = expensesData.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

      // Overdue tasks
      const overdue = (tasksData as Task[]).filter((t: Task) => {
        if (t.is_completed || !t.due_date) return false;
        return isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
      });
      setOverdueTasks(overdue.slice(0, 5)); // Show top 5

      // Habits not done today
      const completedHabitIds = habitLogsData.map((log: any) => log.habit_id);
      const notDone = (habitsData as Habit[]).filter((h: Habit) => !completedHabitIds.includes(h.id));
      setHabitsNotDone(notDone.slice(0, 5)); // Show top 5
      setCompletedHabits(completedHabitIds.length);
      setTotalHabits(habitsData.length);

      // Calculate streaks
      const habitStreak = calculateHabitStreak(allHabitLogsData);
      setHabitStreak(habitStreak);
      
      const prayerStreak = calculatePrayerStreak(allPrayerLogsData);
      setPrayerStreak(prayerStreak);

      // Prayers completed today
      setPrayersCompleted(prayerLogsData.length);

      setStats([
        {
          icon: Target,
          label: 'Active Goals',
          value: activeGoals,
          color: colors.primary,
          route: '/(tabs)/goals',
        },
        {
          icon: CheckCircle2,
          label: 'Tasks Today',
          value: todayTasksCount,
          color: colors.secondary,
          route: '/(tabs)/tasks',
        },
        {
          icon: Dumbbell,
          label: 'Habits',
          value: `${completedHabitIds.length}/${habitsData.length}`,
          color: colors.accent,
          route: '/(tabs)/habits',
        },
        {
          icon: DollarSign,
          label: 'This Month',
          value: `Rs. ${monthlyExpenses.toFixed(0)}`,
          color: colors.error,
          route: '/(tabs)/expenses',
        },
      ]);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isOnline) {
      await SyncService.syncAllData();
    }
    await loadStats();
    setRefreshing(false);
  };

  const styles = createStyles(colors);

  const greeting = getTimeBasedGreeting();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.surface, colors.background] : [colors.primary, colors.gradient2]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={{ marginRight: 16 }}
          >
            <Menu size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={[styles.name, (authLoading || !profile) && { opacity: 0.7 }]}>
              {authLoading || !profile ? 'Loading...' : `${profile.full_name || 'User'}!`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {!isOnline && (
              <View style={[styles.syncBadge, { backgroundColor: colors.error }]}>
                <WifiOff size={16} color="#FFF" />
              </View>
            )}
            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => router.push('/settings' as any)}
            >
              <Settings size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <LoadingSpinner message="Loading your data..." />
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Overview</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <TouchableOpacity
              key={index}
              style={styles.statCard}
              onPress={() => stat.route && router.push(stat.route as any)}
            >
              <Card style={styles.statCardInner}>
                <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                  <stat.icon size={24} color={stat.color} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Streaks Section */}
        <View style={styles.streaksContainer}>
          <Card style={styles.streakCard}>
            <View style={[styles.streakIcon, { backgroundColor: `${colors.accent}15` }]}>
              <Flame size={24} color={colors.accent} />
            </View>
            <Text style={[styles.streakValue, { color: colors.text }]}>{habitStreak}</Text>
            <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Habit Streak</Text>
            <Text style={[styles.streakSubtext, { color: colors.textSecondary }]}>days</Text>
          </Card>
          <Card style={styles.streakCard}>
            <View style={[styles.streakIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Clock size={24} color={colors.primary} />
            </View>
            <Text style={[styles.streakValue, { color: colors.text }]}>{prayerStreak}</Text>
            <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Prayer Streak</Text>
            <Text style={[styles.streakSubtext, { color: colors.textSecondary }]}>days</Text>
          </Card>
        </View>

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertCircle size={20} color={colors.error} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Overdue Tasks ({overdueTasks.length})
              </Text>
            </View>
            <Card style={styles.tasksCard}>
              {overdueTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskItem}
                  onPress={() => router.push('/(tabs)/tasks' as any)}
                >
                  <View style={styles.taskItemLeft}>
                    <View
                      style={[
                        styles.priorityDot,
                        {
                          backgroundColor:
                            task.priority === 'high'
                              ? colors.error
                              : task.priority === 'medium'
                              ? colors.accent
                              : colors.success,
                        },
                      ]}
                    />
                    <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                  </View>
                  {task.due_date && (
                    <Text style={[styles.taskDueDate, { color: colors.textSecondary }]}>
                      {format(parseISO(task.due_date), 'MMM d')}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
              {overdueTasks.length >= 5 && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => router.push('/(tabs)/tasks' as any)}
                >
                  <Text style={[styles.viewAllText, { color: colors.primary }]}>View All Tasks</Text>
                </TouchableOpacity>
              )}
            </Card>
          </View>
        )}

        {/* Habits Not Done Today */}
        {habitsNotDone.length > 0 && totalHabits > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <CheckCircle2 size={20} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Habits Not Done Today ({habitsNotDone.length})
              </Text>
            </View>
            <Card style={styles.habitsCard}>
              <View style={styles.habitsProgress}>
                <View style={styles.habitsProgressBar}>
                  <View
                    style={[
                      styles.habitsProgressFill,
                      {
                        width: `${(completedHabits / totalHabits) * 100}%`,
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.habitsProgressText, { color: colors.textSecondary }]}>
                  {completedHabits}/{totalHabits} completed
                </Text>
              </View>
              {habitsNotDone.map((habit) => (
                <TouchableOpacity
                  key={habit.id}
                  style={styles.habitItem}
                  onPress={() => router.push('/(tabs)/habits' as any)}
                >
                  <Circle size={20} color={colors.border} />
                  <Text style={[styles.habitName, { color: colors.text }]}>{habit.name}</Text>
                </TouchableOpacity>
              ))}
              {habitsNotDone.length >= 5 && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => router.push('/(tabs)/habits' as any)}
                >
                  <Text style={[styles.viewAllText, { color: colors.primary }]}>View All Habits</Text>
                </TouchableOpacity>
              )}
            </Card>
          </View>
        )}

        {/* Progress Section */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <TrendingUp size={24} color={colors.success} />
            <Text style={[styles.progressTitle, { color: colors.text }]}>Today&apos;s Progress</Text>
          </View>
          <View style={styles.progressStats}>
            <View style={styles.progressStatItem}>
              <Text style={[styles.progressStatValue, { color: colors.primary }]}>{prayersCompleted}/5</Text>
              <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>Prayers</Text>
            </View>
            <View style={styles.progressStatItem}>
              <Text style={[styles.progressStatValue, { color: colors.accent }]}>
                {completedHabits}/{totalHabits}
              </Text>
              <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>Habits</Text>
            </View>
            <View style={styles.progressStatItem}>
              <Text style={[styles.progressStatValue, { color: colors.secondary }]}>
                {overdueTasks.length}
              </Text>
              <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>Overdue</Text>
            </View>
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/goals')}>
            <LinearGradient
              colors={[colors.primary, colors.gradient2]}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Target size={32} color="#FFFFFF" />
              <Text style={styles.actionText}>Set Goal</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/workout')}>
            <LinearGradient
              colors={[colors.secondary, '#059669']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Dumbbell size={32} color="#FFFFFF" />
              <Text style={styles.actionText}>Log Workout</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/tasks')}>
            <LinearGradient
              colors={[colors.accent, '#D97706']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <CheckCircle2 size={32} color="#FFFFFF" />
              <Text style={styles.actionText}>Add Task</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/expenses')}>
            <LinearGradient
              colors={[colors.error, '#DC2626']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <DollarSign size={32} color="#FFFFFF" />
              <Text style={styles.actionText}>Track Expense</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
          </>
        )}
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
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 24,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 0,
    },
    greeting: {
      fontSize: 16,
      color: '#FFFFFF',
      opacity: 0.9,
    },
    name: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#FFFFFF',
      marginTop: 4,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    syncBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
      marginTop: 0,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    statCard: {
      width: '48%',
    },
    statCardInner: {
      alignItems: 'center',
      padding: 20,
    },
    statIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      textAlign: 'center',
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    actionButton: {
      width: '48%',
      height: 120,
      borderRadius: 16,
      overflow: 'hidden',
    },
    actionGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    streaksContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    streakCard: {
      flex: 1,
      alignItems: 'center',
      padding: 20,
    },
    streakIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    streakValue: {
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    streakLabel: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    streakSubtext: {
      fontSize: 10,
      marginTop: 2,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    tasksCard: {
      marginBottom: 0,
    },
    taskItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    taskItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    taskTitle: {
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    taskDueDate: {
      fontSize: 12,
    },
    habitsCard: {
      marginBottom: 0,
    },
    habitsProgress: {
      marginBottom: 16,
    },
    habitsProgressBar: {
      height: 8,
      backgroundColor: 'rgba(0,0,0,0.05)',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    habitsProgressFill: {
      height: '100%',
      borderRadius: 4,
    },
    habitsProgressText: {
      fontSize: 12,
      textAlign: 'center',
    },
    habitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    habitName: {
      fontSize: 14,
      fontWeight: '500',
    },
    viewAllButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    viewAllText: {
      fontSize: 14,
      fontWeight: '600',
    },
    progressCard: {
      marginBottom: 16,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    progressTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    progressStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    progressStatItem: {
      alignItems: 'center',
    },
    progressStatValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    progressStatLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
  });
