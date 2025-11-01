# Setting Up Your Own Supabase Project

## Step 1: Create Supabase Account & Project

1. Go to: https://supabase.com/
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up with GitHub, Google, or Email
4. Click **"New Project"**
5. Fill in:
   - **Project Name**: `lifesync` (or any name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: **Free** (for personal use)
6. Click **"Create new project"**
7. Wait 2-3 minutes for project to initialize

## Step 2: Get Your Supabase Credentials

Once your project is created:

1. Go to **Settings** (gear icon) → **API**
2. You'll see:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: A long JWT token

Copy both of these!

## Step 3: Run Database Migration

Your app needs the database tables. You have a migration file ready:

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Open the file: `supabase/migrations/20251029001922_create_lifesync_schema.sql`
4. Copy the ENTIRE contents of that file
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. Wait for it to complete (should show "Success")

This creates all your tables (goals, habits, tasks, expenses, etc.)

## Step 4: Update Your .env File

1. Open your `.env` file in the project root
2. Replace the values with your NEW Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_new_anon_key_here
```

3. Save the file

## Step 5: Restart Your App

1. Stop your current dev server (Ctrl+C)
2. Run: `npm run dev`
3. Test the app - it should now connect to YOUR Supabase project!

## Step 6: Access Your Database Dashboard

Now you can:
- **View data**: Go to **Table Editor** in Supabase Dashboard
- **Run queries**: Use **SQL Editor**
- **Manage users**: Go to **Authentication** section
- **See storage**: Check **Storage** section

---

## Quick Check After Setup

In Supabase SQL Editor, run:

```sql
-- See all your tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see: profiles, goals, habits, tasks, expenses, etc.

---

## Need Help?

If you encounter issues:
- Check Supabase Dashboard → Logs for errors
- Verify your .env file has correct credentials
- Make sure migration ran successfully

