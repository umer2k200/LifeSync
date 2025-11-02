import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, Fingerprint } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { showError, showSuccess } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { BiometricService } from '@/lib/biometric';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const { signIn, biometricSignIn } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkBiometricAvailability = async () => {
    const available = await BiometricService.isAvailable();
    const enabled = await BiometricService.isEnabled();
    setBiometricAvailable(available);
    setBiometricEnabled(enabled);

    // Auto-trigger biometric login once if available and enabled and credentials exist
    if (available && enabled && !hasAutoTriggered) {
      const credentials = await BiometricService.getCredentials();
      if (credentials) {
        setHasAutoTriggered(true);
        // Small delay to let UI render first
        setTimeout(() => {
          handleBiometricLogin();
        }, 500);
      }
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricAvailable || !biometricEnabled) {
      showError('Error', 'Biometric authentication is not available');
      return;
    }

    setBiometricLoading(true);
    try {
      const { error } = await biometricSignIn();

      if (error) {
        showError('Biometric Login Failed', error.message || 'Authentication failed');
        setBiometricLoading(false);
      } else {
        // Success - navigation happens automatically via _layout.tsx
        setBiometricLoading(false);
      }
    } catch (error) {
      showError('Error', 'Something went wrong with biometric authentication');
      setBiometricLoading(false);
    }
  };

  const validateEmail = (emailValue: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailValue.trim() && !emailRegex.test(emailValue.trim())) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showError('Error', 'Please enter your email address first');
      return;
    }

    if (!validateEmail(email)) {
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'lifesync://reset-password',
      });

      if (error) {
        showError('Error', error.message || 'Failed to send password reset email');
      } else {
        showSuccess(
          'Email Sent',
          'Check your email for a password reset link. You can close this dialog.',
        );
      }
    } catch (error) {
      showError('Error', 'Something went wrong. Please try again.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showError('Error', 'Please enter email and password');
      return;
    }

    if (!validateEmail(email)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email.trim(), password);

      if (error) {
        setLoading(false);
        showError('Login Failed', error.message || 'Invalid email or password');
        return;
      }

      // Wait a bit for state to update, then check if navigation happened
      // If still on login screen after 1 second, navigation might have failed
      setTimeout(() => {
        setLoading(false);
      }, 500);

      // Navigation happens automatically via _layout.tsx when user state updates
    } catch {
      setLoading(false);
      showError('Error', 'Something went wrong. Please try again.');
    }
  };

  const styles = createStyles(colors);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[colors.gradient1, colors.gradient2]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
          </View>
          <Text style={styles.title}>Welcome to LifeSync</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Mail size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, emailError && styles.inputError]}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError && text.trim()) {
                    validateEmail(text);
                  }
                }}
                onBlur={() => validateEmail(email)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

            <View style={[styles.inputContainer, { marginTop: 16 }]}>
              <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
              disabled={loading || forgotPasswordLoading}
            >
              {forgotPasswordLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                  Forgot Password?
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading || biometricLoading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {biometricAvailable && biometricEnabled && (
              <View style={styles.biometricContainer}>
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>
                <TouchableOpacity
                  style={[styles.biometricButton, { borderColor: colors.primary }]}
                  onPress={handleBiometricLogin}
                  disabled={loading || biometricLoading}
                >
                  {biometricLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Fingerprint size={24} color={colors.primary} />
                      <Text style={[styles.biometricButtonText, { color: colors.primary }]}>
                        Use Fingerprint
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                // Navigate to signup - this should work without auto-login
                router.push('/(auth)/signup');
              }}
              disabled={loading || biometricLoading}
            >
              <Text style={styles.linkText}>Don&apos;t have an account? Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    gradient: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 48,
      opacity: 0.9,
    },
    form: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputIcon: {
      marginLeft: 16,
    },
    input: {
      flex: 1,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      paddingLeft: 12,
    },
    inputError: {
      borderColor: colors.error,
    },
    eyeIcon: {
      marginRight: 16,
      padding: 4,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
    },
    forgotPasswordButton: {
      alignSelf: 'flex-end',
      marginTop: 8,
      paddingVertical: 8,
    },
    forgotPasswordText: {
      fontSize: 14,
      fontWeight: '500',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    linkButton: {
      marginTop: 16,
      alignItems: 'center',
      paddingVertical: 8,
    },
    linkText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '500',
    },
    biometricContainer: {
      marginTop: 24,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
    },
    dividerText: {
      marginHorizontal: 12,
      fontSize: 14,
    },
    biometricButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      gap: 8,
    },
    biometricButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
