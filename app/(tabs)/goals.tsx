import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SyncService } from '@/lib/sync';
import { Target, TrendingUp, CheckCircle2, X, Edit2 } from 'lucide-react-native';
import { showError, showConfirmDestructive } from '@/lib/alert';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  deadline: string | null;
  progress: number;
  is_completed: boolean;
}

const CATEGORIES = ['Personal', 'Fitness', 'Career', 'Spiritual', 'Financial'];
const CATEGORY_COLORS: Record<string, string> = {
  Personal: '#6A5ACD',
  Fitness: '#10B981',
  Career: '#8B5CF6',
  Spiritual: '#14B8A6',
  Financial: '#F59E0B',
};

export default function GoalsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadGoals();
    }
  }, [user]);

  // Reload goals when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user && !initialLoading) {
        loadGoals();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadGoals = async () => {
    if (!user) return;
    setInitialLoading(true);
    try {
      const data = await SyncService.fetchWithFallback<Goal>('goals', user.id);
      setGoals(data);
    } finally {
      setInitialLoading(false);
    }
  };

  const openEditModal = (goal: Goal) => {
    setEditGoalId(goal.id);
    setTitle(goal.title);
    setDescription(goal.description || '');
    setCategory(goal.category);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditGoalId(null);
    setTitle('');
    setDescription('');
    setCategory('Personal');
  };

  const saveGoal = async () => {
    if (!title.trim() || !user) {
      showError('Error', 'Please enter a goal title');
      return;
    }

    setLoading(true);
    const goalData = {
      title: title.trim(),
      description: description.trim() || null,
      category,
    };

    if (editGoalId) {
      // Update existing goal (don't reset progress)
      await SyncService.updateWithFallback('goals', user.id, editGoalId, goalData);
    } else {
      // Create new goal
      await SyncService.insertWithFallback('goals', user.id, {
        ...goalData,
        progress: 0,
        is_completed: false,
      });
    }

    setLoading(false);
    closeModal();
    loadGoals();
  };

  const updateProgress = async (goalId: string, newProgress: number) => {
    if (!user) return;
    await SyncService.updateWithFallback('goals', user.id, goalId, {
      progress: newProgress,
      is_completed: newProgress >= 100,
    });
    loadGoals();
  };

  const deleteGoal = async (goalId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Goal', 'Are you sure?', async () => {
      await SyncService.deleteWithFallback('goals', user.id, goalId);
      loadGoals();
    });
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Goals"
        subtitle={`${goals.filter((g) => !g.is_completed).length} active goals`}
        onAddPress={() => {
          setEditGoalId(null);
          setTitle('');
          setDescription('');
          setCategory('Personal');
          setModalVisible(true);
        }}
      />

      <ScrollView style={styles.content}>
        {initialLoading ? (
          <LoadingSpinner message="Loading goals..." />
        ) : goals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Target size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No goals yet. Start by adding your first goal!
            </Text>
          </Card>
        ) : (
          goals.map((goal) => (
            <Card key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.categoryBadge}>
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: CATEGORY_COLORS[goal.category] || colors.primary },
                      ]}
                    />
                    <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                      {goal.category}
                    </Text>
                  </View>
                  <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.title}</Text>
                  {goal.description && (
                    <Text style={[styles.goalDescription, { color: colors.textSecondary }]}>
                      {goal.description}
                    </Text>
                  )}
                </View>
                {goal.is_completed && <CheckCircle2 size={24} color={colors.success} />}
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${goal.progress}%`,
                        backgroundColor: goal.is_completed ? colors.success : colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                  {goal.progress}%
                </Text>
              </View>

              <View style={styles.goalActions}>
                <TouchableOpacity
                  style={[styles.progressButton, { backgroundColor: colors.surface }]}
                  onPress={() => updateProgress(goal.id, Math.min(goal.progress + 10, 100))}
                >
                  <TrendingUp size={16} color={colors.primary} />
                  <Text style={[styles.progressButtonText, { color: colors.primary }]}>
                    +10%
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => openEditModal(goal)}
                >
                  <Edit2 size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, { backgroundColor: `${colors.error}15` }]}
                  onPress={() => deleteGoal(goal.id)}
                >
                  <X size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editGoalId ? 'Edit Goal' : 'New Goal'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Goal title"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.surface, color: colors.text },
              ]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor:
                        category === cat ? `${CATEGORY_COLORS[cat]}20` : colors.surface,
                      borderColor: category === cat ? CATEGORY_COLORS[cat] : colors.border,
                    },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      {
                        color: category === cat ? CATEGORY_COLORS[cat] : colors.textSecondary,
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button title={editGoalId ? 'Update Goal' : 'Create Goal'} onPress={saveGoal} loading={loading} />
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
    emptyCard: {
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      marginTop: 16,
      fontSize: 16,
      textAlign: 'center',
    },
    goalCard: {
      marginBottom: 16,
    },
    goalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    categoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    categoryText: {
      fontSize: 12,
      fontWeight: '500',
    },
    goalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    goalDescription: {
      fontSize: 14,
      lineHeight: 20,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    progressBar: {
      flex: 1,
      height: 8,
      backgroundColor: colors.surface,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 14,
      fontWeight: '600',
      minWidth: 40,
      textAlign: 'right',
    },
    goalActions: {
      flexDirection: 'row',
      gap: 8,
    },
    progressButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    progressButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    actionButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    deleteButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
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
      minHeight: 400,
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
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 24,
    },
    categoryChip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1,
    },
    categoryChipText: {
      fontSize: 14,
      fontWeight: '500',
    },
  });
