import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@lifesync_biometric_enabled';
const CREDENTIALS_KEY = 'lifesync_credentials';

export interface BiometricCredentials {
  email: string;
  password: string;
}

export class BiometricService {
  /**
   * Check if biometric authentication is available on the device
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return false;

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Get the supported authentication types
   */
  static async getSupportedTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('Error getting supported types:', error);
      return [];
    }
  }

  /**
   * Check if biometric is enabled in settings
   */
  static async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled:', error);
      return false;
    }
  }

  /**
   * Enable biometric authentication
   */
  static async enable(): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    } catch (error) {
      console.error('Error enabling biometric:', error);
      throw error;
    }
  }

  /**
   * Disable biometric authentication
   */
  static async disable(): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
      // Also remove stored credentials when disabling
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    } catch (error) {
      console.error('Error disabling biometric:', error);
      throw error;
    }
  }

  /**
   * Save user credentials securely for biometric login
   */
  static async saveCredentials(email: string, password: string): Promise<void> {
    try {
      const credentials: BiometricCredentials = { email, password };
      await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials));
    } catch (error) {
      console.error('Error saving credentials:', error);
      throw error;
    }
  }

  /**
   * Get saved credentials
   */
  static async getCredentials(): Promise<BiometricCredentials | null> {
    try {
      const credentialsStr = await SecureStore.getItemAsync(CREDENTIALS_KEY);
      if (!credentialsStr) return null;
      return JSON.parse(credentialsStr) as BiometricCredentials;
    } catch (error) {
      console.error('Error getting credentials:', error);
      return null;
    }
  }

  /**
   * Clear saved credentials
   */
  static async clearCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    } catch (error) {
      console.error('Error clearing credentials:', error);
    }
  }

  /**
   * Authenticate using biometric
   */
  static async authenticate(): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to login',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use password',
      });

      return result.success;
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return false;
    }
  }

  /**
   * Get biometric type name for display
   */
  static async getBiometricType(): Promise<string> {
    try {
      const types = await this.getSupportedTypes();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'Face ID';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'Fingerprint';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris';
      }
      return 'Biometric';
    } catch (error) {
      console.error('Error getting biometric type:', error);
      return 'Biometric';
    }
  }
}

