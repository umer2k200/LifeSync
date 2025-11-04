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
import { BookOpen, Plus, Edit2, Trash2, X, Search } from 'lucide-react-native';
import { format } from 'date-fns';
import { showError, showConfirmDestructive, showSuccess } from '@/lib/alert';

interface Note {
  id: string;
  title: string;
  content: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export default function NotesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotes();
    }
  }, [user]);

  // Reload notes when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user && !initialLoading) {
        loadNotes();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadNotes = async () => {
    if (!user) return;
    setInitialLoading(true);
    try {
      const data = await SyncService.fetchWithFallback<Note>('notes', user.id);
      // Sort by updated_at descending (most recent first)
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return dateB - dateA;
      });
      setNotes(sorted);
    } catch (error) {
      console.error('Error loading notes:', error);
      showError('Error', 'Failed to load notes');
    } finally {
      setInitialLoading(false);
    }
  };

  const openEditModal = (note: Note) => {
    setEditNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category || '');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditNoteId(null);
    setTitle('');
    setContent('');
    setCategory('');
  };

  const saveNote = async () => {
    if (!title.trim() || !content.trim() || !user) {
      showError('Error', 'Please enter both title and content');
      return;
    }

    setLoading(true);
    try {
      const noteData = {
        title: title.trim(),
        content: content.trim(),
        category: category.trim() || null,
      };

      if (editNoteId) {
        // Update existing note
        await SyncService.updateWithFallback('notes', user.id, editNoteId, noteData);
        showSuccess('Success', 'Note updated successfully!');
      } else {
        // Create new note
        const result = await SyncService.insertWithFallback<Note>('notes', user.id, noteData);
        if (!result) {
          throw new Error('Failed to create note');
        }
        showSuccess('Success', 'Note created successfully!');
      }
      await loadNotes();
      closeModal();
    } catch (error: any) {
      console.error('Error saving note:', error);
      showError('Error', error?.message || 'Failed to save note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = (noteId: string) => {
    showConfirmDestructive(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      async () => {
        if (!user) return;
        try {
          await SyncService.deleteWithFallback('notes', user.id, noteId);
          showSuccess('Success', 'Note deleted successfully!');
          await loadNotes();
        } catch (error) {
          console.error('Error deleting note:', error);
          showError('Error', 'Failed to delete note');
        }
      }
    );
  };

  const getFilteredNotes = () => {
    if (!searchQuery.trim()) {
      return notes;
    }
    const query = searchQuery.toLowerCase();
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        (note.category && note.category.toLowerCase().includes(query))
    );
  };

  const filteredNotes = getFilteredNotes();

  const styles = createStyles(colors);

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Notes" subtitle="Your personal notes" />
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notes" subtitle="Your personal notes" />
      <ScrollView style={styles.content}>
        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search notes..."
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

        {/* Notes List */}
        {filteredNotes.length === 0 ? (
          <Card style={styles.emptyCard}>
            <BookOpen size={48} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery ? 'No notes found matching your search' : 'No notes yet. Create your first note!'}
            </Text>
          </Card>
        ) : (
          filteredNotes.map((note) => (
            <Card key={note.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <View style={styles.noteContent}>
                  <Text style={[styles.noteTitle, { color: colors.text }]} numberOfLines={2}>
                    {note.title}
                  </Text>
                  {note.category && (
                    <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.categoryText, { color: colors.primary }]}>
                        {note.category}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.notePreview, { color: colors.textSecondary }]} numberOfLines={3}>
                    {note.content}
                  </Text>
                  <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
                    {format(new Date(note.updated_at), 'MMM dd, yyyy • h:mm a')}
                  </Text>
                </View>
                <View style={styles.noteActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditModal(note)}
                  >
                    <Edit2 size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => deleteNote(note.id)}
                  >
                    <Trash2 size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          setEditNoteId(null);
          setTitle('');
          setContent('');
          setCategory('');
          setModalVisible(true);
        }}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Note Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editNoteId ? 'Edit Note' : 'Add Note'}
              </Text>
              <TouchableOpacity onPress={closeModal} disabled={loading}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                placeholder="Enter note title"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                editable={!loading}
              />

              <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Content *</Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: colors.surface, color: colors.text },
                ]}
                placeholder="Write your note here..."
                placeholderTextColor={colors.textSecondary}
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                editable={!loading}
              />

              <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>
                Category (Optional)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                placeholder="e.g., Personal, Work, Ideas"
                placeholderTextColor={colors.textSecondary}
                value={category}
                onChangeText={setCategory}
                editable={!loading}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={closeModal}
                variant="outline"
                disabled={loading}
                style={{ ...styles.modalButton, marginRight: 8, borderColor: colors.border }}
                textStyle={{ color: colors.text }}
              />
              <Button
                title={loading ? 'Saving...' : editNoteId ? 'Update' : 'Save'}
                onPress={saveNote}
                disabled={loading || !title.trim() || !content.trim()}
                style={{ ...styles.modalButton, marginLeft: 8 }}
              />
            </View>
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
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
    },
    emptyCard: {
      alignItems: 'center',
      padding: 40,
      marginTop: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 16,
      textAlign: 'center',
    },
    noteCard: {
      marginBottom: 12,
      padding: 16,
    },
    noteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    noteContent: {
      flex: 1,
      marginRight: 12,
    },
    noteTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 8,
    },
    categoryText: {
      fontSize: 12,
      fontWeight: '500',
    },
    notePreview: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 8,
    },
    noteDate: {
      fontSize: 12,
    },
    noteActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    actionButton: {
      padding: 8,
    },
    addButton: {
      position: 'absolute',
      bottom: 30,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 40,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    modalScroll: {
      maxHeight: 400,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
    },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      minHeight: 150,
    },
    modalButtons: {
      flexDirection: 'row',
      marginTop: 20,
    },
    modalButton: {
      flex: 1,
    },
  });

