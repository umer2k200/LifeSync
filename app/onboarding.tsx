import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import {
  Target,
  CheckCircle2,
  DollarSign,
  BookOpen,
  Sparkles,
  ChevronLeft,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppEventBus } from '@/lib/eventBus';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = '@lifesync_onboarding_completed';

interface OnboardingSlide {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  gradientColors: string[];
}

const slides: OnboardingSlide[] = [
  {
    icon: Sparkles,
    title: 'Welcome to LifeSync',
    description: 'Your all-in-one companion for managing goals, habits, tasks, expenses, and more. Everything you need to stay organized in one place.',
    gradientColors: ['#6A5ACD', '#8B5CF6'],
  },
  {
    icon: Target,
    title: 'Set & Track Goals',
    description: 'Create meaningful goals with milestones and track your progress. Achieve your dreams with visual progress tracking.',
    gradientColors: ['#10B981', '#14B8A6'],
  },
  {
    icon: CheckCircle2,
    title: 'Build Better Habits',
    description: 'Track daily habits, build streaks, and maintain consistency. Monitor your water intake and fitness activities.',
    gradientColors: ['#F59E0B', '#F97316'],
  },
  {
    icon: DollarSign,
    title: 'Manage Your Finances',
    description: 'Track expenses, monitor spending patterns, and manage loans. Get insights into your financial health with analytics.',
    gradientColors: ['#EF4444', '#EC4899'],
  },
  {
    icon: BookOpen,
    title: 'Spiritual Journey',
    description: 'Track Quran reading progress, use Tasbeeh counter, and set charity reminders. Enhance your spiritual growth.',
    gradientColors: ['#8B5CF6', '#6A5ACD'],
  },
];

export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: (currentIndex + 1) * width,
        animated: true,
      });
    } else {
      completeOnboarding();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      scrollViewRef.current?.scrollTo({
        x: (currentIndex - 1) * width,
        animated: true,
      });
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      // Save to AsyncStorage first
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      
      // Verify it was saved - if not, try again
      let saved = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (saved !== 'true') {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        saved = await AsyncStorage.getItem(ONBOARDING_KEY);
      }
      
      // Only navigate if we confirmed it was saved
      if (saved === 'true') {
        // Use a slight delay to ensure state propagation
        AppEventBus.emit('onboardingCompleted', undefined);
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 200);
      } else {
        // If still not saved, try navigating anyway
        AppEventBus.emit('onboardingCompleted', undefined);
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
      AppEventBus.emit('onboardingCompleted', undefined);
      // Even if saving fails, navigate to login
      router.replace('/(auth)/login');
    }
  };

  const IconComponent = slides[currentIndex].icon;

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => {
          const SlideIcon = slide.icon;
          return (
            <View key={index} style={styles.slide}>
              <LinearGradient
                colors={slide.gradientColors as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
              >
                <View style={styles.iconContainer}>
                  <SlideIcon size={80} color="#FFFFFF" strokeWidth={1.5} />
                </View>
                <View style={styles.content}>
                  <Text style={styles.title}>{slide.title}</Text>
                  <Text style={styles.description}>{slide.description}</Text>
                </View>
              </LinearGradient>
            </View>
          );
        })}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === currentIndex && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {currentIndex > 0 && (
          <TouchableOpacity
            style={styles.navButton}
            onPress={handlePrevious}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        
        <View style={styles.spacer} />

        {currentIndex < slides.length - 1 && (
          <TouchableOpacity
            style={[styles.skipButton, { borderColor: colors.border }]}
            onPress={handleSkip}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        )}

        <View style={{ width: 120, marginLeft: 12 }}>
          <Button
            title={currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
            onPress={handleNext}
          />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    slide: {
      width,
      flex: 1,
    },
    gradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    iconContainer: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 48,
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 16,
    },
    description: {
      fontSize: 18,
      color: 'rgba(255, 255, 255, 0.9)',
      textAlign: 'center',
      lineHeight: 28,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    paginationDotActive: {
      width: 24,
      backgroundColor: colors.primary,
    },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingBottom: 40,
      paddingTop: 16,
    },
    navButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    skipButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginRight: 12,
    },
    skipText: {
      fontSize: 16,
      fontWeight: '600',
    },
    spacer: {
      flex: 1,
    },
  });

