import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Switch } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SyncService } from '@/lib/sync';
import { NotificationService } from '@/lib/notifications';
import { BookOpen, Hash, Heart, Plus, X, Edit, Bell } from 'lucide-react-native';
import { format } from 'date-fns';
import { showError, showSuccess, showConfirmDestructive, showAlert } from '@/lib/alert';

interface QuranProgress {
  id: string;
  surah_number: number;
  ayah_number: number;
  page_number?: number;
  last_read_at?: string;
  with_translation?: boolean;
}

interface CharityReminder {
  id: string;
  title: string;
  description?: string;
  frequency: string;
  next_reminder_date: string;
  is_active: boolean;
  notification_id?: string;
  reminder_hour?: number;
  reminder_minute?: number;
}

interface Tasbeeh {
  id: string;
  name: string;
  target_count: number;
  description?: string;
}

export default function IslamicScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tasbeehs, setTasbeehs] = useState<Tasbeeh[]>([]);
  const [tasbeehModalVisible, setTasbeehModalVisible] = useState(false);
  const [tasbeehName, setTasbeehName] = useState('');
  const [tasbeehCount, setTasbeehCount] = useState('');
  const [tasbeehDescription, setTasbeehDescription] = useState('');

  const [quranProgress, setQuranProgress] = useState<QuranProgress | null>(null);
  const [quranModalVisible, setQuranModalVisible] = useState(false);
  const [surahNumber, setSurahNumber] = useState('');
  const [ayahNumber, setAyahNumber] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  
  // Charity reminders
  const [charityReminder, setCharityReminder] = useState<CharityReminder | null>(null);
  const [charityModalVisible, setCharityModalVisible] = useState(false);
  const [charityTitle, setCharityTitle] = useState('');
  const [charityDescription, setCharityDescription] = useState('');
  const [charityEnabled, setCharityEnabled] = useState(false);
  const [charityHour, setCharityHour] = useState('18');
  const [charityMinute, setCharityMinute] = useState('0');

  useEffect(() => {
    if (user) {
      loadTasbeehs();
      loadQuranProgress();
      loadCharityReminder();
    }
  }, [user]);

  const loadTasbeehs = async () => {
    if (!user) return;
    const data = await SyncService.fetchWithFallback<Tasbeeh>('tasbeehs', user.id);
    setTasbeehs(data);
  };

  const addTasbeeh = async () => {
    if (!user || !tasbeehName.trim()) {
      showError('Error', 'Please enter a tasbeeh name');
      return;
    }

    const count = tasbeehCount.trim() ? parseInt(tasbeehCount) : 33;
    
    if (isNaN(count) || count < 1) {
      showError('Error', 'Please enter a valid number');
      return;
    }

    await SyncService.insertWithFallback('tasbeehs', user.id, {
      name: tasbeehName.trim(),
      target_count: count,
      description: tasbeehDescription.trim() || null,
    });

    setTasbeehModalVisible(false);
    setTasbeehName('');
    setTasbeehCount('');
    setTasbeehDescription('');
    await loadTasbeehs();
  };

  const _deleteTasbeeh = async (tasbeeh: Tasbeeh) => {
    if (!user) return;

    showConfirmDestructive('Delete Tasbeeh', `Are you sure you want to delete "${tasbeeh.name}"?`, async () => {
      await SyncService.deleteWithFallback('tasbeehs', user.id, tasbeeh.id);
      await loadTasbeehs();
    });
  };

  const loadQuranProgress = async () => {
    if (!user) return;
    try {
      const data = await SyncService.fetchWithFallback('quran_progress', user.id);
      if (data && data.length > 0 && data[0]) {
        const progress = data[0] as QuranProgress;
        setQuranProgress(progress);
        setSurahNumber(progress.surah_number?.toString() || '');
        setAyahNumber(progress.ayah_number?.toString() || '');
        setPageNumber(progress.page_number?.toString() || '');
      } else {
        setQuranProgress(null);
        setSurahNumber('');
        setAyahNumber('');
        setPageNumber('');
      }
    } catch (error) {
      console.error('Error loading Quran progress:', error);
      setQuranProgress(null);
    }
  };

  const saveQuranProgress = async () => {
    if (!user || !surahNumber.trim() || !ayahNumber.trim()) {
      showError('Error', 'Please fill in Surah and Verse fields');
      return;
    }

    const surah = parseInt(surahNumber);
    const ayah = parseInt(ayahNumber);
    const page = pageNumber.trim() ? parseInt(pageNumber) : null;

    if (isNaN(surah) || isNaN(ayah)) {
      showError('Error', 'Please enter valid numbers for Surah and Verse');
      return;
    }

    if (surah < 1 || surah > 114) {
      showError('Error', 'Surah number must be between 1 and 114');
      return;
    }

    if (ayah < 1) {
      showError('Error', 'Verse number must be greater than 0');
      return;
    }

    if (page !== null && (isNaN(page) || page < 1 || page > 604)) {
      showError('Error', 'Page number must be between 1 and 604');
      return;
    }

    try {
      // First, check if progress already exists (due to UNIQUE constraint)
      const existingData = await SyncService.fetchWithFallback('quran_progress', user.id) as QuranProgress[];
      
      if (existingData && existingData.length > 0 && existingData[0].id) {
        // Update existing progress
        const updateData: Partial<QuranProgress> = {
          surah_number: surah,
          ayah_number: ayah,
          last_read_at: new Date().toISOString(),
        };
        // Only include page_number if provided and valid
        if (page !== null && !isNaN(page)) {
          updateData.page_number = page;
        }
        
        await SyncService.updateWithFallback('quran_progress', user.id, existingData[0].id, updateData);
        showSuccess('Success', 'Quran progress updated successfully!');
      } else {
        // Create new progress
        const insertData: Partial<QuranProgress> = {
          surah_number: surah,
          ayah_number: ayah,
          with_translation: false,
        };
        // Only include page_number if provided and valid
        if (page !== null && !isNaN(page)) {
          insertData.page_number = page;
        }
        
        const result = await SyncService.insertWithFallback('quran_progress', user.id, insertData);
        
        if (result) {
          showSuccess('Success', 'Quran progress saved successfully!');
        } else {
          showError('Error', 'Failed to save progress. Please check the terminal for details.');
          return;
        }
      }

      setQuranModalVisible(false);
      await loadQuranProgress();
    } catch (error: any) {
      console.error('Error saving Quran progress:', error);
      showError('Error', error?.message || 'Failed to save progress. Please check the terminal for details.');
    }
  };

  const loadCharityReminder = async () => {
    if (!user) return;
    try {
      const data = await SyncService.fetchWithFallback('charity_reminders', user.id);
      if (data && data.length > 0 && data[0]) {
        const reminder = data[0] as CharityReminder;
        setCharityReminder(reminder);
        setCharityTitle(reminder.title);
        setCharityDescription(reminder.description || '');
        setCharityEnabled(reminder.is_active);
        setCharityHour(reminder.reminder_hour?.toString() || '18');
        setCharityMinute(reminder.reminder_minute?.toString() || '0');
      } else {
        setCharityReminder(null);
        setCharityTitle('');
        setCharityDescription('');
        setCharityEnabled(false);
        setCharityHour('18');
        setCharityMinute('0');
      }
    } catch (error) {
      console.error('Error loading charity reminder:', error);
      setCharityReminder(null);
    }
  };

  const toggleCharityReminder = async () => {
    if (!charityReminder) {
      showError('Error', 'Please set up your charity reminder first');
      return;
    }

    try {
      const newEnabledState = !charityEnabled;
      
      // Update local state immediately
      setCharityEnabled(newEnabledState);

      // Cancel or schedule notification
      if (newEnabledState) {
        // Schedule notification for Thursday
        const hour = charityReminder.reminder_hour || 18;
        const minute = charityReminder.reminder_minute || 0;
        const notificationId = await NotificationService.scheduleThursdayCharityReminder(
          charityReminder.title,
          charityReminder.description || 'Give charity today and earn blessings!',
          hour,
          minute
        );

        if (notificationId) {
          // Update database with new state and notification ID
          await SyncService.updateWithFallback(
            'charity_reminders',
            user!.id,
            charityReminder.id,
            {
              is_active: true,
              notification_id: notificationId,
            }
          );
          showSuccess('Success', 'Charity reminder enabled! You will receive notifications every Thursday.');
        } else {
          setCharityEnabled(false);
          showError('Error', 'Failed to schedule notification. Please check your notification permissions.');
        }
      } else {
        // Cancel notification if it exists
        if (charityReminder.notification_id) {
          await NotificationService.cancelNotification(charityReminder.notification_id);
        }
        
        // Update database
        await SyncService.updateWithFallback(
          'charity_reminders',
          user!.id,
          charityReminder.id,
          {
            is_active: false,
          }
        );
        showSuccess('Success', 'Charity reminder disabled.');
      }
      
      await loadCharityReminder();
    } catch (error: any) {
      console.error('Error toggling charity reminder:', error);
      setCharityEnabled(charityEnabled); // Revert on error
      showError('Error', 'Failed to update reminder. Please try again.');
    }
  };

  const saveCharityReminder = async () => {
    if (!user || !charityTitle.trim()) {
      showError('Error', 'Please enter a reminder title');
      return;
    }

    // Validate time inputs
    const hour = parseInt(charityHour);
    const minute = parseInt(charityMinute);
    
    if (isNaN(hour) || hour < 0 || hour > 23) {
      showError('Error', 'Hour must be between 0 and 23');
      return;
    }
    
    if (isNaN(minute) || minute < 0 || minute > 59) {
      showError('Error', 'Minute must be between 0 and 59');
      return;
    }

    try {
      // First, check if reminder already exists
      const existingData = await SyncService.fetchWithFallback('charity_reminders', user.id) as CharityReminder[];
      
      // Calculate next Thursday
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 4 = Thursday
      let daysUntilThursday = (4 - dayOfWeek + 7) % 7;
      // If it's Thursday and past the reminder time, schedule for next week
      if (daysUntilThursday === 0 && (today.getHours() > hour || (today.getHours() === hour && today.getMinutes() >= minute))) {
        daysUntilThursday = 7;
      }
      const nextThursday = new Date(today);
      nextThursday.setDate(today.getDate() + daysUntilThursday);
      
      if (existingData && existingData.length > 0 && existingData[0].id) {
        const existingReminder = existingData[0];
        // Update existing reminder
        const updateData: Partial<CharityReminder> = {
          title: charityTitle,
          description: charityDescription || '',
          frequency: 'weekly',
          next_reminder_date: nextThursday.toISOString().split('T')[0],
          reminder_hour: hour,
          reminder_minute: minute,
        };
        
        await SyncService.updateWithFallback('charity_reminders', user.id, existingData[0].id, updateData);
        
        // If the reminder was active and time changed, reschedule notification
        if (existingReminder.is_active && existingReminder.notification_id) {
          // Cancel old notification
          await NotificationService.cancelNotification(existingReminder.notification_id);
          
          // Schedule new notification with updated time
          const notificationId = await NotificationService.scheduleThursdayCharityReminder(
            charityTitle,
            charityDescription || 'Give charity today and earn blessings!',
            hour,
            minute
          );
          
          if (notificationId) {
            await SyncService.updateWithFallback('charity_reminders', user.id, existingData[0].id, {
              notification_id: notificationId,
            });
            showSuccess('Success', 'Charity reminder updated! Notification rescheduled for the new time.');
          } else {
            showSuccess('Success', 'Reminder updated, but failed to reschedule notification. Please re-enable it.');
            await SyncService.updateWithFallback('charity_reminders', user.id, existingData[0].id, {
              is_active: false,
            });
          }
        } else {
          showSuccess('Success', 'Charity reminder updated successfully!');
        }
        setCharityModalVisible(false);
        await loadCharityReminder();
      } else {
        // Create new reminder
        const insertData: Partial<CharityReminder> = {
          title: charityTitle,
          description: charityDescription || '',
          frequency: 'weekly',
          next_reminder_date: nextThursday.toISOString().split('T')[0],
          is_active: false,
          reminder_hour: hour,
          reminder_minute: minute,
        };
        
        const result = await SyncService.insertWithFallback('charity_reminders', user.id, insertData);
        
        if (result) {
          setCharityModalVisible(false);
          await loadCharityReminder();
          
          // Ask user if they want to enable notifications now
          showAlert(
            'Reminder Created!',
            'Would you like to enable notifications now?',
            'info',
            [
              {
                text: 'Later',
                onPress: () => {},
                style: 'cancel',
              },
              {
                text: 'Enable Now',
                onPress: async () => {
                  // Schedule and enable the notification
                  const notificationId = await NotificationService.scheduleThursdayCharityReminder(
                    charityTitle,
                    charityDescription || 'Give charity today and earn blessings!',
                    hour,
                    minute
                  );

                  if (notificationId && result.id) {
                    await SyncService.updateWithFallback(
                      'charity_reminders',
                      user.id,
                      result.id,
                      {
                        is_active: true,
                        notification_id: notificationId,
                      }
                    );
                    await loadCharityReminder();
                    showSuccess('Success', 'Notifications enabled! You will receive a reminder every Thursday.');
                  } else {
                    showError('Error', 'Failed to enable notifications. Please check your notification permissions in settings.');
                  }
                },
                style: 'default',
              },
            ]
          );
        } else {
          showError('Error', 'Failed to create reminder. Please try again.');
          return;
        }
      }
    } catch (error: any) {
      console.error('Error saving charity reminder:', error);
      showError('Error', error?.message || 'Failed to save reminder. Please try again.');
    }
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Islamic" subtitle="Spiritual tracking" />

      <ScrollView style={styles.content}>
        <Card style={styles.tasbeehCard}>
          <View style={styles.tasbeehHeader}>
            <Hash size={24} color={colors.primary} />
            <Text style={[styles.tasbeehTitle, { color: colors.text }]}>Tasbeeh</Text>
            <TouchableOpacity
              style={[styles.addTasbeehButton, { backgroundColor: colors.primary }]}
              onPress={() => setTasbeehModalVisible(true)}
            >
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {tasbeehs.length === 0 ? (
            <View style={styles.emptyTasbeehContainer}>
              <Text style={[styles.emptyTasbeehText, { color: colors.textSecondary }]}>
                No tasbeehs yet. Add your first one!
              </Text>
            </View>
          ) : (
            tasbeehs.map((tasbeeh) => (
              <Card key={tasbeeh.id} style={styles.tasbeehItemCard}>
                <View style={styles.tasbeehItemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tasbeehItemName, { color: colors.text }]}>
                      {tasbeeh.name}
                    </Text>
                    {tasbeeh.description && (
                      <Text style={[styles.tasbeehItemDescription, { color: colors.textSecondary }]}>
                        {tasbeeh.description}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.tasbeehCountBadge, { borderColor: colors.primary }]}>
                    <Text style={[styles.tasbeehCountText, { color: colors.primary }]}>
                      {tasbeeh.target_count}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </Card>

        <Card style={styles.quranCard}>
          <View style={styles.quranHeader}>
            <BookOpen size={24} color={colors.primary} />
            <Text style={[styles.quranTitle, { color: colors.text }]}>Quran Progress</Text>
          </View>

          {quranProgress ? (
            <View style={styles.quranProgressContainer}>
              <View style={styles.quranProgressRow}>
                <Text style={[styles.quranLabel, { color: colors.textSecondary }]}>Last Read:</Text>
                <Text style={[styles.quranValue, { color: colors.text }]}>
                  Surah {quranProgress.surah_number}, Verse {quranProgress.ayah_number}
                </Text>
              </View>
              <View style={styles.quranProgressRow}>
                <Text style={[styles.quranLabel, { color: colors.textSecondary }]}>Page:</Text>
                <Text style={[styles.quranValue, { color: colors.text }]}>
                  {quranProgress.page_number || 'N/A'}
                </Text>
              </View>
              {quranProgress.last_read_at && (
                <Text style={[styles.quranDate, { color: colors.textSecondary }]}>
                  {format(new Date(quranProgress.last_read_at), 'MMM dd, yyyy')}
                </Text>
              )}
            <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={() => setQuranModalVisible(true)}
              >
                <Edit size={16} color="#FFFFFF" />
                <Text style={[styles.editButtonText, { color: '#FFFFFF' }]}>Update Progress</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.quranEmptyContainer}>
              <Text style={[styles.quranEmptyText, { color: colors.textSecondary }]}>
                No progress tracked yet
              </Text>
            <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={() => setQuranModalVisible(true)}
            >
                <Plus size={16} color="#FFFFFF" />
                <Text style={[styles.editButtonText, { color: '#FFFFFF' }]}>Start Tracking</Text>
            </TouchableOpacity>
          </View>
          )}
        </Card>

        <Card style={styles.charityCard}>
          <View style={styles.charityHeader}>
            <Heart size={24} color={colors.error} />
            <Text style={[styles.charityTitle, { color: colors.text }]}>Charity Reminders</Text>
          </View>

          {charityReminder ? (
            <View style={styles.charityProgressContainer}>
              <View style={styles.charityProgressRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.charityLabel, { color: colors.textSecondary }]}>Reminder:</Text>
                  <Text style={[styles.charityValue, { color: colors.text }]}>
                    {charityReminder.title}
                  </Text>
                  {charityReminder.description && (
                    <Text style={[styles.charityDescription, { color: colors.textSecondary }]}>
                      {charityReminder.description}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.charityProgressRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.charityLabel, { color: colors.textSecondary }]}>Frequency:</Text>
                  <Text style={[styles.charityValue, { color: colors.text }]}>
                    Every Thursday at {charityReminder.reminder_hour !== undefined ? charityReminder.reminder_hour.toString().padStart(2, '0') : '18'}:{charityReminder.reminder_minute !== undefined ? charityReminder.reminder_minute.toString().padStart(2, '0') : '00'}
          </Text>
                </View>
              </View>
              
              <View style={styles.charitySwitchContainer}>
                <Text style={[styles.charityLabel, { color: colors.text }]}>Enable Reminder</Text>
                <Switch
                  value={charityEnabled}
                  onValueChange={toggleCharityReminder}
                  trackColor={{ false: colors.surface, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setCharityModalVisible(true)}
              >
                <Edit size={16} color={colors.primary} />
                <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit Reminder</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.charityEmptyContainer}>
              <Text style={[styles.charityEmptyText, { color: colors.textSecondary }]}>
                Set up a weekly charity reminder
          </Text>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={() => setCharityModalVisible(true)}
              >
                <Bell size={16} color="#FFFFFF" />
                <Text style={[styles.editButtonText, { color: '#FFFFFF' }]}>Set Up Reminder</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Quran Progress Modal */}
      <Modal visible={quranModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Update Quran Progress</Text>
              <TouchableOpacity onPress={() => setQuranModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Surah Number (1-114)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="e.g., 1"
              placeholderTextColor={colors.textSecondary}
              value={surahNumber}
              onChangeText={setSurahNumber}
              keyboardType="number-pad"
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Verse/Ayah Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="e.g., 7"
              placeholderTextColor={colors.textSecondary}
              value={ayahNumber}
              onChangeText={setAyahNumber}
              keyboardType="number-pad"
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Page Number (1-604) - Optional</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="e.g., 2 (optional)"
              placeholderTextColor={colors.textSecondary}
              value={pageNumber}
              onChangeText={setPageNumber}
              keyboardType="number-pad"
            />

            <Button title="Save Progress" onPress={saveQuranProgress} />
          </View>
        </View>
      </Modal>

      {/* Charity Reminder Modal */}
      <Modal visible={charityModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Charity Reminder Setup</Text>
              <TouchableOpacity onPress={() => setCharityModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Reminder Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="e.g., Give Charity"
              placeholderTextColor={colors.textSecondary}
              value={charityTitle}
              onChangeText={setCharityTitle}
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="e.g., Give charity today and earn blessings!"
              placeholderTextColor={colors.textSecondary}
              value={charityDescription}
              onChangeText={setCharityDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Reminder Time (Thursday)</Text>
            <View style={styles.timePickerContainer}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Hour (0-23)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="18"
                  placeholderTextColor={colors.textSecondary}
                  value={charityHour}
                  onChangeText={setCharityHour}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={{ width: 20, alignItems: 'center', justifyContent: 'center', paddingTop: 28 }}>
                <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Minute (0-59)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={charityMinute}
                  onChangeText={setCharityMinute}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.charityInfoBox}>
              <Bell size={20} color={colors.primary} />
              <Text style={[styles.charityInfoText, { color: colors.textSecondary }]}>
                You&apos;ll receive a reminder every Thursday at {charityHour.padStart(2, '0')}:{charityMinute.padStart(2, '0')}
              </Text>
            </View>

            <Button title="Save Reminder" onPress={saveCharityReminder} />
          </View>
        </View>
      </Modal>

      {/* Tasbeeh Modal */}
      <Modal visible={tasbeehModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Tasbeeh</Text>
              <TouchableOpacity onPress={() => setTasbeehModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Tasbeeh Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="e.g., Subhanallah"
              placeholderTextColor={colors.textSecondary}
              value={tasbeehName}
              onChangeText={setTasbeehName}
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Target Count</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="e.g., 33"
              placeholderTextColor={colors.textSecondary}
              value={tasbeehCount}
              onChangeText={setTasbeehCount}
              keyboardType="number-pad"
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="e.g., Glorification of Allah"
              placeholderTextColor={colors.textSecondary}
              value={tasbeehDescription}
              onChangeText={setTasbeehDescription}
              multiline
              numberOfLines={3}
            />

            <Button title="Add Tasbeeh" onPress={addTasbeeh} />
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
    tasbeehCard: {
      marginBottom: 24,
    },
    tasbeehHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    tasbeehTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      flex: 1,
    },
    addTasbeehButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTasbeehContainer: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    emptyTasbeehText: {
      fontSize: 14,
      textAlign: 'center',
    },
    tasbeehItemCard: {
      marginBottom: 16,
      padding: 16,
    },
    tasbeehItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tasbeehItemName: {
      fontSize: 16,
      fontWeight: '600',
    },
    tasbeehItemDescription: {
      fontSize: 13,
      marginTop: 4,
    },
    tasbeehCountBadge: {
      backgroundColor: 'transparent',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 2,
    },
    tasbeehCountText: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    featureCard: {
      alignItems: 'center',
      padding: 32,
      marginBottom: 16,
    },
    featureTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 16,
    },
    featureSubtext: {
      fontSize: 14,
      marginTop: 4,
    },
    quranCard: {
      marginBottom: 16,
    },
    quranHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    quranTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    quranProgressContainer: {
      gap: 12,
    },
    quranProgressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    quranLabel: {
      fontSize: 14,
    },
    quranValue: {
      fontSize: 16,
      fontWeight: '600',
    },
    quranDate: {
      fontSize: 12,
      marginTop: 4,
    },
    quranEmptyContainer: {
      alignItems: 'center',
      gap: 16,
    },
    quranEmptyText: {
      fontSize: 14,
      textAlign: 'center',
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      marginTop: 12,
    },
    editButtonText: {
      fontSize: 16,
      fontWeight: '600',
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
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 8,
    },
    input: {
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      marginBottom: 8,
    },
    charityCard: {
      marginBottom: 16,
    },
    charityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    charityTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    charityProgressContainer: {
      gap: 12,
    },
    charityProgressRow: {
      gap: 4,
    },
    charityLabel: {
      fontSize: 14,
      marginBottom: 4,
    },
    charityValue: {
      fontSize: 16,
      fontWeight: '600',
    },
    charityDescription: {
      fontSize: 13,
      marginTop: 4,
    },
    charitySwitchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    charityEmptyContainer: {
      alignItems: 'center',
      gap: 16,
    },
    charityEmptyText: {
      fontSize: 14,
      textAlign: 'center',
    },
    charityInfoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginBottom: 16,
    },
    charityInfoText: {
      fontSize: 13,
      flex: 1,
    },
    timePickerContainer: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-end',
      marginBottom: 16,
    },
    timeLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
    },
    timeSeparator: {
      fontSize: 24,
      fontWeight: 'bold',
    },
  });
