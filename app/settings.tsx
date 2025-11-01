import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowLeft, Moon, Sun, User, Bell, Database, LogOut } from 'lucide-react-native';
import { SyncService } from '@/lib/sync';
import { NotificationService } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import { showSuccess, showError, showWarning, showConfirm, showInfo } from '@/lib/alert';

export default function SettingsScreen() {
  const { colors, theme, toggleTheme, isDark } = useTheme();
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [notificationPermission, setNotificationPermission] = useState<boolean>(false);

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationPermission(status === 'granted');
  };

  const handleNotificationPermission = async () => {
    const granted = await NotificationService.requestPermissions();
    setNotificationPermission(granted);
    
    if (granted) {
      showSuccess('Success', 'Notification permissions granted!');
    } else {
      showError('Permission Denied', 'Please enable notifications in your device settings to receive reminders.');
    }
  };

  const handleSync = async () => {
    if (!SyncService.getConnectionStatus()) {
      showWarning('Offline', 'Cannot sync while offline');
      return;
    }

    showInfo('Syncing', 'Syncing all data with server...');
    await SyncService.syncAllData();
    showSuccess('Success', 'All data synced successfully!');
  };

  const handleSignOut = () => {
    showConfirm('Sign Out', 'Are you sure you want to sign out?', async () => {
      await signOut();
      router.replace('/(auth)/login');
    });
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.profileIcon}>
            <User size={32} color={colors.primary} />
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {profile?.full_name || 'User'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {profile?.email}
          </Text>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        <Card style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              {isDark ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
              <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data</Text>
        <TouchableOpacity onPress={handleSync}>
          <Card style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Database size={20} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Sync Data</Text>
              </View>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {SyncService.getConnectionStatus() ? 'Online' : 'Offline'}
              </Text>
            </View>
          </Card>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
        <TouchableOpacity onPress={handleNotificationPermission}>
          <Card style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Bell size={20} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Push Notifications</Text>
              </View>
              <Text style={[styles.settingValue, { color: notificationPermission ? colors.success : colors.error }]}>
                {notificationPermission ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </Card>
        </TouchableOpacity>

        <View style={styles.buttonContainer}>
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="outline"
            style={{ borderColor: colors.error }}
            textStyle={{ color: colors.error }}
          />
        </View>

        <View style={{ height: 80 }} />
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 60,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    profileCard: {
      alignItems: 'center',
      padding: 32,
      marginBottom: 24,
    },
    profileIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${colors.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    profileName: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    profileEmail: {
      fontSize: 14,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 12,
      marginTop: 8,
    },
    settingCard: {
      marginBottom: 12,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
    },
    settingValue: {
      fontSize: 14,
    },
    buttonContainer: {
      marginTop: 24,
    },
  });
