import { Drawer } from 'expo-router/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Target, Dumbbell, ListTodo, DollarSign, Moon, Flame } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function DrawerLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textSecondary,
        drawerStyle: {
          backgroundColor: colors.card,
          width: 280,
        },
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
        },
        drawerItemStyle: {
          borderRadius: 12,
          marginHorizontal: 8,
          marginVertical: 2,
        },
        drawerContentContainerStyle: {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'Home',
          drawerIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="goals"
        options={{
          title: 'Goals',
          drawerIcon: ({ size, color }) => <Target size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="habits"
        options={{
          title: 'Habits',
          drawerIcon: ({ size, color }) => <Flame size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="workout"
        options={{
          title: 'Workout',
          drawerIcon: ({ size, color }) => <Dumbbell size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          drawerIcon: ({ size, color }) => <ListTodo size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          drawerIcon: ({ size, color }) => <DollarSign size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="islamic"
        options={{
          title: 'Islamic',
          drawerIcon: ({ size, color }) => <Moon size={size} color={color} />,
        }}
      />
    </Drawer>
  );
}
