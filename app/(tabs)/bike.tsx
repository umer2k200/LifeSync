import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SyncService } from '@/lib/sync';
import { CheckCircle2, Circle, X, Search, Filter, Bike, Edit2, Calendar, ChevronDown, ChevronUp } from 'lucide-react-native';
import { showError, showConfirmDestructive, showSuccess } from '@/lib/alert';

// Authorized emails for bike feature
const AUTHORIZED_BIKE_EMAILS = [
  'umarzeeshan708@gmail.com',
  'umarzeeshan709@gmail.com',
];

interface BikeItem {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface BikeTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
}

type TabType = 'items' | 'tasks';
type SortOption = 'priority' | 'title' | 'created';
type FilterOption = 'all' | 'active' | 'completed';

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

export default function BikeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [items, setItems] = useState<BikeItem[]>([]);
  const [tasks, setTasks] = useState<BikeTask[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [isTask, setIsTask] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showActive, setShowActive] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [itemsData, tasksData] = await Promise.all([
        SyncService.fetchWithFallback<BikeItem>('bike_items', user.id),
        SyncService.fetchWithFallback<BikeTask>('bike_tasks', user.id),
      ]);
      setItems(itemsData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading bike data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is authorized to access this page
  useEffect(() => {
    if (user) {
      const isAuthorized = user.email && AUTHORIZED_BIKE_EMAILS.includes(user.email);
      if (!isAuthorized) {
        // Redirect to home if not authorized
        router.replace('/(tabs)');
        return;
      }
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        const isAuthorized = user.email && AUTHORIZED_BIKE_EMAILS.includes(user.email);
        if (isAuthorized) {
          loadData();
        } else {
          router.replace('/(tabs)');
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router])
  );

  const openEditModal = (item?: BikeItem | BikeTask, task?: boolean) => {
    if (item) {
      setEditItemId(item.id);
      setTitle(item.title);
      setDescription(item.description || '');
      setIsTask(task || false);
      if (task) {
        setPriority(item.priority);
        if ('due_date' in item) {
          setDueDate(item.due_date ? new Date(item.due_date).toISOString().split('T')[0] : '');
        } else {
          setDueDate('');
        }
      } else {
        setPriority('medium');
        setDueDate('');
      }
    } else {
      setEditItemId(null);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setIsTask(task || false);
      setDueDate('');
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditItemId(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setIsTask(false);
  };

  const saveItem = async () => {
    if (!title.trim() || !user) {
      showError('Error', 'Please enter a title');
      return;
    }

    const itemData: any = {
      title: title.trim(),
      description: description.trim() || null,
    };

    if (isTask) {
      itemData.priority = priority;
      itemData.due_date = dueDate ? new Date(dueDate).toISOString() : null;
    }

    try {
      const tableName = isTask ? 'bike_tasks' : 'bike_items';
      if (editItemId) {
        await SyncService.updateWithFallback(tableName, user.id, editItemId, itemData);
        showSuccess('Success', `${isTask ? 'Task' : 'Item'} updated!`);
      } else {
        await SyncService.insertWithFallback(tableName, user.id, {
          ...itemData,
          is_completed: false,
        });
        showSuccess('Success', `${isTask ? 'Task' : 'Item'} added!`);
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      showError('Error', `Failed to save ${isTask ? 'task' : 'item'}. Please try again.`);
    }
  };

  const toggleItem = async (itemId: string, completed: boolean, isTaskItem: boolean) => {
    if (!user) return;
    try {
      const tableName = isTaskItem ? 'bike_tasks' : 'bike_items';
      await SyncService.updateWithFallback(tableName, user.id, itemId, {
        is_completed: !completed,
        completed_at: !completed ? new Date().toISOString() : null,
      });
      loadData();
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const deleteItem = async (itemId: string, isTaskItem: boolean) => {
    if (!user) return;
    showConfirmDestructive('Delete', `Are you sure you want to delete this ${isTaskItem ? 'task' : 'item'}?`, async () => {
      try {
        const tableName = isTaskItem ? 'bike_tasks' : 'bike_items';
        await SyncService.deleteWithFallback(tableName, user.id, itemId);
        loadData();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    });
  };

  const getFilteredAndSortedItems = (data: (BikeItem | BikeTask)[]) => {
    let filtered = data;
    // Only apply search and filter for tasks tab, not items tab
    if (activeTab === 'tasks') {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            (item.description && item.description.toLowerCase().includes(query))
        );
      }
      switch (filterOption) {
        case 'active':
          filtered = filtered.filter((item) => !item.is_completed);
          break;
        case 'completed':
          filtered = filtered.filter((item) => item.is_completed);
          break;
      }
      filtered.sort((a, b) => {
        switch (sortOption) {
          case 'priority':
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
              (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
          case 'title':
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
    } else {
      // For items tab, just sort by title alphabetically
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    }
    return filtered;
  };

  const currentData = activeTab === 'items' ? items : tasks;
  const filteredData = getFilteredAndSortedItems(currentData);
  const activeData = filteredData.filter((item) => !item.is_completed);
  const completedData = filteredData.filter((item) => item.is_completed);

  const styles = createStyles(colors);

  // Don't render if user is not authorized
  if (!user || !user.email || !AUTHORIZED_BIKE_EMAILS.includes(user.email)) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Bike" subtitle="Items & Tasks" onAddPress={() => openEditModal(undefined, activeTab === 'tasks')} />
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Bike" subtitle="Items & Tasks" onAddPress={() => openEditModal(undefined, activeTab === 'tasks')} />
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'items' && styles.activeTab, { backgroundColor: activeTab === 'items' ? colors.primary : colors.surface }]}
            onPress={() => setActiveTab('items')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'items' ? '#fff' : colors.text }]}>Accessories</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'tasks' && styles.activeTab, { backgroundColor: activeTab === 'tasks' ? colors.primary : colors.surface }]}
            onPress={() => setActiveTab('tasks')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'tasks' ? '#fff' : colors.text }]}>Maintenance</Text>
          </TouchableOpacity>
        </View>
        {activeTab === 'tasks' && (
          <>
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
                style={[styles.filterButton, { backgroundColor: showFilters ? colors.primary : colors.surface }]}
                onPress={() => setShowFilters(!showFilters)}
              >
                <Filter size={20} color={showFilters ? '#fff' : colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {showFilters && (
              <Card style={styles.filterCard}>
                <View style={styles.filterRow}>
                  <Text style={[styles.filterLabel, { color: colors.text }]}>Status</Text>
                  <View style={styles.filterOptions}>
                    {(['all', 'active', 'completed'] as const).map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.filterOption,
                          filterOption === filter && { backgroundColor: colors.primary },
                          { backgroundColor: colors.surface },
                        ]}
                        onPress={() => setFilterOption(filter)}
                      >
                        <Text style={[styles.filterOptionText, { color: filterOption === filter ? '#fff' : colors.text }]}>
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
                  <View style={styles.filterOptions}>
                    {(['priority', 'title'] as const).map((sort) => (
                      <TouchableOpacity
                        key={sort}
                        style={[
                          styles.filterOption,
                          sortOption === sort && { backgroundColor: colors.primary },
                          { backgroundColor: colors.surface },
                        ]}
                        onPress={() => setSortOption(sort)}
                      >
                        <Text style={[styles.filterOptionText, { color: sortOption === sort ? '#fff' : colors.text }]}>
                          {sort.charAt(0).toUpperCase() + sort.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </Card>
            )}
          </>
        )}
        {activeData.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowActive(!showActive)}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Active ({activeData.length})</Text>
              {showActive ? (
                <ChevronUp size={20} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
            {showActive && activeData.map((item) => {
              const isTaskItem = activeTab === 'tasks';
              return (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.itemContent}>
                    <TouchableOpacity onPress={() => toggleItem(item.id, item.is_completed, isTaskItem)} style={styles.checkbox}>
                      <Circle size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={styles.itemDetails}>
                      <View style={styles.itemHeader}>
                        <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                        <View style={styles.itemActions}>
                          {isTaskItem && (
                            <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium }]}>
                              <Text style={styles.priorityText}>{PRIORITY_LABELS[item.priority] || 'Medium'}</Text>
                            </View>
                          )}
                          <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item, isTaskItem)}>
                            <Edit2 size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id, isTaskItem)}>
                            <X size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {item.description && (
                        <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                          {item.description}
                        </Text>
                      )}
                      {isTaskItem && 'due_date' in item && item.due_date && (
                        <View style={styles.dueDateContainer}>
                          <Calendar size={14} color={colors.textSecondary} />
                          <Text style={[styles.dueDateText, { color: colors.textSecondary }]}>
                            {new Date(item.due_date).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}
        {completedData.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowCompleted(!showCompleted)}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Completed ({completedData.length})</Text>
              {showCompleted ? (
                <ChevronUp size={20} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
            {showCompleted && completedData.map((item) => {
              const isTaskItem = activeTab === 'tasks';
              return (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.itemContent}>
                    <TouchableOpacity onPress={() => toggleItem(item.id, item.is_completed, isTaskItem)} style={styles.checkbox}>
                      <CheckCircle2 size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <View style={styles.itemDetails}>
                      <View style={styles.itemHeader}>
                        <Text style={[styles.itemTitle, styles.completedItem, { color: colors.textSecondary }]}>
                          {item.title}
                        </Text>
                        <View style={styles.itemActions}>
                          {isTaskItem && (
                            <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium }]}>
                              <Text style={styles.priorityText}>{PRIORITY_LABELS[item.priority] || 'Medium'}</Text>
                            </View>
                          )}
                          <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item, isTaskItem)}>
                            <Edit2 size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id, isTaskItem)}>
                            <X size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {item.description && (
                        <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}
        {filteredData.length === 0 && (
          <Card style={styles.emptyCard}>
            <Bike size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeTab === 'items' ? 'No items yet' : (searchQuery ? 'No tasks found' : 'No tasks yet')}
            </Text>
          </Card>
        )}
      </ScrollView>
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editItemId ? `Edit ${isTask ? 'Task' : 'Item'}` : `Add ${isTask ? 'Task' : 'Item'}`}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>{isTask ? 'Task Title' : 'Item Name'} *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder={isTask ? 'e.g., Oil Change, Tire Rotation' : 'e.g., New Chain, Bike Helmet'}
                  placeholderTextColor={colors.textSecondary}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="Additional notes..."
                  placeholderTextColor={colors.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
              {isTask && (
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: colors.text }]}>Due Date (optional)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    value={dueDate}
                    onChangeText={setDueDate}
                  />
                </View>
              )}
              {isTask && (
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
                        <Text style={[styles.priorityOptionText, { color: priority === p ? '#fff' : colors.text }]}>
                          {PRIORITY_LABELS[p]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <Button title={editItemId ? `Update ${isTask ? 'Task' : 'Item'}` : `Add ${isTask ? 'Task' : 'Item'}`} onPress={saveItem} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, padding: 20 },
    tabContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
    activeTab: {},
    tabText: { fontSize: 16, fontWeight: '600' },
    statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    statCard: { flex: 1, padding: 16, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
    statLabel: { fontSize: 12, fontWeight: '500' },
    searchContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 12 },
    searchInput: { flex: 1, fontSize: 16 },
    filterButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    filterCard: { marginBottom: 16, padding: 16 },
    filterRow: { marginBottom: 12 },
    filterLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    filterOptionText: { fontSize: 14, fontWeight: '500' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, marginTop: 8 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
    itemCard: { marginBottom: 12 },
    itemContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    checkbox: { marginTop: 2 },
    itemDetails: { flex: 1 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    itemTitle: { flex: 1, fontSize: 16, fontWeight: '600', marginRight: 8 },
    completedItem: { textDecorationLine: 'line-through' },
    itemDescription: { fontSize: 14, marginBottom: 8, lineHeight: 20 },
    dueDateContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    dueDateText: { fontSize: 12 },
    priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    priorityText: { fontSize: 11, fontWeight: '600', color: '#fff' },
    itemActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    editButton: { padding: 4 },
    deleteButton: { padding: 4 },
    emptyCard: { padding: 40, alignItems: 'center' },
    emptyText: { marginTop: 16, fontSize: 16, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 24, fontWeight: 'bold' },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    input: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 16 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    priorityContainer: { marginBottom: 24 },
    priorityOptions: { flexDirection: 'row', gap: 12 },
    priorityOption: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
    priorityOptionText: { fontSize: 14, fontWeight: '600' },
  });

