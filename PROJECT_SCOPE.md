# LifeSync - Product Brief, Scope, and Status

## Vision
A full‑stack mobile app that helps users manage goals, habits & gym, meals & water, tasks, finances, and Islamic practices, with a beautiful modern UI, offline-first experience, and seamless background sync.

## Current Reality vs Target
- Backend (target): Firebase (Firestore, Auth, Storage, Cloud Functions)
- Backend (current): Supabase (Postgres, Auth, Storage) with offline fallback and background sync
- Note: Migrating to Firebase is a future track; scope below assumes Firebase as target while existing code runs on Supabase.

## Tech Stack (target)
- Frontend: React Native (Expo)
- Styling: Styled components or utility styles; gradients and shadows
- Navigation: Expo Router (tabs + stacks)
- Charts: Victory Native / Recharts (as applicable)
- Notifications: Expo Notifications API
- Offline: AsyncStorage / SQLite + background sync
- Backend: Firebase (Firestore, Auth, Storage, Functions)

## App Modules
- Home Dashboard
- Goal Tracker
- Habit & Gym Tracker (Habits, Workout logging, Meals, Water)
- Task Manager
- Expense Tracker (expenses, incomes, loans)
- Islamic Section (Quran progress, Charity reminders, Tasbeeh)
- Settings

---

## Feature Breakdown and Status

### 1) Home Dashboard
- [x] Quick stats scaffold (reads from modules)
- [x] Sync status indicator (online/offline)
- [ ] Motivational quote + Islamic reminder content source
- [ ] Deeper analytics summaries (charts)

### 2) Goal Tracker
- [x] Create, list, delete goals (categories, progress)
- [x] Progress update and completion logic
- [ ] Milestones/sub‑tasks per goal
- [ ] Deadlines and push reminders
- [ ] Progress analytics (charts, streaks)

### 3) Habit & Gym Tracker
- Habits
  - [x] Create and toggle daily completion
  - [x] Streak basics via daily logs
  - [ ] Monthly progress charts
- Water
  - [x] Add intake and daily goal visualization (basic)
  - [ ] Reminders via notifications
- Gym
  - [ ] Custom workouts (exercises, sets, reps, weights)
  - [ ] Workout logging with history & stats
  - [ ] Graphs for strength/volume progress
- Meals
  - [ ] Meal logging with calories/macros
  - [ ] Favorites and import plans
- Friends/Leaderboards
  - [ ] Add friends, share progress
  - [ ] Optional leaderboard

### 4) Task Manager
- [x] Create, toggle complete, delete tasks
- [ ] Categories (color/icon)
- [ ] Due dates, priorities, reminders
- [ ] Filter/search
- [ ] Calendar view
- [ ] Progress analytics (completed vs pending)

### 5) Expense Tracker
- Expenses
  - [x] Add & list expenses
  - [ ] Categories (color/icon)
  - [ ] Monthly reports and charts
  - [ ] Export to CSV/PDF
- Incomes & Savings
  - [ ] CRUD incomes; savings goals
- Loans
  - [ ] Loans (given/taken), repayment schedules, balances

### 6) Islamic Section
- Quran Progress
  - [ ] Mark last Surah/Ayah, % completion
  - [ ] “Read with translation” flag
- Charity Reminders
  - [ ] Recurring reminders (weekly/monthly)
- Tasbeeh Counter
  - [ ] Counter with save + daily logs

### Additional Core Features
- Authentication
  - [x] Email/password auth flow (current: Supabase)
  - [ ] Google OAuth
  - [ ] Migrate backend to Firebase Auth
- Offline Mode & Sync
  - [x] Local storage with AsyncStorage
  - [x] Background sync when online (SyncService)
  - [ ] Background tasks for periodic sync
- Backup & Restore
  - [ ] Manual backup to backend storage
- Theme
  - [x] Dark/Light theme toggle with persistence
- Notifications
  - [ ] Expo Notifications wiring (water/tasks/goals/charity)
- Analytics Dashboard
  - [ ] Cross‑module summaries and charts
- Settings
  - [x] Basic settings screen
  - [ ] Reminder, privacy, sync frequency controls

---

## Data & Persistence Strategy
- Offline‑first via AsyncStorage; writes queue when offline
- SyncService upserts to backend and reconciles local cache on reconnect
- Row‑level security (current: Supabase RLS) / Security Rules (target: Firebase)

### Current Tables/Collections (conceptual)
- profiles, goals, goal_milestones
- habits, habit_logs, workouts, exercises, workout_logs, exercise_logs
- meals, water_logs
- tasks, task_categories
- expenses, expense_categories, incomes, loans
- quran_progress, tasbeeh_logs, charity_reminders
- friendships

---

## Deliverables
- [x] Running Expo app with tabs and core modules scaffolded
- [x] Offline storage + sync layer (current: Supabase)
- [ ] Firebase integration (Firestore, Auth, Storage, Functions)
- [ ] Debug APK
- [ ] Docs: local run + deploy (Expo + Firebase)

---

## Migration Plan (Supabase → Firebase) [Planned]
1. Stand up Firebase project (Auth, Firestore, Storage)
2. Define security rules mirroring current RLS
3. Implement Firebase client layer with same interface as `SyncService`
4. Gradually switch per‑module data source behind feature flags
5. Data migration script (one‑off export/import)

---

## Quick Next Steps
- Pick one module to finish end‑to‑end (e.g., Tasks: categories, due dates, reminders)
- Wire notifications (Expo) for at least one reminder type
- Add charts library and render a simple monthly chart (expenses or habits)
- Decide whether to proceed with Firebase migration now or later
