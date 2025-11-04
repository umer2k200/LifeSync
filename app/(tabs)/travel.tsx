import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SyncService } from '@/lib/sync';
import { CheckCircle2, Circle, X, Search, Filter, MapPin, Edit2, Luggage, ChevronDown, ChevronUp, DollarSign, TrendingDown } from 'lucide-react-native';
import { showError, showConfirmDestructive, showSuccess } from '@/lib/alert';
import { format } from 'date-fns';

interface TravelPlace {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  priority: string;
  visit_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
}

interface TravelItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface TravelExpense {
  id: string;
  amount: number;
  description: string | null;
  category: string;
  expense_date: string;
  created_at: string;
}

type TabType = 'places' | 'items' | 'expenses';
type SortOption = 'priority' | 'title' | 'category';
type FilterOption = 'all' | 'active' | 'completed';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  clothing: 'Clothing',
  electronics: 'Electronics',
  documents: 'Documents',
  toiletries: 'Toiletries',
  food: 'Food',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  general: '#6B7280',
  clothing: '#3B82F6',
  electronics: '#8B5CF6',
  documents: '#F59E0B',
  toiletries: '#10B981',
  food: '#EF4444',
  other: '#9CA3AF',
};


export default function TravelScreen() {
  const { colors } = useTheme();
  const { currency } = useCurrency();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('places');
  const [places, setPlaces] = useState<TravelPlace[]>([]);
  const [items, setItems] = useState<TravelItem[]>([]);
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [isPlace, setIsPlace] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('title');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');

  // Update sort option when tab changes
  useEffect(() => {
    if (activeTab === 'items') {
      // Default to 'title' for packing list (not category)
      if (sortOption === 'priority' || sortOption === 'category') {
        setSortOption('title');
      }
    } else if (activeTab === 'places') {
      // Default to 'title' for places (priority removed)
      if (sortOption === 'priority' || sortOption === 'category') {
        setSortOption('title');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const [showFilters, setShowFilters] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [placesData, itemsData, expensesData] = await Promise.all([
        SyncService.fetchWithFallback<TravelPlace>('travel_places', user.id),
        SyncService.fetchWithFallback<TravelItem>('travel_items', user.id),
        SyncService.fetchWithFallback<TravelExpense>('travel_expenses', user.id),
      ]);
      setPlaces(placesData);
      setItems(itemsData);
      setExpenses(expensesData.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()));
    } catch (error) {
      console.error('Error loading travel data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        loadData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const openEditModal = (item?: TravelPlace | TravelItem, place?: boolean) => {
    if (item) {
      setEditItemId(item.id);
      setTitle(item.title);
      setDescription(item.description || '');
      setIsPlace(place !== undefined ? place : 'location' in item);
      if ('location' in item) {
        // No longer setting location, visit_date, or priority for places
      } else {
        setCategory(item.category || 'general');
      }
    } else {
      setEditItemId(null);
      setTitle('');
      setDescription('');
      setCategory('general');
      setIsPlace(place !== undefined ? place : activeTab === 'places');
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditItemId(null);
    setTitle('');
    setDescription('');
    setCategory('general');
    setIsPlace(true);
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

    if (!isPlace) {
      itemData.category = category;
    }

    try {
      const tableName = isPlace ? 'travel_places' : 'travel_items';
      if (editItemId) {
        await SyncService.updateWithFallback(tableName, user.id, editItemId, itemData);
        showSuccess('Success', `${isPlace ? 'Place' : 'Item'} updated!`);
      } else {
        await SyncService.insertWithFallback(tableName, user.id, {
          ...itemData,
          is_completed: false,
        });
        showSuccess('Success', `${isPlace ? 'Place' : 'Item'} added!`);
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      showError('Error', `Failed to save ${isPlace ? 'place' : 'item'}. Please try again.`);
    }
  };

  const toggleItem = async (itemId: string, completed: boolean, isPlaceItem: boolean) => {
    if (!user) return;
    try {
      const tableName = isPlaceItem ? 'travel_places' : 'travel_items';
      await SyncService.updateWithFallback(tableName, user.id, itemId, {
        is_completed: !completed,
        completed_at: !completed ? new Date().toISOString() : null,
      });
      loadData();
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const deleteItem = async (itemId: string, isPlaceItem: boolean) => {
    if (!user) return;
    showConfirmDestructive('Delete', `Are you sure you want to delete this ${isPlaceItem ? 'place' : 'item'}?`, async () => {
      try {
        const tableName = isPlaceItem ? 'travel_places' : 'travel_items';
        await SyncService.deleteWithFallback(tableName, user.id, itemId);
        loadData();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    });
  };

  const openExpenseModal = (expense?: TravelExpense) => {
    if (expense) {
      setEditItemId(expense.id);
      setExpenseAmount(expense.amount.toString());
      setExpenseDescription(expense.description || '');
      setExpenseDate(expense.expense_date);
    } else {
      setEditItemId(null);
      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
    }
    setExpenseModalVisible(true);
  };

  const closeExpenseModal = () => {
    setExpenseModalVisible(false);
    setEditItemId(null);
    setExpenseAmount('');
    setExpenseDescription('');
    setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const saveExpense = async () => {
    if (!expenseAmount.trim() || !user) {
      showError('Error', 'Please enter an amount');
      return;
    }

    const expenseData: any = {
      amount: parseFloat(expenseAmount),
      description: expenseDescription.trim() || null,
      expense_date: expenseDate,
    };

    try {
      if (editItemId) {
        await SyncService.updateWithFallback('travel_expenses', user.id, editItemId, expenseData);
        showSuccess('Success', 'Expense updated!');
      } else {
        await SyncService.insertWithFallback('travel_expenses', user.id, expenseData);
        showSuccess('Success', 'Expense added!');
      }
      closeExpenseModal();
      loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
      showError('Error', 'Failed to save expense. Please try again.');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!user) return;
    showConfirmDestructive('Delete', 'Are you sure you want to delete this expense?', async () => {
      try {
        await SyncService.deleteWithFallback('travel_expenses', user.id, expenseId);
        loadData();
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    });
  };

  const clearAllExpenses = async () => {
    if (!user || expenses.length === 0) return;
    showConfirmDestructive('Clear All', 'Are you sure you want to delete all expenses? This action cannot be undone.', async () => {
      try {
        for (const expense of expenses) {
          await SyncService.deleteWithFallback('travel_expenses', user.id, expense.id);
        }
        showSuccess('Success', 'All expenses cleared!');
        loadData();
      } catch (error) {
        console.error('Error clearing expenses:', error);
        showError('Error', 'Failed to clear expenses. Please try again.');
      }
    });
  };

  const getFilteredAndSortedItems = (data: (TravelPlace | TravelItem)[]) => {
    let filtered = data;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query)) ||
          (activeTab === 'places' && 'location' in item && item.location && item.location.toLowerCase().includes(query))
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
          // Priority sorting removed for places, fallback to title
          return a.title.localeCompare(b.title);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'category':
          if (activeTab === 'items' && 'category' in a && 'category' in b) {
            const categoryCompare = a.category.localeCompare(b.category);
            if (categoryCompare !== 0) return categoryCompare;
            return a.title.localeCompare(b.title);
          }
          return 0;
        default:
          return 0;
      }
    });
    return filtered;
  };

  const groupItemsByCategory = (data: TravelItem[]) => {
    const grouped: Record<string, TravelItem[]> = {};
    data.forEach((item) => {
      const cat = item.category || 'general';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(item);
    });
    // Sort items within each category: active first, then completed
    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => {
        if (a.is_completed === b.is_completed) {
          return a.title.localeCompare(b.title);
        }
        return a.is_completed ? 1 : -1; // Active (false) comes before completed (true)
      });
    });
    return grouped;
  };

  const currentData = activeTab === 'places' ? places : items;
  const filteredData = getFilteredAndSortedItems(currentData);
  const activeData = filteredData.filter((item) => !item.is_completed);
  const completedData = filteredData.filter((item) => item.is_completed);
  
  // Group items by category for packing list (includes both active and completed)
  const groupedAllItems = activeTab === 'items' && sortOption === 'category' 
    ? groupItemsByCategory(filteredData as TravelItem[]) 
    : null;
  const categoryOrder = ['documents', 'electronics', 'clothing', 'toiletries', 'food', 'general', 'other'];
  const totalCount = activeTab === 'expenses' ? expenses.length : currentData.length;
  const packedCount = activeTab === 'items' ? completedData.length : 0;
  const unpackedCount = activeTab === 'items' ? activeData.length : 0;
  const visitedCount = activeTab === 'places' ? completedData.length : 0;
  const notVisitedCount = activeTab === 'places' ? activeData.length : 0;
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const filteredExpenses = searchQuery.trim()
    ? expenses.filter((e) =>
        e.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : expenses;

  const styles = createStyles(colors);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader 
          title="Travel" 
          subtitle="Places & Packing" 
          onAddPress={() => activeTab === 'expenses' ? openExpenseModal() : openEditModal(undefined, activeTab === 'places')} 
        />
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Travel" 
        subtitle="Places & Packing" 
        onAddPress={() => activeTab === 'expenses' ? openExpenseModal() : openEditModal(undefined, activeTab === 'places')} 
      />
      <ScrollView style={styles.content}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'places' && styles.activeTab, { backgroundColor: activeTab === 'places' ? colors.primary : colors.surface }]}
            onPress={() => setActiveTab('places')}
          >
            <MapPin size={18} color={activeTab === 'places' ? '#fff' : colors.text} />
            <Text style={[styles.tabText, { color: activeTab === 'places' ? '#fff' : colors.text }]}>Visit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'items' && styles.activeTab, { backgroundColor: activeTab === 'items' ? colors.primary : colors.surface }]}
            onPress={() => setActiveTab('items')}
          >
            <Luggage size={18} color={activeTab === 'items' ? '#fff' : colors.text} />
            <Text style={[styles.tabText, { color: activeTab === 'items' ? '#fff' : colors.text }]}>Packing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'expenses' && styles.activeTab, { backgroundColor: activeTab === 'expenses' ? colors.primary : colors.surface }]}
            onPress={() => setActiveTab('expenses')}
          >
            <DollarSign size={18} color={activeTab === 'expenses' ? '#fff' : colors.text} />
            <Text style={[styles.tabText, { color: activeTab === 'expenses' ? '#fff' : colors.text }]}>Expense</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            {activeTab === 'expenses' ? (
              <>
                <TrendingDown size={24} color={colors.error} />
                <Text style={[styles.statValue, { color: colors.text }]}>{currency.symbol} {Math.round(totalExpenseAmount).toLocaleString()}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Spent</Text>
              </>
            ) : (
              <>
                <Text style={[styles.statValue, { color: colors.text }]}>{totalCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
              </>
            )}
          </Card>
          {activeTab === 'items' ? (
            <>
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{packedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Packed</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.error }]}>{unpackedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Unpacked</Text>
              </Card>
            </>
          ) : activeTab === 'places' ? (
            <>
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{visitedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Visited</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.error }]}>{notVisitedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Not Visited</Text>
              </Card>
            </>
          ) : (
            <>
              <Card style={styles.statCard}>
                <DollarSign size={24} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]}>{expenses.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Expenses</Text>
              </Card>
            </>
          )}
        </View>
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={`Search ${activeTab === 'places' ? 'places' : activeTab === 'items' ? 'items' : 'expenses'}...`}
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
          {activeTab !== 'expenses' && (
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: showFilters ? colors.primary : colors.surface }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} color={showFilters ? '#fff' : colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {showFilters && activeTab !== 'expenses' && (
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
                {(activeTab === 'items' ? ['title', 'category'] : ['title']).map((sort) => (
                  <TouchableOpacity
                    key={sort}
                    style={[
                      styles.filterOption,
                      sortOption === sort && { backgroundColor: colors.primary },
                      { backgroundColor: colors.surface },
                    ]}
                    onPress={() => setSortOption(sort as SortOption)}
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
        {activeTab !== 'expenses' && activeTab === 'items' && sortOption === 'category' && groupedAllItems ? (
          // Grouped by category view (shows both active and completed within each category)
          categoryOrder.map((cat) => {
            const categoryItems = groupedAllItems[cat] || [];
            if (categoryItems.length === 0) return null;
            const activeInCategory = categoryItems.filter((item) => !item.is_completed);
            const completedInCategory = categoryItems.filter((item) => item.is_completed);
            return (
              <View key={cat} style={styles.categoryGroup}>
                <View style={styles.categoryGroupHeader}>
                  <View style={[styles.categoryGroupBadge, { backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.general }]}>
                    <Text style={styles.categoryGroupText}>{CATEGORY_LABELS[cat] || 'General'}</Text>
                  </View>
                  <Text style={[styles.categoryGroupCount, { color: colors.textSecondary }]}>
                    {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
                {activeInCategory.length > 0 && (
                  <>
                    {activeInCategory.map((item) => (
                      <Card key={item.id} style={styles.itemCard}>
                        <View style={styles.itemContent}>
                          <TouchableOpacity onPress={() => toggleItem(item.id, item.is_completed, false)} style={styles.checkbox}>
                            <Circle size={24} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <View style={styles.itemDetails}>
                            <View style={styles.itemHeader}>
                              <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                              <View style={styles.itemActions}>
                                <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general }]}>
                                  <Text style={styles.categoryText}>{CATEGORY_LABELS[item.category] || 'General'}</Text>
                                </View>
                                <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item, false)}>
                                  <Edit2 size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id, false)}>
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
                {completedInCategory.length > 0 && (
                  <>
                    {completedInCategory.map((item) => (
                      <Card key={item.id} style={styles.itemCard}>
                        <View style={styles.itemContent}>
                          <TouchableOpacity onPress={() => toggleItem(item.id, item.is_completed, false)} style={styles.checkbox}>
                            <CheckCircle2 size={24} color={colors.primary} />
                          </TouchableOpacity>
                          <View style={styles.itemDetails}>
                            <View style={styles.itemHeader}>
                              <Text style={[styles.itemTitle, styles.completedItem, { color: colors.textSecondary }]}>
                                {item.title}
                              </Text>
                              <View style={styles.itemActions}>
                                <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general }]}>
                                  <Text style={styles.categoryText}>{CATEGORY_LABELS[item.category] || 'General'}</Text>
                                </View>
                                <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item, false)}>
                                  <Edit2 size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id, false)}>
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
              </View>
            );
          })
        ) : (
          <>
            {activeTab !== 'expenses' && activeData.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Active ({activeData.length})</Text>
                {activeData.map((item) => {
                  const isPlaceItem = activeTab === 'places';
                  return (
                  <Card key={item.id} style={styles.itemCard}>
                    <View style={styles.itemContent}>
                      <TouchableOpacity onPress={() => toggleItem(item.id, item.is_completed, isPlaceItem)} style={styles.checkbox}>
                        <Circle size={24} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <View style={styles.itemDetails}>
                        <View style={styles.itemHeader}>
                          <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                          <View style={styles.itemActions}>
                            {!isPlaceItem && 'category' in item && (
                              <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general }]}>
                                <Text style={styles.categoryText}>{CATEGORY_LABELS[item.category] || 'General'}</Text>
                              </View>
                            )}
                            <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item, isPlaceItem)}>
                              <Edit2 size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id, isPlaceItem)}>
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
            {activeTab !== 'expenses' && completedData.length > 0 && !(activeTab === 'items' && sortOption === 'category') && (
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
                  const isPlaceItem = activeTab === 'places';
                  return (
                    <Card key={item.id} style={styles.itemCard}>
                      <View style={styles.itemContent}>
                        <TouchableOpacity onPress={() => toggleItem(item.id, item.is_completed, isPlaceItem)} style={styles.checkbox}>
                          <CheckCircle2 size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <View style={styles.itemDetails}>
                          <View style={styles.itemHeader}>
                            <Text style={[styles.itemTitle, styles.completedItem, { color: colors.textSecondary }]}>
                              {item.title}
                            </Text>
                            <View style={styles.itemActions}>
                              {!isPlaceItem && 'category' in item && (
                                <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general }]}>
                                  <Text style={styles.categoryText}>{CATEGORY_LABELS[item.category] || 'General'}</Text>
                                </View>
                              )}
                              <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item, isPlaceItem)}>
                                <Edit2 size={18} color={colors.textSecondary} />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id, isPlaceItem)}>
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
          </>
        )}
        {activeTab === 'expenses' && (
          <>
            {filteredExpenses.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Expenses ({filteredExpenses.length})</Text>
                <TouchableOpacity
                  style={[styles.clearAllButton, { backgroundColor: colors.error }]}
                  onPress={clearAllExpenses}
                >
                  <Text style={styles.clearAllButtonText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}
            {filteredExpenses.length > 0 ? (
              filteredExpenses.map((expense) => (
                <Card key={expense.id} style={styles.itemCard}>
                  <View style={styles.itemContent}>
                    <View style={styles.itemDetails}>
                      <View style={styles.itemHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.expenseAmount, { color: colors.text }]}>
                            {currency.symbol} {Math.round(Number(expense.amount)).toLocaleString()}
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
                        <View style={styles.itemActions}>
                          <TouchableOpacity style={styles.editButton} onPress={() => openExpenseModal(expense)}>
                            <Edit2 size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteExpense(expense.id)}>
                            <X size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <DollarSign size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery ? 'No expenses found' : 'No expenses yet'}
                </Text>
              </Card>
            )}
          </>
        )}
        {activeTab !== 'expenses' && filteredData.length === 0 && (
          <Card style={styles.emptyCard}>
            {activeTab === 'places' ? (
              <MapPin size={48} color={colors.textSecondary} />
            ) : (
              <Luggage size={48} color={colors.textSecondary} />
            )}
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery ? `No ${activeTab === 'places' ? 'places' : 'items'} found` : `No ${activeTab === 'places' ? 'places' : 'items'} yet`}
            </Text>
          </Card>
        )}
      </ScrollView>
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editItemId ? `Edit ${isPlace ? 'Place' : 'Item'}` : `Add ${isPlace ? 'Place' : 'Item'}`}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>{isPlace ? 'Place Name' : 'Item Name'} *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder={isPlace ? 'e.g., Eiffel Tower, Paris' : 'e.g., Passport, Camera'}
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
              {!isPlace && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Category</Text>
                    <View style={styles.categoryOptions}>
                      {(['general', 'clothing', 'electronics', 'documents', 'toiletries', 'food', 'other'] as const).map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryOption,
                            category === cat && {
                              backgroundColor: CATEGORY_COLORS[cat],
                              borderColor: CATEGORY_COLORS[cat],
                            },
                            { borderColor: colors.border },
                          ]}
                          onPress={() => setCategory(cat)}
                        >
                          <Text style={[styles.categoryOptionText, { color: category === cat ? '#fff' : colors.text }]}>
                            {CATEGORY_LABELS[cat]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}
              <Button title={editItemId ? `Update ${isPlace ? 'Place' : 'Item'}` : `Add ${isPlace ? 'Place' : 'Item'}`} onPress={saveItem} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Expense Modal */}
      <Modal visible={expenseModalVisible} animationType="slide" transparent onRequestClose={closeExpenseModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editItemId ? 'Edit Expense' : 'Add Expense'}
              </Text>
              <TouchableOpacity onPress={closeExpenseModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Amount *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="What was this expense for?"
                  placeholderTextColor={colors.textSecondary}
                  value={expenseDescription}
                  onChangeText={setExpenseDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={expenseDate}
                  onChangeText={setExpenseDate}
                />
              </View>
              <Button title={editItemId ? 'Update Expense' : 'Add Expense'} onPress={saveExpense} />
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
    tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
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
    locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    locationText: { fontSize: 12 },
    dueDateContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    dueDateText: { fontSize: 12 },
    categoryContainer: { marginBottom: 8 },
    categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
    categoryText: { fontSize: 11, fontWeight: '600', color: '#fff' },
    itemFooter: { marginTop: 4, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
    priorityText: { fontSize: 11, fontWeight: '600', color: '#fff' },
    itemActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    categoryGroup: { marginBottom: 20 },
    categoryGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    categoryGroupBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    categoryGroupText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    categoryGroupCount: { fontSize: 12, fontWeight: '500' },
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
    categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryOption: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2 },
    categoryOptionText: { fontSize: 13, fontWeight: '600' },
    priorityContainer: { marginBottom: 24 },
    priorityOptions: { flexDirection: 'row', gap: 12 },
    priorityOption: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
    priorityOptionText: { fontSize: 14, fontWeight: '600' },
    expenseAmount: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
    expenseDescription: { fontSize: 14, marginBottom: 8 },
    expenseDate: { fontSize: 12, marginTop: 4 },
    clearAllButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    clearAllButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  });

