import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export type Currency = {
  symbol: string;
  code: string;
  name: string;
};

export const CURRENCIES: Currency[] = [
  { symbol: 'Rs.', code: 'PKR', name: 'Pakistani Rupee' },
  { symbol: '$', code: 'USD', name: 'US Dollar' },
  { symbol: '€', code: 'EUR', name: 'Euro' },
  { symbol: '£', code: 'GBP', name: 'British Pound' },
  { symbol: '₹', code: 'INR', name: 'Indian Rupee' },
  { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
  { symbol: 'A$', code: 'AUD', name: 'Australian Dollar' },
  { symbol: 'C$', code: 'CAD', name: 'Canadian Dollar' },
  { symbol: 'CHF', code: 'CHF', name: 'Swiss Franc' },
  { symbol: '¥', code: 'CNY', name: 'Chinese Yuan' },
];

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => Promise<void>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<Currency>(CURRENCIES[0]); // Default to PKR
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrency();
    
    // Listen for auth changes to load currency from database
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Load currency from database when user logs in
        await loadCurrencyFromDatabase(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCurrency = async () => {
    try {
      // First try to load from database if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadCurrencyFromDatabase(session.user.id);
      } else {
        // Fallback to AsyncStorage if not logged in, default to PKR if not set
        const savedCurrencyJson = await AsyncStorage.getItem('@lifesync_currency');
        if (savedCurrencyJson) {
          try {
            const savedCurrency = JSON.parse(savedCurrencyJson);
            if (CURRENCIES.find(c => c.code === savedCurrency.code)) {
              setCurrencyState(savedCurrency);
            }
          } catch (e) {
            console.error('Error parsing saved currency:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error loading currency:', error);
      // Fallback to AsyncStorage on error
      try {
        const savedCurrencyJson = await AsyncStorage.getItem('@lifesync_currency');
        if (savedCurrencyJson) {
          try {
            const savedCurrency = JSON.parse(savedCurrencyJson);
            if (CURRENCIES.find(c => c.code === savedCurrency.code)) {
              setCurrencyState(savedCurrency);
            }
          } catch (e) {
            console.error('Error parsing saved currency:', e);
          }
        }
      } catch (storageError) {
        console.error('Error loading currency from storage:', storageError);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencyFromDatabase = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('currency')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading currency from database:', error);
        // Fallback to AsyncStorage
        const savedCurrencyJson = await AsyncStorage.getItem('@lifesync_currency');
        if (savedCurrencyJson) {
          try {
            const savedCurrency = JSON.parse(savedCurrencyJson);
            if (CURRENCIES.find(c => c.code === savedCurrency.code)) {
              setCurrencyState(savedCurrency);
            }
          } catch (e) {
            console.error('Error parsing saved currency:', e);
          }
        }
        return;
      }

      // Type assertion for Supabase query result
      const currencyData = data as { currency?: string } | null;
      
      if (currencyData?.currency) {
        try {
          const parsedCurrency = JSON.parse(currencyData.currency);
          if (CURRENCIES.find(c => c.code === parsedCurrency.code)) {
            setCurrencyState(parsedCurrency);
            // Also save to AsyncStorage for offline access
            await AsyncStorage.setItem('@lifesync_currency', JSON.stringify(parsedCurrency));
          }
        } catch (e) {
          console.error('Error parsing currency from database:', e);
        }
      } else {
        // No currency in database - default to PKR
        const defaultCurrency = CURRENCIES[0];
        setCurrencyState(defaultCurrency);
        await AsyncStorage.setItem('@lifesync_currency', JSON.stringify(defaultCurrency));
        // Save to database
        await supabase
          .from('profiles')
          // @ts-ignore - Supabase type inference issue
          .update({ currency: JSON.stringify(defaultCurrency) })
          .eq('id', userId);
      }
    } catch (error) {
      console.error('Error loading currency from database:', error);
      // Fallback to AsyncStorage
      try {
        const savedCurrencyJson = await AsyncStorage.getItem('@lifesync_currency');
        if (savedCurrencyJson) {
          try {
            const savedCurrency = JSON.parse(savedCurrencyJson);
            if (CURRENCIES.find(c => c.code === savedCurrency.code)) {
              setCurrencyState(savedCurrency);
            }
          } catch (e) {
            console.error('Error parsing saved currency:', e);
          }
        }
      } catch (storageError) {
        console.error('Error loading currency from storage:', storageError);
      }
    }
  };

  const setCurrency = async (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    
    try {
      // Save to AsyncStorage for immediate access
      await AsyncStorage.setItem('@lifesync_currency', JSON.stringify(newCurrency));
      
      // Also save to database if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from('profiles')
          // @ts-ignore - Supabase type inference issue
          .update({ currency: JSON.stringify(newCurrency) })
          .eq('id', session.user.id);

        if (error) {
          console.error('Error saving currency to database:', error);
        }
      }
    } catch (error) {
      console.error('Error saving currency:', error);
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
};

