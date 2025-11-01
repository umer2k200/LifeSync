# Troubleshooting Signup Issues

## Common Signup Errors and Fixes

### Error 1: "permission denied for table profiles"
**Cause**: RLS policy blocking profile creation
**Fix**: Make sure the trigger is set up (runs with SECURITY DEFINER)

Run in Supabase SQL Editor:
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- If not, run the migration file: add_profile_trigger.sql
```

### Error 2: "relation profiles does not exist"
**Cause**: Migration not run
**Fix**: Run the main migration file in Supabase SQL Editor:
- `supabase/migrations/20251029001922_create_lifesync_schema.sql`

### Error 3: "duplicate key value violates unique constraint"
**Cause**: User already exists
**Fix**: Try signing in instead, or use a different email

### Error 4: "Invalid API key" or network errors
**Cause**: Wrong Supabase credentials
**Fix**: Check your `.env` file has correct:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Error 5: Profile creation fails silently
**Cause**: Trigger might not be working
**Fix**: 
1. Check trigger exists in Supabase Dashboard → Database → Functions
2. Test trigger manually:
```sql
-- Check if trigger function exists
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
```

### Error 6: Email confirmation required
**Cause**: Supabase has email confirmation enabled
**Fix**: Either:
1. Disable email confirmation in Supabase Dashboard → Authentication → Settings
2. Or wait for email confirmation before signing in

## Quick Diagnostic Steps

1. **Check browser console** (F12 → Console) for error messages
2. **Check Supabase Dashboard** → Logs for server-side errors
3. **Verify migration ran**:
   - Go to Supabase Dashboard → SQL Editor
   - Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles';`
   - Should return one row

4. **Verify trigger exists**:
   - Run: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
   - Should return one row

5. **Test profile creation manually**:
   - Get your user ID from auth.users table
   - Try: `INSERT INTO profiles (id, email, full_name) VALUES ('user-id-here', 'test@test.com', 'Test');`
   - If this fails, RLS policy issue

## How to Check Error in Terminal

When you see an error:
1. Look for the **exact error message**
2. Check the **line number** where error occurred
3. Look for **Supabase** related errors
4. Check **network errors**

Common patterns:
- `Error: ...` - Client-side error
- `Failed to fetch` - Network error
- `Permission denied` - RLS issue
- `relation does not exist` - Migration not run

