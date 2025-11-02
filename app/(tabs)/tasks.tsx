import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SyncService } from '@/lib/sync';
import { CheckCircle2, Circle, X, Search, Filter, Calendar, ListTodo, Edit2 } from 'lucide-react-native';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { showError, showConfirmDestructive, showSuccess } from '@/lib/alert';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  category_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
}

interface TaskCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
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

// Category color palette for custom categories
const CATEGORY_COLOR_PALETTE = [
  '#6A5ACD',
  '#10B981',
  '#8B5CF6',
  '#EF4444',
  '#F59E0B',
  '#6B7280',
  '#14B8A6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
];

export default function TasksScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user) {
      loadCategories();
      loadTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCategories = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<TaskCategory>('task_categories', user.id);
    // Sort by name alphabetically
    setCategories(data.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const createCustomCategory = async () => {
    if (!customCategoryName.trim() || !user) {
      showError('Error', 'Please enter a category name');
      return;
    }

    // Check if category already exists
    const existing = categories.find((c) => c.name.toLowerCase() === customCategoryName.trim().toLowerCase());
    if (existing) {
      showError('Error', 'Category already exists');
      return;
    }

    // Generate a random color for custom category
    const randomColor = CATEGORY_COLOR_PALETTE[Math.floor(Math.random() * CATEGORY_COLOR_PALETTE.length)];

    const newCategory = await SyncService.insertWithFallback<TaskCategory>('task_categories', user.id, {
      name: customCategoryName.trim(),
      color: randomColor,
      icon: 'folder',
    });

    if (newCategory) {
      setCustomCategoryName('');
      setShowCustomCategoryInput(false);
      await loadCategories();
      setSelectedCategory(newCategory.id);
      showSuccess('Success', 'Category created!');
    }
  };

  const loadTasks = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Task>('tasks', user.id);
    setTasks(data);
  };

  const openEditModal = (task: Task) => {
    setEditTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueDate(task.due_date ? format(parseISO(task.due_date), 'yyyy-MM-dd') : '');
    setSelectedCategory(task.category_id);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditTaskId(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setSelectedCategory(null);
  };

  const saveTask = async () => {
    if (!title.trim() || !user) {
      showError('Error', 'Please enter a task title');
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      category_id: selectedCategory,
    };

    if (editTaskId) {
      // Update existing task
      await SyncService.updateWithFallback('tasks', user.id, editTaskId, taskData);
    } else {
      // Create new task
      await SyncService.insertWithFallback('tasks', user.id, {
        ...taskData,
        is_completed: false,
      });
    }

    closeModal();
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

    // Apply category filter
    if (categoryFilter) {
      filtered = filtered.filter((t) => t.category_id === categoryFilter);
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

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return '';
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : '';
  };

  const getCategoryColor = (categoryId: string | null | undefined): string => {
    if (!categoryId) return colors.textSecondary;
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.color : colors.textSecondary;
  };

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

    const categoryName = getCategoryName(task.category_id);
    const categoryColor = getCategoryColor(task.category_id);

    return (
      <Card key={task.id} style={[styles.taskCard, isOverdue && styles.overdueCard] as any}>
        <View style={styles.taskContent}>
          <TouchableOpacity onPress={() => toggleTask(task.id, task.is_completed)}>
            {task.is_completed ? (
              <CheckCircle2 size={24} color={colors.success} />
            ) : (
              <Circle size={24} color={colors.border} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.taskDetails}
            onPress={() => toggleTask(task.id, task.is_completed)}
            activeOpacity={0.7}
          >
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
                {categoryName && (
                  <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20', borderColor: categoryColor }]}>
                    <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                      {categoryName}
                    </Text>
                  </View>
                )}
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
          </TouchableOpacity>
          <View style={styles.taskActions}>
            <TouchableOpacity
              onPress={() => openEditModal(task)}
              style={styles.editButton}
            >
              <Edit2 size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteTask(task.id)}
              style={styles.deleteButton}
            >
              <X size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Tasks"
        subtitle={`${activeTasks.length} active tasks${overdueCount > 0 ? ` • ${overdueCount} overdue` : ''}`}
        onAddPress={() => {
          setEditTaskId(null);
          setTitle('');
          setDescription('');
          setPriority('medium');
          setDueDate('');
          setSelectedCategory(null);
          setModalVisible(true);
        }}
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
              <Text style={[styles.filterLabel, { color: colors.text }]}>Category:</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    !categoryFilter && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setCategoryFilter(null)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      { color: !categoryFilter ? '#fff' : colors.text },
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.filterOption,
                      categoryFilter === category.id && { backgroundColor: category.color },
                    ]}
                    onPress={() => setCategoryFilter(categoryFilter === category.id ? null : category.id)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        { color: categoryFilter === category.id ? '#fff' : colors.text },
                      ]}
                    >
                      {category.name}
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editTaskId ? 'Edit Task' : 'New Task'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
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

              {/* Category Selector */}
              <View style={styles.categoryContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Category (optional)</Text>
                <View style={styles.categoryOptions}>
                  <TouchableOpacity
                    style={[
                      styles.categoryOption,
                      !selectedCategory && { backgroundColor: colors.primary },
                      { borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedCategory(null)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        { color: !selectedCategory ? '#fff' : colors.text },
                      ]}
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        selectedCategory === category.id && { backgroundColor: category.color },
                        { borderColor: colors.border },
                      ]}
                      onPress={() => {
                        setSelectedCategory(selectedCategory === category.id ? null : category.id);
                        setShowCustomCategoryInput(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          { color: selectedCategory === category.id ? '#fff' : colors.text },
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  
                  {/* Add Custom Category Button */}
                  <TouchableOpacity
                    style={[
                      styles.categoryOption,
                      {
                        backgroundColor: showCustomCategoryInput ? colors.primary : colors.surface,
                        borderColor: showCustomCategoryInput ? colors.primary : colors.border,
                        borderStyle: 'dashed',
                      },
                    ]}
                    onPress={() => {
                      setShowCustomCategoryInput(!showCustomCategoryInput);
                      if (!showCustomCategoryInput) {
                        setSelectedCategory(null);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        { color: showCustomCategoryInput ? '#fff' : colors.text },
                      ]}
                    >
                      {showCustomCategoryInput ? 'Cancel' : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* Custom Category Input */}
                {showCustomCategoryInput && (
                  <View style={styles.customCategoryContainer}>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                      placeholder="Category name"
                      placeholderTextColor={colors.textSecondary}
                      value={customCategoryName}
                      onChangeText={setCustomCategoryName}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[styles.createCategoryButton, { backgroundColor: colors.primary }]}
                      onPress={createCustomCategory}
                    >
                      <Text style={[styles.createCategoryButtonText, { color: '#FFFFFF' }]}>
                        Create Category
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

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

              <Button title={editTaskId ? 'Update Task' : 'Add Task'} onPress={saveTask} />
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
    categoryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    taskActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    editButton: {
      padding: 4,
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
    categoryContainer: {
      marginBottom: 20,
    },
    categoryOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryOption: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 2,
      minWidth: 80,
    },
    categoryOptionText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    customCategoryContainer: {
      marginTop: 12,
      marginBottom: 16,
    },
    createCategoryButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
    },
    createCategoryButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
