import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SyncService } from '@/lib/sync';
import { CheckCircle2, Circle, X, Search, Filter, Calendar, ListTodo } from 'lucide-react-native';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { showError, showConfirmDestructive } from '@/lib/alert';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
}

type SortOption = 'priority' | 'due_date' | 'title' | 'created';
type FilterOption = 'all' | 'active' | 'completed' | 'overdue';

const PRIORITY_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export default function TasksScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Task>('tasks', user.id);
    setTasks(data);
  };

  const addTask = async () => {
    if (!title.trim() || !user) {
      showError('Error', 'Please enter a task title');
      return;
    }

    await SyncService.insertWithFallback('tasks', user.id, {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      is_completed: false,
    });
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setModalVisible(false);
    loadTasks();
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    if (!user) return;
    await SyncService.updateWithFallback('tasks', user.id, taskId, {
      is_completed: !completed,
      completed_at: !completed ? new Date().toISOString() : null,
    });
    loadTasks();
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Task', 'Are you sure you want to delete this task?', async () => {
      await SyncService.deleteWithFallback('tasks', user.id, taskId);
      loadTasks();
    });
  };

  // Filter and sort tasks
  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          (task.description && task.description.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    switch (filterOption) {
      case 'active':
        filtered = filtered.filter((t) => !t.is_completed);
        break;
      case 'completed':
        filtered = filtered.filter((t) => t.is_completed);
        break;
      case 'overdue':
        filtered = filtered.filter(
          (t) => !t.is_completed && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
        );
        break;
      default:
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
            (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        case 'due_date':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredTasks = getFilteredAndSortedTasks();
  const activeTasks = filteredTasks.filter((t) => !t.is_completed);
  const completedTasks = filteredTasks.filter((t) => t.is_completed);

  // Statistics
  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.is_completed).length;
  const overdueCount = tasks.filter(
    (t) => !t.is_completed && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const styles = createStyles(colors);

  const renderTaskCard = (task: Task) => {
    let isOverdue = false;
    let isDueToday = false;
    let formattedDate = '';

    if (task.due_date && !task.is_completed) {
      try {
        const dueDate = parseISO(task.due_date);
        isOverdue = isPast(dueDate) && !isToday(dueDate);
        isDueToday = isToday(dueDate);
        formattedDate = format(dueDate, 'MMM dd');
      } catch {
        // Invalid date format, skip date display
        console.warn('Invalid date format for task:', task.id, task.due_date);
      }
    }

    return (
      <TouchableOpacity key={task.id} onPress={() => toggleTask(task.id, task.is_completed)}>
        <Card style={[styles.taskCard, isOverdue && styles.overdueCard] as any}>
          <View style={styles.taskContent}>
            {task.is_completed ? (
              <CheckCircle2 size={24} color={colors.success} />
            ) : (
              <Circle size={24} color={colors.border} />
            )}
            <View style={styles.taskDetails}>
              <View style={styles.taskHeader}>
                <Text
                  style={[
                    styles.taskTitle,
                    task.is_completed && styles.completedTask,
                    { color: task.is_completed ? colors.textSecondary : colors.text },
                  ]}
                >
                  {task.title}
                </Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteTask(task.id);
                  }}
                  style={styles.deleteButton}
                >
                  <X size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
              {task.description && (
                <Text style={[styles.taskDescription, { color: colors.textSecondary }]}>
                  {task.description}
                </Text>
              )}
              <View style={styles.taskFooter}>
                <View style={styles.badgeContainer}>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium },
                    ]}
                  >
                    <Text style={styles.priorityText}>
                      {PRIORITY_LABELS[task.priority] || 'Medium'}
                    </Text>
                  </View>
                  {task.due_date && formattedDate && (
                    <View style={[styles.dueDateBadge, isOverdue && { backgroundColor: colors.error }] as any}>
                      <Calendar size={12} color={isOverdue ? '#fff' : colors.textSecondary} />
                      <Text
                        style={[
                          styles.dueDateText,
                          { color: isOverdue ? '#fff' : colors.textSecondary },
                        ]}
                      >
                        {isDueToday ? 'Today' : isOverdue ? 'Overdue' : formattedDate}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Tasks"
        subtitle={`${activeTasks.length} active tasks${overdueCount > 0 ? ` • ${overdueCount} overdue` : ''}`}
        onAddPress={() => setModalVisible(true)}
      />

      <ScrollView style={styles.content}>
        {/* Statistics */}
        {totalTasks > 0 && (
          <View style={styles.statsContainer}>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{totalTasks}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.success }]}>{completedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{completionRate}%</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Done</Text>
            </Card>
            <Card style={[styles.statCard, overdueCount > 0 && styles.overdueStatCard] as any}>
              <Text style={[styles.statValue, { color: overdueCount > 0 ? colors.error : colors.textSecondary }]}>
                {overdueCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Overdue</Text>
            </Card>
          </View>
        )}

        {/* Search and Filter */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search tasks..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.surface }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Filter Options */}
        {showFilters && (
          <Card style={styles.filterCard}>
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Filter:</Text>
              <View style={styles.filterOptions}>
                {(['all', 'active', 'completed', 'overdue'] as FilterOption[]).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.filterOption,
                      filterOption === option && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setFilterOption(option)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        { color: filterOption === option ? '#fff' : colors.text },
                      ]}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Sort:</Text>
              <View style={styles.filterOptions}>
                {(['priority', 'due_date', 'title'] as SortOption[]).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.filterOption,
                      sortOption === option && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setSortOption(option)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        { color: sortOption === option ? '#fff' : colors.text },
                      ]}
                    >
                      {option === 'due_date' ? 'Due Date' : option === 'priority' ? 'Priority' : 'Title'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>
        )}

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <ListTodo size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery.trim() || filterOption !== 'all'
                ? 'No tasks match your filters.'
                : 'No tasks yet. Add your first task!'}
            </Text>
          </Card>
        ) : (
          <>
            {activeTasks.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Active</Text>
                {activeTasks.map(renderTaskCard)}
              </>
            )}

            {completedTasks.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>
                  Completed
                </Text>
                {completedTasks.map(renderTaskCard)}
              </>
            )}
          </>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Task</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                placeholder="Task title *"
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

              {/* Priority Selector */}
              <View style={styles.priorityContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Priority</Text>
                <View style={styles.priorityOptions}>
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityOption,
                        priority === p && {
                          backgroundColor: PRIORITY_COLORS[p],
                          borderColor: PRIORITY_COLORS[p],
                        },
                        { borderColor: colors.border },
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <Text
                        style={[
                          styles.priorityOptionText,
                          { color: priority === p ? '#fff' : colors.text },
                        ]}
                      >
                        {PRIORITY_LABELS[p]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Due Date Selector */}
              <View style={styles.dateContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Due Date (optional)</Text>
                <View style={[styles.dateInputContainer, { backgroundColor: colors.surface }]}>
                  <Calendar size={20} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.dateInput, { color: colors.text }]}
                    placeholder="YYYY-MM-DD or leave empty"
                    placeholderTextColor={colors.textSecondary}
                    value={dueDate}
                    onChangeText={setDueDate}
                  />
                  {dueDate.length > 0 && (
                    <TouchableOpacity onPress={() => setDueDate('')}>
                      <X size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                {dueDate && (
                  <Text style={[styles.dateHint, { color: colors.textSecondary }]}>
                    Format: YYYY-MM-DD (e.g., 2024-12-31)
                  </Text>
                )}
              </View>

              <Button title="Add Task" onPress={addTask} />
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
    // Statistics
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      padding: 16,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    overdueStatCard: {
      borderWidth: 2,
      borderColor: colors.error,
    },
    // Search and Filter
    searchContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
    },
    filterButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    filterCard: {
      marginBottom: 16,
      padding: 16,
    },
    filterRow: {
      marginBottom: 12,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    filterOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    filterOptionText: {
      fontSize: 14,
      fontWeight: '500',
    },
    // Task Cards
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 12,
      marginTop: 8,
    },
    taskCard: {
      marginBottom: 12,
    },
    overdueCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.error,
    },
    taskContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    taskDetails: {
      flex: 1,
    },
    taskHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    taskTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      marginRight: 8,
    },
    completedTask: {
      textDecorationLine: 'line-through',
    },
    taskDescription: {
      fontSize: 14,
      marginBottom: 8,
      lineHeight: 20,
    },
    taskFooter: {
      marginTop: 4,
    },
    badgeContainer: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    priorityBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    priorityText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#fff',
    },
    dueDateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    dueDateText: {
      fontSize: 11,
      fontWeight: '500',
    },
    deleteButton: {
      padding: 4,
    },
    // Empty State
    emptyCard: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      marginTop: 16,
      fontSize: 16,
      textAlign: 'center',
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: '90%',
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
      minHeight: 80,
      textAlignVertical: 'top',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    priorityContainer: {
      marginBottom: 20,
    },
    priorityOptions: {
      flexDirection: 'row',
      gap: 12,
    },
    priorityOption: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
    },
    priorityOptionText: {
      fontSize: 14,
      fontWeight: '600',
    },
    dateContainer: {
      marginBottom: 20,
    },
    dateInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 12,
    },
    dateInput: {
      flex: 1,
      fontSize: 16,
    },
    dateHint: {
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
    },
  });
