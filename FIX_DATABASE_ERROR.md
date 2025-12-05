# Fix Database Column Name Error

## Problem
The database has a typo: `dograh_tokens` should be `groq_tokens`

Error message:
```
record "new" has no field "dograh_tokens"
```

## Solution

### Option 1: Apply via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `apply-migration-004.sql`
4. Click **Run** to execute the migration
5. Restart your backend server

### Option 2: Apply via Command Line
```bash
# If you have psql installed and configured
psql -h <your-supabase-host> -U postgres -d postgres -f apply-migration-004.sql
```

### Option 3: Manual Steps in Supabase SQL Editor
Run these commands one by one:

```sql
-- 1. Rename the column
ALTER TABLE agent_runs RENAME COLUMN dograh_tokens TO groq_tokens;

-- 2. Drop old trigger and function
DROP TRIGGER IF EXISTS trigger_calculate_dograh_tokens ON agent_runs;
DROP FUNCTION IF EXISTS calculate_dograh_tokens();

-- 3. Create new function with correct name
CREATE OR REPLACE FUNCTION calculate_groq_tokens()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.duration_seconds > 0 THEN
    NEW.groq_tokens = ROUND((NEW.duration_seconds * 0.013)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create new trigger
CREATE TRIGGER trigger_calculate_groq_tokens
BEFORE UPDATE OF status ON agent_runs
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION calculate_groq_tokens();
```

## After Applying Migration
1. Restart your backend server: `npm run dev` (in backend folder)
2. Test a web call to verify it works
3. Check that the error is gone

## Verification
After applying, you can verify with:
```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agent_runs' AND column_name = 'groq_tokens';

-- Should return one row showing groq_tokens column
```
