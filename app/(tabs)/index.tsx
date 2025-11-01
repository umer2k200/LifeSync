import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Target,
  CheckCircle2,
  Dumbbell,
  DollarSign,
  BookOpen,
  TrendingUp,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { SyncService } from '@/lib/sync';
import { format } from 'date-fns';

interface QuickStat {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  route?: string;
}

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [quote] = useState('Your journey to self-improvement starts today.');

  useEffect(() => {
    setIsOnline(SyncService.getConnectionStatus());
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      const [goalsData, habitsData, tasksData, expensesData] = await Promise.all([
        SyncService.fetchWithFallback('goals', user.id),
        SyncService.fetchWithFallback('habits', user.id),
        SyncService.fetchWithFallback('tasks', user.id),
        SyncService.fetchWithFallback('expenses', user.id, (q: any) =>
          q.gte('expense_date', format(new Date(), 'yyyy-MM-01'))
        ),
      ]);

      const completedGoals = goalsData.filter((g: any) => g.is_completed).length;
      const activeTasks = tasksData.filter((t: any) => !t.is_completed).length;
      const monthlyExpenses = expensesData.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

      setStats([
        {
          icon: Target,
          label: 'Active Goals',
          value: `${completedGoals}/${goalsData.length}`,
          color: colors.primary,
          route: '/(tabs)/goals',
        },
        {
          icon: CheckCircle2,
          label: 'Tasks Today',
          value: activeTasks,
          color: colors.secondary,
          route: '/(tabs)/tasks',
        },
        {
          icon: Dumbbell,
          label: 'Habits',
          value: habitsData.length,
          color: colors.accent,
          route: '/(tabs)/habits',
        },
        {
          icon: DollarSign,
          label: 'This Month',
          value: `$${monthlyExpenses.toFixed(0)}`,
          color: colors.error,
          route: '/(tabs)/expenses',
        },
      ]);
    } catch (error) {
      console.error('Error loading stats:', error);
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.surface, colors.background] : [colors.primary, colors.gradient2]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{profile?.full_name || 'User'}!</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.syncBadge, { backgroundColor: isOnline ? colors.success : colors.error }]}>
              {isOnline ? <Wifi size={16} color="#FFF" /> : <WifiOff size={16} color="#FFF" />}
            </View>
            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => router.push('/settings' as any)}
            >
              <Settings size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        <Card style={styles.quoteCard}>
          <BookOpen size={20} color={colors.primary} />
          <Text style={[styles.quote, { color: colors.text }]}>{quote}</Text>
        </Card>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
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

          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/habits')}>
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

        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <TrendingUp size={24} color={colors.success} />
            <Text style={[styles.progressTitle, { color: colors.text }]}>Your Progress</Text>
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            Keep up the great work! You&apos;re making steady progress toward your goals.
          </Text>
        </Card>

        <View style={{ height: 40 }} />
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
      marginBottom: 20,
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
    quoteCard: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    quote: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      fontStyle: 'italic',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
      marginTop: 8,
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
    progressCard: {
      marginBottom: 16,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    progressTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    progressText: {
      fontSize: 14,
      lineHeight: 20,
    },
  });
