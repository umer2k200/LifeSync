import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowLeft, Moon, Sun, User, Bell, Database, Fingerprint, Lock, Eye, EyeOff, X } from 'lucide-react-native';
import { SyncService } from '@/lib/sync';
import { NotificationService } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import { showSuccess, showError, showWarning, showConfirm, showInfo } from '@/lib/alert';
import { BiometricService } from '@/lib/biometric';

export default function SettingsScreen() {
  const { colors, toggleTheme, isDark } = useTheme();
  const { user, profile, signOut, signIn } = useAuth();
  const router = useRouter();
  const [notificationPermission, setNotificationPermission] = useState<boolean>(false);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordLoading, setPasswordLoading] = useState<boolean>(false);

  useEffect(() => {
    checkNotificationPermission();
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    const available = await BiometricService.isAvailable();
    const enabled = await BiometricService.isEnabled();
    const type = await BiometricService.getBiometricType();
    setBiometricAvailable(available);
    setBiometricEnabled(enabled);
    setBiometricType(type);
  };

  const handleBiometricToggle = async (value: boolean) => {
    try {
      if (value) {
        // First check if user has credentials saved (from previous login)
        const credentials = await BiometricService.getCredentials();
        if (!credentials) {
          // If user is logged in but has no credentials, show password modal
          if (user && profile?.email) {
            setPasswordModalVisible(true);
            return;
          } else {
            // User not logged in
            showError(
              'No Credentials',
              'Please login with email and password first to enable biometric login.',
            );
            return;
          }
        }

        // Then authenticate to enable biometric
        const authenticated = await BiometricService.authenticate();
        if (!authenticated) {
          showError('Authentication Failed', 'Biometric authentication failed. Please try again.');
          return;
        }

        await BiometricService.enable();
        setBiometricEnabled(true);
        showSuccess('Success', `${biometricType} login enabled!`);
      } else {
        await BiometricService.disable();
        setBiometricEnabled(false);
        showSuccess('Success', `${biometricType} login disabled.`);
      }
    } catch (error) {
      console.error('Error toggling biometric:', error);
      showError('Error', 'Failed to update biometric settings');
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      showError('Error', 'Please enter your password');
      return;
    }

    if (!user || !profile?.email) {
      showError('Error', 'User not logged in');
      return;
    }

    setPasswordLoading(true);
    try {
      // Verify password by attempting to sign in
      const { error } = await signIn(profile.email, password);
      if (error) {
        showError('Invalid Password', 'The password you entered is incorrect. Please try again.');
        setPasswordLoading(false);
        return;
      }

      // Password is correct, save credentials and enable biometric
      await BiometricService.saveCredentials(profile.email, password);

      // Then authenticate with biometric
      const authenticated = await BiometricService.authenticate();
      if (!authenticated) {
        setPasswordLoading(false);
        setPasswordModalVisible(false);
        setPassword('');
        showError('Authentication Failed', 'Biometric authentication failed. Please try again.');
        return;
      }

      await BiometricService.enable();
      setBiometricEnabled(true);
      setPasswordLoading(false);
      setPasswordModalVisible(false);
      setPassword('');
      showSuccess('Success', `${biometricType} login enabled!`);
    } catch (error) {
      console.error('Error verifying password:', error);
      showError('Error', 'Failed to verify password');
      setPasswordLoading(false);
    }
  };

  const handlePasswordModalClose = () => {
    setPasswordModalVisible(false);
    setPassword('');
    setShowPassword(false);
  };

  const checkNotificationPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationPermission(status === 'granted');
  };

  const handleNotificationPermission = async () => {
    if (!user) {
      showError('Error', 'Please log in to enable push notifications');
      return;
    }

    const granted = await NotificationService.requestPermissions();
    setNotificationPermission(granted);
    
    if (granted) {
      // Register for push notifications
      const token = await NotificationService.registerForPushNotifications(user.id);
      if (token) {
        // Schedule all notifications
        const { NotificationScheduler } = await import('@/lib/notificationScheduler');
        await NotificationScheduler.scheduleAllNotifications(user.id);
        showSuccess('Success', 'Push notifications enabled! You will now receive notifications.');
      } else {
        showWarning('Warning', 'Notification permissions granted, but could not register push token. You may need to restart the app.');
      }
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

        {biometricAvailable && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Security</Text>
            <Card style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Fingerprint size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{biometricType} Login</Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      Use {biometricType.toLowerCase()} to login quickly
                    </Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </Card>
          </>
        )}

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

      {/* Password Modal for Enabling Biometric */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handlePasswordModalClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Enable {biometricType} Login
              </Text>
              <TouchableOpacity onPress={handlePasswordModalClose} disabled={passwordLoading}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Please enter your password to enable {biometricType.toLowerCase()} login. This will
              save your credentials securely.
            </Text>

            <View style={[styles.passwordInputContainer, { marginTop: 20 }]}>
              <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!passwordLoading}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                disabled={passwordLoading}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={handlePasswordModalClose}
                variant="outline"
                disabled={passwordLoading}
                style={{ ...styles.modalButton, marginRight: 8, borderColor: colors.border }}
                textStyle={{ color: colors.text }}
              />
              <Button
                title={passwordLoading ? 'Verifying...' : 'Enable'}
                onPress={handlePasswordSubmit}
                disabled={passwordLoading || !password.trim()}
                style={{ ...styles.modalButton, marginLeft: 8 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
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
    settingDescription: {
      fontSize: 12,
      marginTop: 2,
    },
    settingValue: {
      fontSize: 14,
    },
    buttonContainer: {
      marginTop: 24,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      padding: 24,
      backgroundColor: colors.card,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    modalMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      marginBottom: 20,
    },
    inputIcon: {
      marginRight: 12,
    },
    passwordInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    eyeIcon: {
      padding: 4,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    modalButton: {
      flex: 1,
    },
  });
