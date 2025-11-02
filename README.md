# LifeSync - Complete Life Management App

LifeSync is a comprehensive mobile application built with React Native (Expo) and Supabase that helps you manage all aspects of your daily life including goals, habits, tasks, expenses, and Islamic practices.

## Features

### 1. Home Dashboard
- Quick stats from all modules
- Daily motivational quotes
- Sync status indicator (online/offline)
- Quick action buttons for common tasks

### 2. Goal Tracker
- Create and manage goals with categories (Personal, Fitness, Career, Spiritual, Financial)
- Track progress with visual progress bars
- Set milestones for each goal
- Complete goals and view history

### 3. Habits & Fitness Tracker
- **Daily Habits**: Track habits with streak counters
- **Water Intake**: Log daily water consumption with quick add buttons
- **Gym Tracker**: Workout logging and progress tracking with exercise library
- **Meal Tracker**: Nutrition tracking with calories and macros logging

### 4. Task Manager
- Create and organize tasks
- Mark tasks as complete
- Priority levels
- Category organization

### 5. Expense Tracker
- Log daily expenses
- Track monthly spending
- Income tracking
- Loan management (given and taken)

### 6. Islamic Section
- **Tasbeeh Counter**: Digital counter for zikr with save functionality
- **Quran Progress**: Track reading progress with surah/ayah tracking
- **Charity Reminders**: Recurring charity reminders with notifications
- **Prayer Tracker**: Daily prayer completion tracking with calendar view

### 7. Core Features
- **Authentication**: Simple email/password signup and login
- **Offline Mode**: All data stored locally with AsyncStorage
- **Auto-Sync**: Automatically syncs when internet connection is restored
- **Dark/Light Theme**: Toggle between themes in settings
- **Data Backup**: Manual sync option in settings

## Tech Stack

- **Frontend**: React Native with Expo SDK 54
- **Routing**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL)
- **Offline Storage**: AsyncStorage
- **Networking**: NetInfo for connectivity detection
- **Styling**: React Native StyleSheet with custom theming
- **Icons**: Lucide React Native
- **Date Handling**: date-fns

## Project Structure

```
project/
├── app/
│   ├── (auth)/              # Authentication screens
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/              # Main app tabs
│   │   ├── index.tsx        # Home dashboard
│   │   ├── goals.tsx        # Goal tracker
│   │   ├── habits.tsx       # Habits & fitness
│   │   ├── tasks.tsx        # Task manager
│   │   ├── expenses.tsx     # Expense tracker
│   │   └── islamic.tsx      # Islamic features
│   ├── settings.tsx         # Settings screen
│   └── _layout.tsx          # Root layout
├── components/              # Reusable components
│   ├── Button.tsx
│   ├── Card.tsx
│   └── ScreenHeader.tsx
├── contexts/                # React contexts
│   ├── AuthContext.tsx      # Authentication state
│   └── ThemeContext.tsx     # Theme management
├── lib/                     # Core utilities
│   ├── supabase.ts          # Supabase client
│   ├── storage.ts           # Offline storage
│   └── sync.ts              # Sync service
└── assets/                  # Images and fonts
```

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Expo CLI (installed via npm)
- iOS Simulator (Mac) or Android Studio (for testing)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
The `.env` file is already configured with Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Running the App

#### Development Mode (Web)
```bash
npm run dev
```
Then press `w` to open in web browser.

#### Build for Web
```bash
npm run build:web
```

#### Build for Mobile (requires export to local environment)
Since this is an Expo managed workflow, to build for iOS/Android:
1. Run `npx expo prebuild` to generate native projects
2. Use EAS Build: `npx eas build --platform android` or `--platform ios`

## Database Schema

The app uses Supabase with the following main tables:

- `profiles` - User profile information
- `goals` & `goal_milestones` - Goal tracking
- `habits` & `habit_logs` - Habit tracking
- `workouts`, `exercises`, `workout_logs` - Gym tracking
- `meals` & `water_logs` - Nutrition tracking
- `tasks` & `task_categories` - Task management
- `expenses`, `incomes`, `loans` - Financial tracking
- `quran_progress`, `tasbeeh_logs`, `charity_reminders` - Islamic features
- `friendships` - Social features

All tables have Row Level Security (RLS) enabled to ensure data privacy.

## Offline Mode

The app works completely offline using AsyncStorage:
- All data is stored locally when offline
- Changes are marked as "unsynced"
- When internet connection is restored, data automatically syncs to Supabase
- Manual sync option available in Settings

## Authentication

Simple email/password authentication:
- Sign up with email, password, and full name
- Sign in with credentials
- Profile stored in Supabase
- Session persisted in AsyncStorage

## Theming

Two built-in themes:
- **Light Mode**: Clean white background with blue accents
- **Dark Mode**: Dark gray background with lighter blue accents

Toggle in Settings. Theme preference is saved locally.

## Future Enhancements

Potential improvements for future releases:
- Push notifications for all reminders (infrastructure ready, needs wiring)
- Friend leaderboards for motivation
- Export data to CSV/PDF
- Calendar view for tasks and events
- Analytics and insights dashboard with charts
- Goal deadlines and reminder notifications
- Enhanced workout analytics and progress charts

## Development Notes

### Adding New Features

1. **Database Changes**: Use Supabase migrations via the `mcp__supabase__apply_migration` tool
2. **New Screens**: Add to appropriate route group in `app/` directory
3. **Offline Support**: Use `SyncService` methods for all data operations
4. **Styling**: Follow existing pattern with `createStyles()` function using theme colors

### Type Safety

TypeScript is fully configured. Run type checking:
```bash
npm run typecheck
```

### Code Style

- Use functional components with hooks
- Follow Expo Router file-based routing conventions
- Keep components small and focused
- Use custom hooks for shared logic

## Troubleshooting

### Build Issues
- Clear cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Sync Not Working
- Check internet connection
- Verify Supabase credentials in `.env`
- Check browser console for errors
- Manual sync available in Settings

### Theme Not Persisting
- AsyncStorage might be cleared
- Check that theme toggle in Settings is working
- Theme is stored at key `@lifesync_theme`

## License

This project is private and for demonstration purposes.

## Support

For issues or questions, refer to the codebase documentation or Expo/Supabase official documentation.
