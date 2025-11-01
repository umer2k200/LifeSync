import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { CheckCircle2, AlertCircle, X, AlertTriangle, Info } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface StyledAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  buttons?: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'destructive' | 'cancel';
  }>;
}

export const StyledAlert: React.FC<StyledAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  onClose,
  buttons = [{ text: 'OK', onPress: onClose }],
}) => {
  const { colors } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          color: colors.success,
          bgColor: `${colors.success}15`,
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: colors.error,
          bgColor: `${colors.error}15`,
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: colors.warning,
          bgColor: `${colors.warning}15`,
        };
      default:
        return {
          icon: Info,
          color: colors.primary,
          bgColor: `${colors.primary}15`,
        };
    }
  };

  const { icon: Icon, color, bgColor } = getIconAndColor();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.alertCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
              <Icon size={48} color={color} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => {
                const isCancel = button.style === 'cancel';
                const isDestructive = button.style === 'destructive';
                const isLast = index === buttons.length - 1;
                const isMultiple = buttons.length > 1;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isMultiple && !isLast && styles.buttonWithMargin,
                      isCancel && { backgroundColor: colors.surface },
                      isDestructive && { backgroundColor: colors.error },
                      !isCancel && !isDestructive && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                    onPress={() => {
                      button.onPress();
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isDestructive && { color: '#FFFFFF' },
                        !isDestructive && !isCancel && { color: '#FFFFFF' },
                        isCancel && { color: colors.text },
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: width * 0.85,
      maxWidth: 400,
    },
    alertCard: {
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    buttonContainer: {
      width: '100%',
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    buttonWithMargin: {
      marginRight: 0,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });

// Global alert state management
let alertState: {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  buttons: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'destructive' | 'cancel';
  }>;
  onClose: () => void;
} = {
  visible: false,
  title: '',
  message: '',
  type: 'info',
  buttons: [],
  onClose: () => {},
};

let setAlertState: React.Dispatch<React.SetStateAction<typeof alertState>> | null = null;

export const setGlobalAlert = (
  title: string,
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  buttons?: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'destructive' | 'cancel';
  }>
) => {
  if (setAlertState) {
    setAlertState({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK', onPress: () => {} }],
      onClose: () => {
        setAlertState?.((prev) => ({ ...prev, visible: false }));
      },
    });
  }
};

export const GlobalAlert: React.FC = () => {
  const [state, setState] = React.useState(alertState);

  useEffect(() => {
    setAlertState = setState;
  }, []);

  return (
    <StyledAlert
      visible={state.visible}
      title={state.title}
      message={state.message}
      type={state.type}
      onClose={state.onClose}
      buttons={state.buttons}
    />
  );
};

