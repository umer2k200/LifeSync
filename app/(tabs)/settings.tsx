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
import { useCurrency, CURRENCIES } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Moon, Sun, User, Bell, Database, Fingerprint, Lock, Eye, EyeOff, X, KeyRound, Info, DollarSign, Check } from 'lucide-react-native';
import { SyncService } from '@/lib/sync';
import { NotificationService } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import { showSuccess, showError, showWarning, showConfirm, showInfo } from '@/lib/alert';
import { BiometricService } from '@/lib/biometric';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { colors, toggleTheme, isDark } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { user, profile, signOut, signIn } = useAuth();
  const router = useRouter();
  const [currencyModalVisible, setCurrencyModalVisible] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<boolean>(false);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordLoading, setPasswordLoading] = useState<boolean>(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState<boolean>(false);

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

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      showError('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      showError('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Error', 'New passwords do not match');
      return;
    }

    if (!user || !profile?.email) {
      showError('Error', 'User not logged in');
      return;
    }

    setChangePasswordLoading(true);
    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await signIn(profile.email, currentPassword);
      if (signInError) {
        showError('Invalid Password', 'Current password is incorrect. Please try again.');
        setChangePasswordLoading(false);
        return;
      }

      // Password is correct, now update it
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        showError('Error', updateError.message || 'Failed to change password. Please try again.');
        setChangePasswordLoading(false);
        return;
      }

      showSuccess('Success', 'Password changed successfully!');
      setChangePasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordLoading(false);
    } catch (error) {
      console.error('Error changing password:', error);
      showError('Error', 'Failed to change password. Please try again.');
      setChangePasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    showConfirm('Sign Out', 'Are you sure you want to sign out?', async () => {
      // Unregister push notifications before signing out
      if (user?.id) {
        try {
          await NotificationService.unregisterAllPushNotifications(user.id);
        } catch (error) {
          console.error('Error unregistering push notifications:', error);
          // Continue with sign out even if unregistering fails
        }
      }
      
      await signOut();
      router.replace('/(auth)/login');
    });
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" subtitle="Manage your preferences" />

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

        <TouchableOpacity onPress={() => setCurrencyModalVisible(true)}>
          <Card style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <DollarSign size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Currency</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    {currency.symbol} ({currency.code})
                  </Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {currency.code}
              </Text>
            </View>
          </Card>
        </TouchableOpacity>

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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Security</Text>
        {biometricAvailable && (
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
        )}
        <TouchableOpacity onPress={() => setChangePasswordModalVisible(true)}>
          <Card style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <KeyRound size={20} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Change Password</Text>
              </View>
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

        {/* App Info */}
        <View style={styles.appInfoContainer}>
          <View style={styles.appInfoRow}>
            <Info size={16} color={colors.textSecondary} />
            <Text style={[styles.appInfoText, { color: colors.textSecondary }]}>
              LifeSync v{Constants.expoConfig?.version || '1.0.0'}
            </Text>
          </View>
          <Text style={[styles.appInfoDescription, { color: colors.textSecondary }]}>
            Your all-in-one companion for managing life
          </Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setChangePasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
              <TouchableOpacity onPress={() => {
                setChangePasswordModalVisible(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }} disabled={changePasswordLoading}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.passwordInputContainer, { marginTop: 20 }]}>
              <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="Current Password"
                placeholderTextColor={colors.textSecondary}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!changePasswordLoading}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                style={styles.eyeIcon}
                disabled={changePasswordLoading}
              >
                {showCurrentPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.passwordInputContainer}>
              <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="New Password"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!changePasswordLoading}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeIcon}
                disabled={changePasswordLoading}
              >
                {showNewPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.passwordInputContainer}>
              <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!changePasswordLoading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                disabled={changePasswordLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setChangePasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                variant="outline"
                disabled={changePasswordLoading}
                style={{ ...styles.modalButton, marginRight: 8, borderColor: colors.border }}
                textStyle={{ color: colors.text }}
              />
              <Button
                title={changePasswordLoading ? 'Changing...' : 'Change Password'}
                onPress={handleChangePassword}
                disabled={changePasswordLoading || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim() || newPassword !== confirmPassword || newPassword.length < 6}
                style={{ ...styles.modalButton, marginLeft: 8 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Currency Selection Modal */}
      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary, marginBottom: 20 }]}>
              Choose your preferred currency
            </Text>

            <ScrollView 
              style={{ maxHeight: 400 }}
              contentContainerStyle={styles.currencyScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.currencyGrid}>
                {CURRENCIES.map((curr) => (
                  <TouchableOpacity
                    key={curr.code}
                    style={[
                      styles.currencyOption,
                      {
                        backgroundColor: currency.code === curr.code ? colors.primary : colors.surface,
                        borderColor: currency.code === curr.code ? colors.primary : colors.border,
                        borderWidth: currency.code === curr.code ? 2 : 1,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={async () => {
                      await setCurrency(curr);
                      showSuccess('Success', 'Currency updated successfully!');
                      setCurrencyModalVisible(false);
                    }}
                  >
                    {currency.code === curr.code && (
                      <View style={[styles.checkIcon, { backgroundColor: colors.success }]}>
                        <Check size={14} color="#FFFFFF" />
                      </View>
                    )}
                    <Text
                      style={[
                        styles.currencySymbol,
                        {
                          color: currency.code === curr.code ? '#FFFFFF' : colors.text,
                        },
                      ]}
                    >
                      {curr.symbol}
                    </Text>
                    <Text
                      style={[
                        styles.currencyCode,
                        {
                          color: currency.code === curr.code ? '#FFFFFF' : colors.text,
                          fontWeight: currency.code === curr.code ? '600' : '500',
                        },
                      ]}
                    >
                      {curr.code}
                    </Text>
                    <Text
                      style={[
                        styles.currencyName,
                        {
                          color: currency.code === curr.code ? 'rgba(255, 255, 255, 0.8)' : colors.textSecondary,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {curr.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setCurrencyModalVisible(false)}
                variant="outline"
                style={{ ...styles.modalButton, borderColor: colors.border }}
                textStyle={{ color: colors.text }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    appInfoContainer: {
      marginTop: 32,
      marginBottom: 16,
      alignItems: 'center',
      paddingVertical: 16,
    },
    appInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    appInfoText: {
      fontSize: 14,
      fontWeight: '500',
    },
    appInfoDescription: {
      fontSize: 12,
      marginTop: 4,
    },
    currencyScrollContent: {
      paddingBottom: 8,
    },
    currencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    currencyOption: {
      width: '31%',
      minHeight: 100,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      paddingVertical: 16,
      paddingHorizontal: 8,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    currencySymbol: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 6,
    },
    currencyCode: {
      fontSize: 13,
      fontWeight: '500',
      marginBottom: 4,
    },
    currencyName: {
      fontSize: 10,
      textAlign: 'center',
      paddingHorizontal: 2,
      lineHeight: 12,
    },
    checkIcon: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
