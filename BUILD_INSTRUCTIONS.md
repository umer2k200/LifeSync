# LifeSync APK Build Instructions

## Prerequisites

1. **EAS CLI** - Already installed ✓
2. **Expo Account** - You'll need to login to Expo
3. **Android Package Name** - Configured in `app.json` as `com.lifesync.app`

## Step 1: Login to Expo

```bash
npx eas login
```

If you don't have an Expo account, create one at: https://expo.dev

## Step 2: Configure EAS Build (First Time Only)

```bash
npx eas build:configure
```

This will create the `eas.json` file (already created for you).

## Step 3: Build APK

You have two options:

### Option A: Build Preview APK (Recommended for Testing)

```bash
npm run build:android
```

Or directly:
```bash
npx eas build --platform android --profile preview
```

This will:
- Build an APK file (not AAB)
- Allow you to test the app without publishing to Play Store
- Build is done on Expo's servers (cloud build)

### Option B: Build Production APK

```bash
npm run build:android:prod
```

Or directly:
```bash
npx eas build --platform android --profile production
```

## Step 4: Download APK

After the build completes (usually takes 10-20 minutes):

1. You'll get a URL in the terminal
2. Or check your builds at: https://expo.dev/accounts/[your-account]/projects/lifesync/builds
3. Download the APK file
4. Install it on your Android device

## Local Build (Alternative)

If you want to build locally (requires Android SDK setup):

```bash
npx eas build --platform android --profile preview --local
```

## Troubleshooting

### If build fails:

1. **Check configuration:**
   ```bash
   npx expo config --type public
   ```

2. **Verify app.json:**
   - Package name: `com.lifesync.app`
   - Version code: `1`
   - All required permissions are listed

3. **Check dependencies:**
   ```bash
   npm install
   ```

4. **Environment variables:**
   - Make sure your `.env` file has all required Supabase variables
   - EAS Build will automatically use environment variables from `.env`

### Common Issues:

- **"Package name already exists"** - Change the package name in `app.json` to something unique
- **"Build timeout"** - Try building again or use local build
- **"Missing icon"** - Ensure `./assets/images/icon.png` exists

## Build Configuration Files

- `app.json` - App configuration (name, package, version)
- `eas.json` - EAS Build profiles and settings
- `package.json` - Dependencies and build scripts

## After Building

Once you have the APK:
1. Transfer it to your Android device
2. Enable "Install from Unknown Sources" in Android settings
3. Tap the APK file to install
4. Test all features thoroughly

## Next Steps

For Play Store submission:
- Build AAB format instead of APK
- Configure signing keys
- Set up Google Play Console
- Submit through EAS Submit

---

**Ready to build?** Run: `npm run build:android`

