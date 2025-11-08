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
import { CheckCircle2, Circle, X, Search, Filter, ShoppingCart, Edit2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { showError, showConfirmDestructive, showSuccess } from '@/lib/alert';

// Authorized emails for shopping list feature
const AUTHORIZED_SHOPPING_LIST_EMAILS = [
  'umarzeeshan708@gmail.com',
  'umarzeeshan709@gmail.com',
];

interface ShoppingItem {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  is_completed: boolean;
  completed_at: string | null;
}

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

export default function ShoppingListScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showActive, setShowActive] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is authorized to access this page
  useEffect(() => {
    if (user) {
      const isAuthorized = user.email && AUTHORIZED_SHOPPING_LIST_EMAILS.includes(user.email);
      if (!isAuthorized) {
        // Redirect to home if not authorized
        router.replace('/(tabs)');
        return;
      }
      loadItems();
    }
  }, [user, router]);

  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        const isAuthorized = user.email && AUTHORIZED_SHOPPING_LIST_EMAILS.includes(user.email);
        if (isAuthorized) {
          loadItems();
        } else {
          router.replace('/(tabs)');
        }
      }
    }, [user, router])
  );

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await SyncService.fetchWithFallback<ShoppingItem>('shopping_list_items', user.id);
      setItems(data);
    } catch (error) {
      console.error('Error loading shopping items:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (item: ShoppingItem) => {
    setEditItemId(item.id);
    setTitle(item.title);
    setDescription(item.description || '');
    setPriority(item.priority);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditItemId(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
  };

  const saveItem = async () => {
    if (!title.trim() || !user) {
      showError('Error', 'Please enter an item name');
      return;
    }

    const itemData = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
    };

    try {
      if (editItemId) {
        await SyncService.updateWithFallback('shopping_list_items', user.id, editItemId, itemData);
        showSuccess('Success', 'Item updated!');
      } else {
        await SyncService.insertWithFallback('shopping_list_items', user.id, {
          ...itemData,
          is_completed: false,
        });
        showSuccess('Success', 'Item added!');
      }
      closeModal();
      loadItems();
    } catch (error) {
      console.error('Error saving item:', error);
      showError('Error', 'Failed to save item. Please try again.');
    }
  };

  const toggleItem = async (itemId: string, completed: boolean) => {
    if (!user) return;
    try {
      await SyncService.updateWithFallback('shopping_list_items', user.id, itemId, {
        is_completed: !completed,
        completed_at: !completed ? new Date().toISOString() : null,
      });
      loadItems();
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete Item', 'Are you sure you want to delete this item?', async () => {
      try {
        await SyncService.deleteWithFallback('shopping_list_items', user.id, itemId);
        loadItems();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    });
  };

  const getFilteredAndSortedItems = () => {
    let filtered = items;
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
    return filtered;
  };

  const filteredItems = getFilteredAndSortedItems();
  const activeItems = filteredItems.filter((item) => !item.is_completed);
  const completedItems = filteredItems.filter((item) => item.is_completed);
  const totalItems = items.length;
  const completedCount = items.filter((item) => item.is_completed).length;
  const highPriorityCount = items.filter((item) => !item.is_completed && item.priority === 'high').length;

  const styles = createStyles(colors);

  // Don't render if user is not authorized
  if (!user || !user.email || !AUTHORIZED_SHOPPING_LIST_EMAILS.includes(user.email)) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Things to Buy" subtitle="List of items to buy" onAddPress={() => setModalVisible(true)} />
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Things to Buy" subtitle="List of items to buy" onAddPress={() => setModalVisible(true)} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.text }]}>{totalItems}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>{completedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: highPriorityCount > 0 ? colors.error : colors.text }]}>
              {highPriorityCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>High Priority</Text>
          </Card>
        </View>
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search items..."
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
        {activeItems.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowActive(!showActive)}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Active ({activeItems.length})</Text>
              {showActive ? (
                <ChevronUp size={20} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
            {showActive && activeItems.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemContent}>
                  <TouchableOpacity onPress={() => toggleItem(item.id, item.is_completed)} style={styles.checkbox}>
                    <Circle size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={styles.itemDetails}>
                    <View style={styles.itemHeader}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                      <View style={styles.itemActions}>
                        <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium }]}>
                          <Text style={styles.priorityText}>{PRIORITY_LABELS[item.priority] || 'Medium'}</Text>
                        </View>
                        <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item)}>
                          <Edit2 size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id)}>
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
            ))}
          </>
        )}
        {completedItems.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowCompleted(!showCompleted)}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Completed ({completedItems.length})</Text>
              {showCompleted ? (
                <ChevronUp size={20} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
            {showCompleted && completedItems.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemContent}>
                  <TouchableOpacity onPress={() => toggleItem(item.id, item.is_completed)} style={styles.checkbox}>
                    <CheckCircle2 size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.itemDetails}>
                    <View style={styles.itemHeader}>
                      <Text style={[styles.itemTitle, styles.completedItem, { color: colors.textSecondary }]}>
                        {item.title}
                      </Text>
                      <View style={styles.itemActions}>
                        <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium }]}>
                          <Text style={styles.priorityText}>{PRIORITY_LABELS[item.priority] || 'Medium'}</Text>
                        </View>
                        <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item)}>
                          <Edit2 size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id)}>
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
            ))}
          </>
        )}
        {filteredItems.length === 0 && (
          <Card style={styles.emptyCard}>
            <ShoppingCart size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery ? 'No items found' : 'No items in your shopping list'}
            </Text>
          </Card>
        )}
      </ScrollView>
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editItemId ? 'Edit Item' : 'Add Item'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Item Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="e.g., Milk, Bread, Eggs"
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
              <Button title={editItemId ? 'Update Item' : 'Add Item'} onPress={saveItem} />
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
    contentContainer: { paddingBottom: 32 },
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
