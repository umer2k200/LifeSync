import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrency, CURRENCIES } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Moon, Sun, DollarSign, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { showSuccess } from '@/lib/alert';

const WELCOME_KEY = '@lifesync_welcome_completed';

export default function WelcomeScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { currency, setCurrency, loading: currencyLoading } = useCurrency();
  const { user } = useAuth();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(isDark);
  const [selectedCurrency, setSelectedCurrency] = useState<typeof CURRENCIES[0]>(CURRENCIES[0]);
  const [loading, setLoading] = useState(false);

  // Update selectedCurrency when currency loads
  useEffect(() => {
    if (currency && !currencyLoading) {
      setSelectedCurrency(currency);
    }
  }, [currency, currencyLoading]);

  const handleComplete = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Update theme if changed
      if (darkMode !== isDark) {
        const themeToSet = darkMode ? 'dark' : 'light';
        await supabase
          .from('profiles')
          // @ts-ignore
          .update({ theme: themeToSet })
          .eq('id', user.id);
        
        // Save to AsyncStorage
        await AsyncStorage.setItem('@lifesync_theme', themeToSet);
        
        // Apply theme change by toggling if needed
        if (darkMode && !isDark) {
          // Need to switch to dark
          toggleTheme();
        } else if (!darkMode && isDark) {
          // Need to switch to light
          toggleTheme();
        }
      }

      // Update currency
      await setCurrency(selectedCurrency);
      
      // Save currency to database
      await supabase
        .from('profiles')
        // @ts-ignore
        .update({ currency: JSON.stringify(selectedCurrency) })
        .eq('id', user.id);

      // Save welcome completion
      await AsyncStorage.setItem(WELCOME_KEY, 'true');

      showSuccess('Welcome!', 'Your preferences have been saved.');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving preferences:', error);
      // Still navigate even if save fails
      await AsyncStorage.setItem(WELCOME_KEY, 'true');
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome!</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Let&apos;s set up your preferences
          </Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              {darkMode ? <Moon size={24} color={colors.primary} /> : <Sun size={24} color={colors.primary} />}
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Toggle dark mode on or off
                </Text>
              </View>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.currencyHeader}>
            <DollarSign size={24} color={colors.primary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Currency</Text>
          </View>
          <Text style={[styles.settingDescription, { color: colors.textSecondary, marginBottom: 16 }]}>
            Select your preferred currency
          </Text>
          <View style={styles.currencyGrid}>
            {CURRENCIES.map((curr) => (
              <TouchableOpacity
                key={curr.code}
                style={[
                  styles.currencyOption,
                  {
                    backgroundColor: selectedCurrency.code === curr.code ? colors.primary : colors.surface,
                    borderColor: selectedCurrency.code === curr.code ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedCurrency(curr)}
              >
                <Text
                  style={[
                    styles.currencySymbol,
                    {
                      color: selectedCurrency.code === curr.code ? '#FFFFFF' : colors.text,
                    },
                  ]}
                >
                  {curr.symbol}
                </Text>
                <Text
                  style={[
                    styles.currencyCode,
                    {
                      color: selectedCurrency.code === curr.code ? '#FFFFFF' : colors.textSecondary,
                    },
                  ]}
                >
                  {curr.code}
                </Text>
                {selectedCurrency.code === curr.code && (
                  <View style={styles.checkIcon}>
                    <Check size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Button
          title="Continue"
          onPress={handleComplete}
          disabled={loading}
          style={styles.button}
        />
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
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 20,
      paddingTop: 60,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
    },
    card: {
      marginBottom: 20,
      padding: 20,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      flex: 1,
    },
    settingInfo: {
      flex: 1,
    },
    settingLabel: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
    },
    currencyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    currencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    currencyOption: {
      width: '30%',
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    currencySymbol: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    currencyCode: {
      fontSize: 12,
      fontWeight: '500',
    },
    checkIcon: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    button: {
      marginTop: 20,
      marginBottom: 40,
    },
  });

