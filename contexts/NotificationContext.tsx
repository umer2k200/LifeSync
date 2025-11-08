import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { NotificationService } from '@/lib/notifications';

type NotificationPermissionState = 'unknown' | 'granted' | 'denied';

interface NotificationContextValue {
  status: NotificationPermissionState;
  isGranted: boolean;
  isDenied: boolean;
  refreshPermissions: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<NotificationPermissionState>('unknown');

  const refreshPermissions = useCallback(async () => {
    try {
      const enabled = await NotificationService.areNotificationsEnabled();
      setStatus(enabled ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error refreshing notification permissions:', error);
      setStatus('denied');
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      const granted = await NotificationService.requestPermissions();
      setStatus(granted ? 'granted' : 'denied');
      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      setStatus('denied');
      return false;
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  const value = useMemo<NotificationContextValue>(() => ({
    status,
    isGranted: status === 'granted',
    isDenied: status === 'denied',
    refreshPermissions,
    requestPermissions,
  }), [refreshPermissions, requestPermissions, status]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

