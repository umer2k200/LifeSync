import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SyncService } from '@/lib/sync';
import { showError, showConfirmDestructive, showConfirm } from '@/lib/alert';
import {
  Dumbbell,
  UtensilsCrossed,
  Plus,
  X,
  Play,
  CheckCircle2,
  Trash2,
  TrendingUp,
  Minus,
  Edit2,
  History,
  Award,
} from 'lucide-react-native';
import { format } from 'date-fns';

interface Workout {
  id: string;
  name: string;
  muscle_group: string | null;
  description: string | null;
}

interface Exercise {
  id: string;
  workout_id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  notes: string | null;
}

interface WorkoutLog {
  id: string;
  workout_id: string;
  completed_at: string;
  duration_minutes: number | null;
  notes: string | null;
}

interface ExerciseLog {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  weight: number;
}

interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  meal_time: string;
}

type TabType = 'workouts' | 'meals';

export default function WorkoutScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('workouts');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  // View session logs modal
  const [viewLogVisible, setViewLogVisible] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // Workout modals
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);
  const [editWorkoutId, setEditWorkoutId] = useState<string | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [workoutDescription, setWorkoutDescription] = useState('');

  // Exercise modal
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [editExerciseId, setEditExerciseId] = useState<string | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseSets, setExerciseSets] = useState('3');
  const [exerciseReps, setExerciseReps] = useState('10');
  
  // Exercise history modal
  const [exerciseHistoryVisible, setExerciseHistoryVisible] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  // Active workout session
  const [activeWorkout, setActiveWorkout] = useState<{
    workoutId: string;
    workoutLogId: string;
    startTime: Date;
    currentExerciseIndex: number;
    currentSet: number;
  } | null>(null);
  const [completedSets, setCompletedSets] = useState<
    Record<string, Array<{ reps: number; weight: number }>>
  >({});

  // Meal modal
  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('0');
  const [mealProtein, setMealProtein] = useState('0');
  const [mealCarbs, setMealCarbs] = useState('0');
  const [mealFats, setMealFats] = useState('0');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Initialize weight when exercise changes
  useEffect(() => {
    if (activeWorkout) {
      const currentExercise = getCurrentExercise();
      if (currentExercise) {
        initializeSetWeight();
      }
    }
  }, [activeWorkout?.currentExerciseIndex, activeWorkout?.currentSet, exercises, exerciseLogs]);

  const loadData = async () => {
    if (!user) return;
    const [workoutsData, exercisesData, logsData, exerciseLogsData, mealsData] =
      await Promise.all([
        SyncService.fetchWithFallback<Workout>('workouts', user.id),
        SyncService.fetchWithFallback<Exercise>('exercises', user.id),
        SyncService.fetchWithFallback<WorkoutLog>('workout_logs', user.id),
        SyncService.fetchWithFallback<ExerciseLog>('exercise_logs', user.id),
        SyncService.fetchWithFallback<Meal>('meals', user.id, (q: any) =>
          q.order('meal_time', { ascending: false }).limit(50)
        ),
      ]);
    setWorkouts(workoutsData);
    setExercises(exercisesData);
    setWorkoutLogs(logsData);
    setExerciseLogs(exerciseLogsData);
    setMeals(mealsData);
  };

  // Workout functions
  const openEditWorkoutModal = (workout: Workout) => {
    setEditWorkoutId(workout.id);
    setWorkoutName(workout.name);
    setMuscleGroup(workout.muscle_group || '');
    setWorkoutDescription(workout.description || '');
    setWorkoutModalVisible(true);
  };

  const closeWorkoutModal = () => {
    setWorkoutModalVisible(false);
    setEditWorkoutId(null);
    setWorkoutName('');
    setMuscleGroup('');
    setWorkoutDescription('');
  };

  const saveWorkout = async () => {
    if (!workoutName.trim() || !user) {
      showError('Error', 'Please enter a workout name');
      return;
    }

    const workoutData = {
      name: workoutName.trim(),
      muscle_group: muscleGroup.trim() || null,
      description: workoutDescription.trim() || null,
    };

    if (editWorkoutId) {
      await SyncService.updateWithFallback('workouts', user.id, editWorkoutId, workoutData);
    } else {
      await SyncService.insertWithFallback('workouts', user.id, workoutData);
    }

    closeWorkoutModal();
    loadData();
  };

  const deleteWorkout = async (workoutId: string) => {
    showConfirmDestructive('Delete Workout', 'Are you sure? This will also delete all exercises.', async () => {
      if (!user) return;
      await SyncService.deleteWithFallback('workouts', user.id, workoutId);
      loadData();
    });
  };

  // Exercise functions
  const openExerciseModal = (workoutId: string) => {
    setEditExerciseId(null);
    setSelectedWorkoutId(workoutId);
    setExerciseName('');
    setExerciseSets('3');
    setExerciseReps('10');
    setExerciseModalVisible(true);
  };

  const openEditExerciseModal = (exercise: Exercise) => {
    setEditExerciseId(exercise.id);
    setSelectedWorkoutId(exercise.workout_id);
    setExerciseName(exercise.name);
    setExerciseSets(exercise.sets.toString());
    setExerciseReps(exercise.reps.toString());
    setExerciseModalVisible(true);
  };

  const closeExerciseModal = () => {
    setExerciseModalVisible(false);
    setEditExerciseId(null);
    setSelectedWorkoutId(null);
    setExerciseName('');
    setExerciseSets('3');
    setExerciseReps('10');
  };

  const saveExercise = async () => {
    if (!exerciseName.trim() || !selectedWorkoutId || !user) {
      showError('Error', 'Please enter an exercise name');
      return;
    }

    const exerciseData = {
      workout_id: selectedWorkoutId,
      name: exerciseName.trim(),
      sets: parseInt(exerciseSets) || 3,
      reps: parseInt(exerciseReps) || 10,
      weight: 0, // Weight will be entered during workout session
    };

    if (editExerciseId) {
      await SyncService.updateWithFallback('exercises', user.id, editExerciseId, exerciseData);
    } else {
      await SyncService.insertWithFallback('exercises', user.id, exerciseData);
    }

    closeExerciseModal();
    loadData();
  };

  // Exercise history and PR functions
  const getExerciseHistory = (exerciseId: string) => {
    const logs = exerciseLogs.filter((el) => el.exercise_id === exerciseId);
    const workoutLogIds = new Set(logs.map((el) => el.workout_log_id));
    const sessions = workoutLogs.filter((wl) => workoutLogIds.has(wl.id));
    
    // Group by session
    const history: Array<{
      date: string;
      sets: Array<{ reps: number; weight: number }>;
      maxWeight: number;
      totalVolume: number;
      avgReps: number;
    }> = [];

    sessions.forEach((session) => {
      const sessionLogs = logs.filter((el) => el.workout_log_id === session.id);
      if (sessionLogs.length === 0) return;

      const sets = sessionLogs.map((log) => ({ reps: log.reps, weight: log.weight }));
      const maxWeight = Math.max(...sets.map((s) => s.weight));
      const totalVolume = sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
      const avgReps = sets.reduce((sum, s) => sum + s.reps, 0) / sets.length;

      history.push({
        date: session.completed_at,
        sets,
        maxWeight,
        totalVolume,
        avgReps,
      });
    });

    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getExercisePR = (exerciseId: string) => {
    const history = getExerciseHistory(exerciseId);
    if (history.length === 0) return null;

    const maxWeight = Math.max(...history.map((h) => h.maxWeight));
    const maxReps = Math.max(...history.flatMap((h) => h.sets.map((s) => s.reps)));
    const maxRepsAtWeight = Math.max(
      ...history.flatMap((h) => h.sets.filter((s) => s.weight === maxWeight).map((s) => s.reps))
    );

    const prSession = history.find((h) => h.maxWeight === maxWeight);

    return {
      maxWeight,
      maxReps,
      maxRepsAtWeight,
      prDate: prSession?.date || null,
    };
  };

  const openExerciseHistory = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setExerciseHistoryVisible(true);
  };

  const deleteExercise = async (exerciseId: string) => {
    showConfirmDestructive('Delete Exercise', 'Are you sure?', async () => {
      if (!user) return;
      await SyncService.deleteWithFallback('exercises', user.id, exerciseId);
      loadData();
    });
  };

  // Workout session functions
  const startWorkout = async (workoutId: string) => {
    if (!user) return;
    const workoutExercises = exercises.filter((ex) => ex.workout_id === workoutId);
    if (workoutExercises.length === 0) {
      showError('Error', 'This workout has no exercises. Add exercises first.');
      return;
    }

    const workoutLog = await SyncService.insertWithFallback('workout_logs', user.id, {
      workout_id: workoutId,
      completed_at: new Date().toISOString(),
      duration_minutes: null,
      notes: null,
    });
    if (!workoutLog || !workoutLog.id) {
      showError('Error', 'Failed to start workout');
      return;
    }
    setActiveWorkout({
      workoutId,
      workoutLogId: workoutLog.id,
      startTime: new Date(),
      currentExerciseIndex: 0,
      currentSet: 1,
    });
    setCompletedSets({});
    loadData();
  };

  const getCurrentExercise = () => {
    if (!activeWorkout) return null;
    const workoutExercises = exercises.filter(
      (ex) => ex.workout_id === activeWorkout.workoutId
    );
    return workoutExercises[activeWorkout.currentExerciseIndex] || null;
  };

  const getCurrentSetReps = () => {
    if (!activeWorkout) return 0;
    const currentExercise = getCurrentExercise();
    if (!currentExercise) return 0;
    const exerciseSets = completedSets[currentExercise.id] || [];
    const currentSetIndex = activeWorkout.currentSet - 1;
    return exerciseSets[currentSetIndex]?.reps || 0;
  };

  const incrementReps = () => {
    if (!activeWorkout) return;
    const currentExercise = getCurrentExercise();
    if (!currentExercise) return;
    const currentReps = getCurrentSetReps();
    setCompletedSets((prev) => {
      const exerciseSets = prev[currentExercise.id] || [];
      const newSets = [...exerciseSets];
      while (newSets.length < activeWorkout.currentSet) {
        newSets.push({ reps: 0, weight: currentExercise.weight });
      }
      newSets[activeWorkout.currentSet - 1] = {
        ...newSets[activeWorkout.currentSet - 1],
        reps: currentReps + 1,
      };
      return {
        ...prev,
        [currentExercise.id]: newSets,
      };
    });
  };

  const decrementReps = () => {
    if (!activeWorkout) return;
    const currentReps = getCurrentSetReps();
    if (currentReps <= 0) return;
    const currentExercise = getCurrentExercise();
    if (!currentExercise) return;
    setCompletedSets((prev) => {
      const exerciseSets = prev[currentExercise.id] || [];
      const newSets = [...exerciseSets];
      newSets[activeWorkout.currentSet - 1] = {
        ...newSets[activeWorkout.currentSet - 1],
        reps: currentReps - 1,
      };
      return {
        ...prev,
        [currentExercise.id]: newSets,
      };
    });
  };

  const updateWeight = (weight: number) => {
    if (!activeWorkout) return;
    const currentExercise = getCurrentExercise();
    if (!currentExercise) return;
    setCompletedSets((prev) => {
      const exerciseSets = prev[currentExercise.id] || [];
      const newSets = [...exerciseSets];
      while (newSets.length < activeWorkout.currentSet) {
        // Use suggested weight for first set if available
        const suggestedWeight = getSuggestedWeight(currentExercise.id);
        newSets.push({ reps: 0, weight: suggestedWeight > 0 ? suggestedWeight : 0 });
      }
      newSets[activeWorkout.currentSet - 1] = {
        ...newSets[activeWorkout.currentSet - 1],
        weight,
      };
      return {
        ...prev,
        [currentExercise.id]: newSets,
      };
    });
  };

  // Initialize weight for current set based on progressive overload
  const initializeSetWeight = () => {
    if (!activeWorkout) return;
    const currentExercise = getCurrentExercise();
    if (!currentExercise) return;

    const exerciseSets = completedSets[currentExercise.id] || [];
    // Only initialize if this is the first set and weight hasn't been set
    if (activeWorkout.currentSet === 1 && exerciseSets.length === 0) {
      const suggestedWeight = getSuggestedWeight(currentExercise.id);
      if (suggestedWeight > 0) {
        updateWeight(suggestedWeight);
      }
    } else if (exerciseSets.length < activeWorkout.currentSet) {
      // Use weight from previous set, or suggested weight
      const previousSet = exerciseSets[exerciseSets.length - 1];
      const weightToUse = previousSet?.weight || getSuggestedWeight(currentExercise.id) || 0;
      if (weightToUse > 0) {
        updateWeight(weightToUse);
      }
    }
  };

  const saveSetAndNext = async () => {
    if (!activeWorkout || !user) return;
    const currentExercise = getCurrentExercise();
    if (!currentExercise) return;

    const workoutExercises = exercises.filter(
      (ex) => ex.workout_id === activeWorkout.workoutId
    );

    // Check if we're done with all sets for current exercise
    if (activeWorkout.currentSet >= currentExercise.sets) {
      // Move to next exercise
      if (activeWorkout.currentExerciseIndex < workoutExercises.length - 1) {
        setActiveWorkout({
          ...activeWorkout,
          currentExerciseIndex: activeWorkout.currentExerciseIndex + 1,
          currentSet: 1,
        });
      } else {
        // All exercises done, complete workout
        await completeWorkout();
      }
    } else {
      // Move to next set
      setActiveWorkout({
        ...activeWorkout,
        currentSet: activeWorkout.currentSet + 1,
      });
    }
  };

  const skipToNextExercise = () => {
    if (!activeWorkout) return;
    const workoutExercises = exercises.filter(
      (ex) => ex.workout_id === activeWorkout.workoutId
    );
    if (activeWorkout.currentExerciseIndex < workoutExercises.length - 1) {
      setActiveWorkout({
        ...activeWorkout,
        currentExerciseIndex: activeWorkout.currentExerciseIndex + 1,
        currentSet: 1,
      });
    }
  };

  const completeWorkout = async () => {
    if (!activeWorkout || !user) return;

    const durationMinutes = Math.floor(
      (new Date().getTime() - activeWorkout.startTime.getTime()) / 60000
    );

    // Update workout log with duration
    await SyncService.updateWithFallback(
      'workout_logs',
      user.id,
      activeWorkout.workoutLogId,
      {
        duration_minutes: durationMinutes,
      }
    );

    // Create exercise logs - one log per set
    for (const [exerciseId, sets] of Object.entries(completedSets)) {
      for (const set of sets) {
        await SyncService.insertWithFallback('exercise_logs', user.id, {
          workout_log_id: activeWorkout.workoutLogId,
          exercise_id: exerciseId,
          sets: 1, // Each log entry is one set
          reps: set.reps,
          weight: set.weight,
        });
      }
    }

    setActiveWorkout(null);
    setCompletedSets({});
    loadData();
  };

  // Meal functions
  const createMeal = async () => {
    if (!mealName.trim() || !user) {
      showError('Error', 'Please enter a meal name');
      return;
    }

    await SyncService.insertWithFallback('meals', user.id, {
      name: mealName.trim(),
      calories: parseFloat(mealCalories) || 0,
      protein: parseFloat(mealProtein) || 0,
      carbs: parseFloat(mealCarbs) || 0,
      fats: parseFloat(mealFats) || 0,
      meal_time: new Date().toISOString(),
    });
    setMealModalVisible(false);
    setMealName('');
    setMealCalories('0');
    setMealProtein('0');
    setMealCarbs('0');
    setMealFats('0');
    loadData();
  };

  const deleteMeal = async (mealId: string) => {
    showConfirmDestructive('Delete Meal', 'Are you sure?', async () => {
      if (!user) return;
      await SyncService.deleteWithFallback('meals', user.id, mealId);
      loadData();
    });
  };

  // Progressive Overload Logic
  const getLastSessionPerformance = (exerciseId: string) => {
    // Get all workout logs that contain this exercise, sorted by date
    const relevantWorkoutLogs = workoutLogs
      .filter((log) => {
        // Check if any exercise in this workout matches
        const workoutExercises = exercises.filter((ex) => ex.workout_id === log.workout_id);
        return workoutExercises.some((ex) => ex.id === exerciseId);
      })
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

    if (relevantWorkoutLogs.length === 0) return null;

    // Get the most recent workout log (excluding current session)
    const lastWorkoutLog = relevantWorkoutLogs.find(
      (log) => log.id !== activeWorkout?.workoutLogId
    );
    if (!lastWorkoutLog) return null;

    // Get all exercise logs for this exercise from the last workout
    const lastSessionSets = exerciseLogs.filter(
      (el) =>
        el.exercise_id === exerciseId &&
        el.workout_log_id === lastWorkoutLog.id &&
        el.reps > 0 // Only count sets that were actually performed
    );

    if (lastSessionSets.length === 0) return null;

    // Calculate average weight and reps from last session
    const avgWeight =
      lastSessionSets.reduce((sum, set) => sum + set.weight, 0) / lastSessionSets.length;
    const avgReps =
      lastSessionSets.reduce((sum, set) => sum + set.reps, 0) / lastSessionSets.length;
    const maxReps = Math.max(...lastSessionSets.map((set) => set.reps));
    const maxWeight = Math.max(...lastSessionSets.map((set) => set.weight));

    return {
      avgWeight,
      avgReps,
      maxReps,
      maxWeight,
      totalSets: lastSessionSets.length,
      date: lastWorkoutLog.completed_at,
    };
  };

  const getSuggestedWeight = (exerciseId: string) => {
    const lastPerformance = getLastSessionPerformance(exerciseId);
    if (!lastPerformance) {
      // No previous session, start with 0 or minimal weight
      return 0;
    }

    const { avgReps, maxWeight, avgWeight } = lastPerformance;

    // Progressive Overload Logic:
    // If last session had 12+ reps on average, increase weight
    if (avgReps >= 12) {
      // Increase weight by 2.5kg increments (or 5% if weight is high)
      if (maxWeight >= 50) {
        return Math.round((maxWeight * 1.05) / 2.5) * 2.5; // 5% increase, rounded to nearest 2.5kg
      } else {
        return maxWeight + 2.5; // Simple 2.5kg increase
      }
    } else if (avgReps >= 10) {
      // Close to 12 reps, suggest slight increase
      return maxWeight + 1.25;
    } else {
      // Below 10 reps, keep same weight or slight increase
      return maxWeight;
    }
  };

  // Progress calculations
  const getWorkoutStats = (workoutId: string) => {
    const logs = workoutLogs.filter((log) => log.workout_id === workoutId);
    const totalWorkouts = logs.length;
    const exerciseLogsForWorkout = exerciseLogs.filter((el) =>
      logs.some((log) => log.id === el.workout_log_id)
    );
    return { totalWorkouts, exerciseLogsForWorkout };
  };

  const getExerciseProgress = (exerciseId: string) => {
    const logs = exerciseLogs.filter((el) => el.exercise_id === exerciseId);
    if (logs.length === 0) return null;
    const latestLog = logs[logs.length - 1];
    const previousLogs = logs.slice(0, -1);
    if (previousLogs.length === 0) return null;
    const previousBest = previousLogs.reduce(
      (best, log) => Math.max(best, log.weight * log.reps * log.sets),
      0
    );
    const current = latestLog.weight * latestLog.reps * latestLog.sets;
    return { current, previousBest, improvement: current - previousBest };
  };

  const getMaxWeightForExercise = (exerciseId: string) => {
    const logs = exerciseLogs.filter((el) => el.exercise_id === exerciseId);
    if (logs.length === 0) return 0;
    return Math.max(...logs.map((l) => Number(l.weight) || 0));
  };

  const getTodaysMeals = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return meals.filter((meal) => format(new Date(meal.meal_time), 'yyyy-MM-dd') === today);
  };

  const getTodaysStats = () => {
    const todaysMeals = getTodaysMeals();
    return {
      calories: todaysMeals.reduce((sum, meal) => sum + meal.calories, 0),
      protein: todaysMeals.reduce((sum, meal) => sum + meal.protein, 0),
      carbs: todaysMeals.reduce((sum, meal) => sum + meal.carbs, 0),
      fats: todaysMeals.reduce((sum, meal) => sum + meal.fats, 0),
    };
  };

  const styles = createStyles(colors);
  const todaysStats = getTodaysStats();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Workout & Meals"
        subtitle={activeWorkout ? 'Active workout session' : 'Track your fitness'}
      />

      {/* Tab Selector */}
      <View style={[styles.tabContainer, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'workouts' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('workouts')}
        >
          <Dumbbell
            size={20}
            color={activeTab === 'workouts' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'workouts' ? colors.primary : colors.textSecondary,
              },
            ]}
          >
            Workouts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'meals' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('meals')}
        >
          <UtensilsCrossed
            size={20}
            color={activeTab === 'meals' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'meals' ? colors.primary : colors.textSecondary,
              },
            ]}
          >
            Meals
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'workouts' ? (
          <>
            {activeWorkout ? (
              <View style={styles.activeWorkoutContainer}>
                {/* Workout Header */}
                <Card style={styles.activeWorkoutHeader}>
                  <View style={styles.workoutHeaderTop}>
                    <View>
                      <Text style={[styles.activeWorkoutTitle, { color: colors.text }]}>
                        {workouts.find((w) => w.id === activeWorkout.workoutId)?.name || 'Active Workout'}
                      </Text>
                      <Text style={[styles.activeWorkoutTime, { color: colors.textSecondary }]}>
                        Duration: {Math.floor((new Date().getTime() - activeWorkout.startTime.getTime()) / 60000)} min
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.exitButton, { backgroundColor: colors.error + '20' }]}
                      onPress={() => {
                        showConfirm('Exit Workout', 'Are you sure? All progress will be saved.', () => {
                          completeWorkout();
                        });
                      }}
                    >
                      <X size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.progressBar}>
                    {(() => {
                      const workoutExercises = exercises.filter(
                        (ex) => ex.workout_id === activeWorkout.workoutId
                      );
                      const totalExercises = workoutExercises.length;
                      const completedExercises = activeWorkout.currentExerciseIndex;
                      const progress = ((completedExercises + 1) / totalExercises) * 100;
                      return (
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${progress}%`, backgroundColor: colors.primary },
                          ]}
                        />
                      );
                    })()}
                  </View>
                  <Text style={[styles.progressTextHeader, { color: colors.textSecondary }]}>
                    Exercise {activeWorkout.currentExerciseIndex + 1} of{' '}
                    {exercises.filter((ex) => ex.workout_id === activeWorkout.workoutId).length}
                  </Text>
                </Card>

                {/* Current Exercise */}
                {(() => {
                  const currentExercise = getCurrentExercise();
                  if (!currentExercise) return null;

                  const workoutExercises = exercises.filter(
                    (ex) => ex.workout_id === activeWorkout.workoutId
                  );
                  const exerciseSets = completedSets[currentExercise.id] || [];
                  const currentSetReps = getCurrentSetReps();
                  const currentSetWeight = exerciseSets[activeWorkout.currentSet - 1]?.weight || 0;
                  const isRepsOverTarget = currentSetReps > currentExercise.reps;
                  
                  // Get progressive overload suggestion
                  const lastPerformance = getLastSessionPerformance(currentExercise.id);
                  const suggestedWeight = getSuggestedWeight(currentExercise.id);
                  const showProgressiveOverload = lastPerformance && suggestedWeight > lastPerformance.maxWeight;

                  return (
                    <Card style={styles.currentExerciseCard}>
                      <View style={styles.exerciseInfo}>
                        <Text style={[styles.currentExerciseName, { color: colors.text }]}>
                          {currentExercise.name}
                        </Text>
                        <Text style={[styles.exerciseTarget, { color: colors.textSecondary }]}>
                          Target: {currentExercise.reps} reps × {currentExercise.sets} sets
                        </Text>
                        {showProgressiveOverload && lastPerformance && (
                          <Card style={styles.progressiveOverloadCard}>
                            <View style={styles.progressiveOverloadHeader}>
                              <TrendingUp size={18} color={colors.success} />
                              <Text style={[styles.progressiveOverloadTitle, { color: colors.text }]}>
                                Progressive Overload
                              </Text>
                            </View>
                            <Text style={[styles.progressiveOverloadText, { color: colors.textSecondary }]}>
                              Last session: {lastPerformance.avgReps.toFixed(1)} avg reps @ {lastPerformance.maxWeight}kg
                            </Text>
                            <Text style={[styles.progressiveOverloadText, { color: colors.primary }]}>
                              Suggested: Try {currentExercise.reps} reps @ {suggestedWeight}kg
                            </Text>
                          </Card>
                        )}
                      </View>

                      <View style={styles.setInfo}>
                        <Text style={[styles.setNumber, { color: colors.primary }]}>
                          Set {activeWorkout.currentSet} of {currentExercise.sets}
                        </Text>
                        {exerciseSets.slice(0, activeWorkout.currentSet - 1).map((set, idx) => (
                          <View key={idx} style={styles.completedSetBadge}>
                            <CheckCircle2 size={16} color={colors.success} />
                            <Text style={[styles.completedSetText, { color: colors.textSecondary }]}>
                              Set {idx + 1}: {set.reps} reps {set.weight > 0 && `@ ${set.weight}kg`}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.repsCounter}>
                        <Text style={[styles.repsLabel, { color: colors.textSecondary }]}>
                          Reps Completed
                        </Text>
                        <View style={styles.counterContainer}>
                          <TouchableOpacity
                            style={[styles.counterButton, { backgroundColor: colors.surface }]}
                            onPress={decrementReps}
                          >
                            <Minus size={24} color={colors.text} />
                          </TouchableOpacity>
                          <View style={[styles.repsDisplay, { backgroundColor: colors.surface }]}>
                            <Text
                              style={[
                                styles.repsValue,
                                {
                                  color: isRepsOverTarget ? colors.success : colors.text,
                                  fontSize: isRepsOverTarget ? 48 : 36,
                                },
                              ]}
                            >
                              {currentSetReps}
                            </Text>
                            {isRepsOverTarget && (
                              <View style={styles.progressBadgeInline}>
                                <TrendingUp size={16} color={colors.success} />
                                <Text style={[styles.progressBadgeText, { color: colors.success }]}>
                                  +{currentSetReps - currentExercise.reps}
                                </Text>
                              </View>
                            )}
                          </View>
                          <TouchableOpacity
                            style={[styles.counterButton, { backgroundColor: colors.surface }]}
                            onPress={incrementReps}
                          >
                            <Plus size={24} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.targetReps, { color: colors.textSecondary }]}>
                          Target: {currentExercise.reps} reps
                        </Text>
                      </View>

                      <View style={styles.weightInput}>
                        <Text style={[styles.weightLabel, { color: colors.textSecondary }]}>Weight (kg)</Text>
                        {suggestedWeight > 0 && currentSetWeight === 0 && (
                          <TouchableOpacity
                            style={[styles.suggestedWeightButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                            onPress={() => updateWeight(suggestedWeight)}
                          >
                            <Text style={[styles.suggestedWeightText, { color: colors.primary }]}>
                              Use Suggested: {suggestedWeight}kg
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TextInput
                          style={[styles.weightInputField, { backgroundColor: colors.surface, color: colors.text }]}
                          value={currentSetWeight > 0 ? currentSetWeight.toString() : ''}
                          onChangeText={(text) => updateWeight(parseFloat(text) || 0)}
                          keyboardType="numeric"
                          placeholder={suggestedWeight > 0 ? suggestedWeight.toString() : '0'}
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>

                      <View style={styles.actionButtons}>
                        <Button
                          title={`Save Set ${activeWorkout.currentSet}`}
                          onPress={saveSetAndNext}
                          disabled={currentSetReps === 0}
                        />
                        {activeWorkout.currentSet < currentExercise.sets && (
                          <TouchableOpacity
                            style={[styles.skipButton, { borderColor: colors.border }]}
                            onPress={skipToNextExercise}
                          >
                            <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
                              Skip to Next Exercise
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </Card>
                  );
                })()}

                {/* Next Exercises Preview */}
                <Card style={styles.upcomingExercisesCard}>
                  <Text style={[styles.upcomingTitle, { color: colors.text }]}>Upcoming</Text>
                  {exercises
                    .filter((ex) => ex.workout_id === activeWorkout.workoutId)
                    .slice(activeWorkout.currentExerciseIndex + 1, activeWorkout.currentExerciseIndex + 4)
                    .map((exercise, idx) => (
                      <View key={exercise.id} style={styles.upcomingExerciseItem}>
                        <Text style={[styles.upcomingExerciseName, { color: colors.textSecondary }]}>
                          {idx + 1}. {exercise.name}
                        </Text>
                        <Text style={[styles.upcomingExerciseDetails, { color: colors.textSecondary }]}>
                          {exercise.sets} sets × {exercise.reps} reps
                        </Text>
                      </View>
                    ))}
                  {exercises.filter((ex) => ex.workout_id === activeWorkout.workoutId).length <=
                    activeWorkout.currentExerciseIndex + 1 && (
                    <Text style={[styles.finishText, { color: colors.success }]}>
                      🎉 You&apos;re on the last exercise!
                    </Text>
                  )}
                </Card>
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>My Workouts</Text>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => setWorkoutModalVisible(true)}
                  >
                    <Plus size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {workouts.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Dumbbell size={48} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No workouts yet. Create your first workout!
                    </Text>
                  </Card>
                ) : (
                  workouts.map((workout) => {
                    const workoutExercises = exercises.filter(
                      (ex) => ex.workout_id === workout.id
                    );
                    const stats = getWorkoutStats(workout.id);
                    return (
                      <Card key={workout.id} style={styles.workoutCard}>
                        <View style={styles.workoutHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.workoutName, { color: colors.text }]}>
                              {workout.name}
                            </Text>
                            {workout.muscle_group && (
                              <Text style={[styles.muscleGroup, { color: colors.textSecondary }]}>
                                {workout.muscle_group}
                              </Text>
                            )}
                            <Text style={[styles.exerciseCount, { color: colors.textSecondary }]}>
                              {workoutExercises.length} exercises • {stats.totalWorkouts} sessions
                            </Text>
                          </View>
                          <View style={styles.workoutActions}>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: colors.success + '20' }]}
                              onPress={() => startWorkout(workout.id)}
                            >
                              <Play size={18} color={colors.success} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                              onPress={() => openEditWorkoutModal(workout)}
                            >
                              <Edit2 size={18} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                              onPress={() => deleteWorkout(workout.id)}
                            >
                              <Trash2 size={18} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {workoutExercises.length > 0 && (
                          <View style={styles.exercisesList}>
                            {workoutExercises.map((exercise) => {
                              const progress = getExerciseProgress(exercise.id);
                              const pr = getExercisePR(exercise.id);
                              const history = getExerciseHistory(exercise.id);
                              
                              return (
                                <View key={exercise.id} style={styles.exerciseItem}>
                                  <TouchableOpacity
                                    style={{ flex: 1 }}
                                    onPress={() => openExerciseHistory(exercise.id)}
                                    activeOpacity={0.7}
                                  >
                                    <View style={{ flex: 1 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={[styles.exerciseItemName, { color: colors.text }]}>
                                          {exercise.name}
                                        </Text>
                                        {pr && (
                                          <View style={[styles.prBadge, { backgroundColor: colors.primary + '20' }]}>
                                            <Award size={12} color={colors.primary} />
                                            <Text style={[styles.prBadgeText, { color: colors.primary }]}>
                                              PR: {pr.maxWeight}kg
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                      <Text style={[styles.exerciseItemDetails, { color: colors.textSecondary }]}>
                                        {exercise.sets} sets × {exercise.reps} reps
                                        {history.length > 0 && ` • ${history.length} sessions`}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                  {progress && progress.improvement > 0 && (
                                    <View style={styles.progressBadge}>
                                      <TrendingUp size={14} color={colors.success} />
                                      <Text style={[styles.progressTextSmall, { color: colors.success }]}>
                                        +{progress.improvement.toFixed(0)}
                                      </Text>
                                    </View>
                                  )}
                                  <View style={styles.exerciseActions}>
                                    <TouchableOpacity
                                      style={[styles.actionButtonSmall, { backgroundColor: colors.primary + '20' }]}
                                      onPress={() => openEditExerciseModal(exercise)}
                                    >
                                      <Edit2 size={14} color={colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[styles.actionButtonSmall, { backgroundColor: colors.error + '20' }]}
                                      onPress={() => deleteExercise(exercise.id)}
                                    >
                                      <X size={14} color={colors.error} />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        <Button
                          title="Add Exercise"
                          onPress={() => openExerciseModal(workout.id)}
                          variant="outline"
                          style={{ marginTop: 12 }}
                        />
                      </Card>
                    );
                  })
                )}

                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Sessions</Text>
                </View>
                {workoutLogs.slice(0, 5).map((log) => {
                  const workout = workouts.find((w) => w.id === log.workout_id);
                  return (
                    <TouchableOpacity
                      key={log.id}
                      onPress={() => {
                        setSelectedLogId(log.id);
                        setViewLogVisible(true);
                      }}
                    >
                      <Card style={styles.logCard}>
                      <Text style={[styles.logWorkoutName, { color: colors.text }]}>
                        {workout?.name || 'Unknown'}
                      </Text>
                      <Text style={[styles.logDate, { color: colors.textSecondary }]}>
                        {format(new Date(log.completed_at), 'MMM dd, yyyy HH:mm')}
                        {log.duration_minutes && ` • ${log.duration_minutes} min`}
                      </Text>
                      </Card>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <>
            <Card style={styles.statsCard}>
              <Text style={[styles.statsTitle, { color: colors.text }]}>Today&apos;s Nutrition</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {todaysStats.calories.toFixed(0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Calories</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {todaysStats.protein.toFixed(0)}g
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Protein</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.secondary }]}>
                    {todaysStats.carbs.toFixed(0)}g
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Carbs</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                    {todaysStats.fats.toFixed(0)}g
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fats</Text>
                </View>
              </View>
            </Card>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Today&apos;s Meals</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={() => setMealModalVisible(true)}
              >
                <Plus size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {meals.filter((meal) =>
              format(new Date(meal.meal_time), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            ).length === 0 ? (
              <Card style={styles.emptyCard}>
                <UtensilsCrossed size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No meals logged today. Add your first meal!
                </Text>
              </Card>
            ) : (
              meals
                .filter((meal) => format(new Date(meal.meal_time), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
                .map((meal) => (
                  <Card key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.mealName, { color: colors.text }]}>{meal.name}</Text>
                        <Text style={[styles.mealTime, { color: colors.textSecondary }]}>
                          {format(new Date(meal.meal_time), 'HH:mm')}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.deleteMealButton, { backgroundColor: colors.error + '20' }]}
                        onPress={() => deleteMeal(meal.id)}
                      >
                        <Trash2 size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.macroRow}>
                      <Text style={[styles.macroText, { color: colors.textSecondary }]}>
                        {meal.calories} cal
                      </Text>
                      <Text style={[styles.macroText, { color: colors.textSecondary }]}>
                        P: {meal.protein}g
                      </Text>
                      <Text style={[styles.macroText, { color: colors.textSecondary }]}>
                        C: {meal.carbs}g
                      </Text>
                      <Text style={[styles.macroText, { color: colors.textSecondary }]}>
                        F: {meal.fats}g
                      </Text>
                    </View>
                  </Card>
                ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Meals</Text>
            </View>
            {meals
              .filter((meal) => format(new Date(meal.meal_time), 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd'))
              .slice(0, 5)
              .map((meal) => (
                <Card key={meal.id} style={styles.mealCard}>
                  <View style={styles.mealHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.mealName, { color: colors.text }]}>{meal.name}</Text>
                      <Text style={[styles.mealTime, { color: colors.textSecondary }]}>
                        {format(new Date(meal.meal_time), 'MMM dd, yyyy HH:mm')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteMealButton, { backgroundColor: colors.error + '20' }]}
                      onPress={() => deleteMeal(meal.id)}
                    >
                      <Trash2 size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.macroRow}>
                    <Text style={[styles.macroText, { color: colors.textSecondary }]}>
                      {meal.calories} cal
                    </Text>
                    <Text style={[styles.macroText, { color: colors.textSecondary }]}>
                      P: {meal.protein}g
                    </Text>
                    <Text style={[styles.macroText, { color: colors.textSecondary }]}>
                      C: {meal.carbs}g
                    </Text>
                    <Text style={[styles.macroText, { color: colors.textSecondary }]}>
                      F: {meal.fats}g
                    </Text>
                  </View>
                </Card>
              ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Workout Modal */}
      <Modal visible={workoutModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editWorkoutId ? 'Edit Workout' : 'New Workout'}
              </Text>
              <TouchableOpacity onPress={closeWorkoutModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Workout name"
              placeholderTextColor={colors.textSecondary}
              value={workoutName}
              onChangeText={setWorkoutName}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Muscle group (optional)"
              placeholderTextColor={colors.textSecondary}
              value={muscleGroup}
              onChangeText={setMuscleGroup}
            />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.surface, color: colors.text },
              ]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={workoutDescription}
              onChangeText={setWorkoutDescription}
              multiline
              numberOfLines={3}
            />

            <Button title={editWorkoutId ? 'Update Workout' : 'Create Workout'} onPress={saveWorkout} />
          </View>
        </View>
      </Modal>

      {/* Exercise Modal */}
      <Modal visible={exerciseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editExerciseId ? 'Edit Exercise' : 'Add Exercise'}
              </Text>
              <TouchableOpacity onPress={closeExerciseModal}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Exercise name"
              placeholderTextColor={colors.textSecondary}
              value={exerciseName}
              onChangeText={setExerciseName}
            />

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>Sets</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="3"
                  placeholderTextColor={colors.textSecondary}
                  value={exerciseSets}
                  onChangeText={setExerciseSets}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.label, { color: colors.text }]}>Reps</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="10"
                  placeholderTextColor={colors.textSecondary}
                  value={exerciseReps}
                  onChangeText={setExerciseReps}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              Note: Weight will be entered during your workout session
            </Text>

            <Button title={editExerciseId ? 'Update Exercise' : 'Add Exercise'} onPress={saveExercise} />
          </View>
        </View>
      </Modal>

      {/* Meal Modal */}
      <Modal visible={mealModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Log Meal</Text>
              <TouchableOpacity onPress={() => setMealModalVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Meal name"
              placeholderTextColor={colors.textSecondary}
              value={mealName}
              onChangeText={setMealName}
            />

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>Calories</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={mealCalories}
                  onChangeText={setMealCalories}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.label, { color: colors.text }]}>Protein (g)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={mealProtein}
                  onChangeText={setMealProtein}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>Carbs (g)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={mealCarbs}
                  onChangeText={setMealCarbs}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.label, { color: colors.text }]}>Fats (g)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={mealFats}
                  onChangeText={setMealFats}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Button title="Log Meal" onPress={createMeal} />
          </View>
        </View>
      </Modal>

      {/* Exercise History Modal */}
      <Modal visible={exerciseHistoryVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Exercise History</Text>
              <TouchableOpacity onPress={() => setExerciseHistoryVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {(() => {
                if (!selectedExerciseId) return null;
                const exercise = exercises.find((e) => e.id === selectedExerciseId);
                const history = getExerciseHistory(selectedExerciseId);
                const pr = getExercisePR(selectedExerciseId);

                if (!exercise) {
                  return <Text style={{ color: colors.textSecondary }}>Exercise not found</Text>;
                }

                return (
                  <>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>{exercise.name}</Text>
                    
                    {/* PR Section */}
                    {pr && (
                      <Card style={{ marginBottom: 16, padding: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <Award size={20} color={colors.primary} />
                          <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: 8 }]}>
                            Personal Records
                          </Text>
                        </View>
                        <View style={{ gap: 8 }}>
                          <View style={styles.prRow}>
                            <Text style={[styles.prLabel, { color: colors.textSecondary }]}>Max Weight:</Text>
                            <Text style={[styles.prValue, { color: colors.text }]}>
                              {pr.maxWeight}kg
                              {pr.prDate && (
                                <Text style={[styles.prDate, { color: colors.textSecondary }]}>
                                  {' '}({format(new Date(pr.prDate), 'MMM dd, yyyy')})
                                </Text>
                              )}
                            </Text>
                          </View>
                          <View style={styles.prRow}>
                            <Text style={[styles.prLabel, { color: colors.textSecondary }]}>Max Reps:</Text>
                            <Text style={[styles.prValue, { color: colors.text }]}>{pr.maxReps} reps</Text>
                          </View>
                          {pr.maxRepsAtWeight > 0 && (
                            <View style={styles.prRow}>
                              <Text style={[styles.prLabel, { color: colors.textSecondary }]}>Max Reps @ PR Weight:</Text>
                              <Text style={[styles.prValue, { color: colors.text }]}>{pr.maxRepsAtWeight} reps</Text>
                            </View>
                          )}
                        </View>
                      </Card>
                    )}

                    {/* History Section */}
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
                      Session History ({history.length})
                    </Text>
                    {history.length === 0 ? (
                      <Card style={{ padding: 40, alignItems: 'center' }}>
                        <History size={48} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 16 }]}>
                          No workout sessions yet
                        </Text>
                      </Card>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {history.map((session, idx) => (
                          <Card key={idx} style={{ padding: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                              <Text style={[styles.sessionDate, { color: colors.text }]}>
                                {format(new Date(session.date), 'MMM dd, yyyy HH:mm')}
                              </Text>
                              {session.maxWeight === pr?.maxWeight && (
                                <View style={[styles.prBadge, { backgroundColor: colors.primary + '20' }]}>
                                  <Award size={12} color={colors.primary} />
                                  <Text style={[styles.prBadgeText, { color: colors.primary }]}>PR</Text>
                                </View>
                              )}
                            </View>
                            <View style={{ gap: 4 }}>
                              {session.sets.map((set, setIdx) => (
                                <Text key={setIdx} style={[styles.setText, { color: colors.textSecondary }]}>
                                  Set {setIdx + 1}: {set.reps} reps @ {set.weight}kg
                                </Text>
                              ))}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                              <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                                Max: {session.maxWeight}kg
                              </Text>
                              <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                                Avg Reps: {session.avgReps.toFixed(1)}
                              </Text>
                            </View>
                          </Card>
                        ))}
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* View Session Logs Modal */}
      <Modal visible={viewLogVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Session Details</Text>
              <TouchableOpacity onPress={() => setViewLogVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {(() => {
              if (!selectedLogId) return null;
              // Group sets by exercise
              const sets = exerciseLogs.filter((el) => el.workout_log_id === selectedLogId);
              const byExercise: Record<string, ExerciseLog[]> = {};
              sets.forEach((s) => {
                if (!byExercise[s.exercise_id]) byExercise[s.exercise_id] = [];
                byExercise[s.exercise_id].push(s);
              });
              const exerciseIds = Object.keys(byExercise);
              if (exerciseIds.length === 0) {
                return (
                  <Text style={{ color: colors.textSecondary }}>No sets recorded in this session.</Text>
                );
              }
              return (
                <View style={{ gap: 12 }}>
                  {exerciseIds.map((exId) => {
                    const ex = exercises.find((e) => e.id === exId);
                    const exSets = byExercise[exId];
                    return (
                      <Card key={exId} style={{ padding: 16 }}>
                        <Text style={[styles.logWorkoutName, { color: colors.text }]}>{ex?.name || 'Exercise'}</Text>
                        {exSets.map((s, idx) => (
                          <Text key={s.id || idx} style={[styles.logDate, { color: colors.textSecondary }]}>Set {idx + 1}: {s.reps} reps @ {s.weight}kg</Text>
                        ))}
                      </Card>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCard: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 16,
    },
    workoutCard: {
      marginBottom: 16,
    },
    workoutHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    workoutName: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    muscleGroup: {
      fontSize: 14,
      marginBottom: 4,
    },
    exerciseCount: {
      fontSize: 12,
    },
    workoutActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exercisesList: {
      marginTop: 12,
      gap: 8,
    },
    exerciseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 8,
      gap: 8,
    },
    exerciseItemName: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    exerciseItemDetails: {
      fontSize: 12,
    },
    progressBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.success + '20',
      borderRadius: 12,
    },
    progressTextSmall: {
      fontSize: 12,
      fontWeight: '600',
    },
    deleteExerciseButton: {
      width: 28,
      height: 28,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exerciseActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    actionButtonSmall: {
      width: 28,
      height: 28,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    prBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    exerciseName: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    prRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    prLabel: {
      fontSize: 14,
    },
    prValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    prDate: {
      fontSize: 12,
      fontWeight: '400',
    },
    sessionDate: {
      fontSize: 14,
      fontWeight: '600',
    },
    setText: {
      fontSize: 13,
    },
    statsText: {
      fontSize: 12,
    },
    activeWorkoutContainer: {
      gap: 16,
    },
    activeWorkoutHeader: {
      marginBottom: 16,
      padding: 20,
    },
    workoutHeaderTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    activeWorkoutTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    activeWorkoutTime: {
      fontSize: 14,
    },
    exitButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.surface,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressTextHeader: {
      fontSize: 14,
      fontWeight: '600',
    },
    currentExerciseCard: {
      marginBottom: 16,
      padding: 24,
    },
    exerciseInfo: {
      marginBottom: 20,
    },
    currentExerciseName: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    exerciseTarget: {
      fontSize: 16,
    },
    setInfo: {
      marginBottom: 24,
      gap: 8,
    },
    setNumber: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    completedSetBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      backgroundColor: colors.surface,
      borderRadius: 8,
    },
    completedSetText: {
      fontSize: 14,
    },
    repsCounter: {
      alignItems: 'center',
      marginBottom: 24,
    },
    repsLabel: {
      fontSize: 14,
      marginBottom: 16,
    },
    counterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 12,
    },
    counterButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    repsDisplay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      borderRadius: 16,
      minHeight: 120,
    },
    repsValue: {
      fontSize: 48,
      fontWeight: 'bold',
    },
    progressBadgeInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.success + '20',
      borderRadius: 16,
    },
    progressBadgeText: {
      fontSize: 14,
      fontWeight: '600',
    },
    targetReps: {
      fontSize: 14,
    },
    weightInput: {
      marginBottom: 24,
    },
    weightLabel: {
      fontSize: 14,
      marginBottom: 8,
    },
    weightInputField: {
      borderRadius: 12,
      padding: 16,
      fontSize: 18,
      textAlign: 'center',
      fontWeight: '600',
    },
    progressiveOverloadCard: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.success + '10',
      borderWidth: 1,
      borderColor: colors.success + '30',
    },
    progressiveOverloadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    progressiveOverloadTitle: {
      fontSize: 14,
      fontWeight: 'bold',
    },
    progressiveOverloadText: {
      fontSize: 12,
      marginTop: 4,
    },
    suggestedWeightButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 8,
      alignItems: 'center',
    },
    suggestedWeightText: {
      fontSize: 14,
      fontWeight: '600',
    },
    actionButtons: {
      gap: 12,
    },
    skipButton: {
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
    },
    skipButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    upcomingExercisesCard: {
      marginBottom: 16,
      padding: 20,
    },
    upcomingTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    upcomingExerciseItem: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    upcomingExerciseName: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    upcomingExerciseDetails: {
      fontSize: 12,
    },
    finishText: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
      textAlign: 'center',
    },
    logCard: {
      marginBottom: 12,
    },
    logWorkoutName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    logDate: {
      fontSize: 12,
    },
    statsCard: {
      marginBottom: 24,
      padding: 20,
    },
    statsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
    },
    mealCard: {
      marginBottom: 12,
    },
    mealHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    mealName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    mealTime: {
      fontSize: 12,
    },
    deleteMealButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    macroRow: {
      flexDirection: 'row',
      gap: 16,
    },
    macroText: {
      fontSize: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      minHeight: 400,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    input: {
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      marginBottom: 16,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    hintText: {
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: -8,
      marginBottom: 16,
      textAlign: 'center',
    },
    inputRow: {
      flexDirection: 'row',
      marginBottom: 16,
    },
  });

