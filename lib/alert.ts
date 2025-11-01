import { setGlobalAlert } from '@/components/StyledAlert';

/**
 * Show a styled alert dialog
 * @param title - Alert title
 * @param message - Alert message
 * @param type - Alert type (success, error, warning, info)
 * @param buttons - Optional array of buttons to show
 */
export const showAlert = (
  title: string,
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  buttons?: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'destructive' | 'cancel';
  }>
) => {
  setGlobalAlert(title, message, type, buttons);
};

// Convenience methods for common alert types
export const showSuccess = (title: string, message: string, onPress?: () => void) => {
  showAlert(title, message, 'success', [{ text: 'OK', onPress: onPress || (() => {}) }]);
};

export const showError = (title: string, message: string, onPress?: () => void) => {
  showAlert(title, message, 'error', [{ text: 'OK', onPress: onPress || (() => {}) }]);
};

export const showWarning = (title: string, message: string, onPress?: () => void) => {
  showAlert(title, message, 'warning', [{ text: 'OK', onPress: onPress || (() => {}) }]);
};

export const showInfo = (title: string, message: string, onPress?: () => void) => {
  showAlert(title, message, 'info', [{ text: 'OK', onPress: onPress || (() => {}) }]);
};

// For confirmation dialogs (e.g., "Are you sure?")
export const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  showAlert(title, message, 'warning', [
    { text: 'Cancel', onPress: onCancel || (() => {}), style: 'cancel' },
    { text: 'Confirm', onPress: onConfirm, style: 'default' },
  ]);
};

// For destructive confirmations (e.g., delete actions)
export const showConfirmDestructive = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  showAlert(title, message, 'error', [
    { text: 'Cancel', onPress: onCancel || (() => {}), style: 'cancel' },
    { text: 'Delete', onPress: onConfirm, style: 'destructive' },
  ]);
};

