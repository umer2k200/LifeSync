import { Drawer } from 'expo-router/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Target, Dumbbell, ListTodo, DollarSign, Moon, Flame, ShoppingCart, Bike, MapPin, Settings, BookOpen } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

// Authorized emails for shopping list feature
const AUTHORIZED_SHOPPING_LIST_EMAILS = [
  'umarzeeshan708@gmail.com',
  'umarzeeshan709@gmail.com',
];

// Authorized emails for bike feature
const AUTHORIZED_BIKE_EMAILS = [
  'umarzeeshan708@gmail.com',
  'umarzeeshan709@gmail.com',
];


export default function DrawerLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
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
      {/* Primary Navigation */}
      <Drawer.Screen
        name="index"
        options={{
          title: 'Home',
          drawerIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      
      {/* Productivity & Personal Development */}
      <Drawer.Screen
        name="goals"
        options={{
          title: 'Goals',
          drawerIcon: ({ size, color }) => <Target size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          drawerIcon: ({ size, color }) => <ListTodo size={size} color={color} />,
        }}
      />
      
      {/* Health & Fitness */}
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
      
      {/* Finance */}
      <Drawer.Screen
        name="expenses"
        options={{
          title: 'Finance',
          drawerIcon: ({ size, color }) => <DollarSign size={size} color={color} />,
        }}
      />
      
      {/* Planning & Organization */}
      <Drawer.Screen
        name="travel"
        options={{
          title: 'Travel',
          drawerIcon: ({ size, color }: { size: number; color: string }) => <MapPin size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="notes"
        options={{
          title: 'Notes',
          drawerIcon: ({ size, color }: { size: number; color: string }) => <BookOpen size={size} color={color} />,
        }}
      />
      
      {/* Shopping & Specialized */}
      <Drawer.Screen
        name="shopping-list"
        options={(route) => {
          const isAuthorized = user?.email && AUTHORIZED_SHOPPING_LIST_EMAILS.includes(user.email);
          const options: any = {
            title: 'Buy List',
            drawerIcon: ({ size, color }: { size: number; color: string }) => <ShoppingCart size={size} color={color} />,
          };
          if (!isAuthorized) {
            options.drawerItemStyle = { height: 0, opacity: 0, overflow: 'hidden', margin: 0, padding: 0 };
          }
          return options;
        }}
      />
      <Drawer.Screen
        name="bike"
        options={(route) => {
          const isAuthorized = user?.email && AUTHORIZED_BIKE_EMAILS.includes(user.email);
          const options: any = {
            title: 'Bike',
            drawerIcon: ({ size, color }: { size: number; color: string }) => <Bike size={size} color={color} />,
          };
          if (!isAuthorized) {
            options.drawerItemStyle = { height: 0, opacity: 0, overflow: 'hidden', margin: 0, padding: 0 };
          }
          return options;
        }}
      />
      
      {/* Spiritual */}
      <Drawer.Screen
        name="islamic"
        options={{
          title: 'Islamic',
          drawerIcon: ({ size, color }) => <Moon size={size} color={color} />,
        }}
      />
      
      {/* Settings */}
      <Drawer.Screen
        name="settings"
        options={{
          title: 'Settings',
          drawerIcon: ({ size, color }: { size: number; color: string }) => <Settings size={size} color={color} />,
        }}
      />
    </Drawer>
  );
}
