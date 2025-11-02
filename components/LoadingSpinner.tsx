import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  fullScreen?: boolean;
  message?: string;
}

export const LoadingSpinner = ({ size = 'large', fullScreen = false, message }: LoadingSpinnerProps) => {
  const { colors } = useTheme();

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size={size} color={colors.primary} />
        {message && (
          <View style={styles.messageContainer}>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={colors.primary} />
      {message && (
        <View style={styles.messageContainer}>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageContainer: {
    marginTop: 12,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
  },
});

