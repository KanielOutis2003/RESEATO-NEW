-- Fix: Allow multiple users to book the same time slot (different tables).
-- The old constraint was on (restaurant_id, date, time) which blocked all
-- concurrent bookings. The new constraint is on (user_id, restaurant_id, date, time)
-- so only the SAME user is prevented from double-booking.

-- Step 1: Drop all unique constraints/indexes on the reservations table that
-- restrict (restaurant_id, date, time) without user_id.
-- We look for common names; adjust if yours differs.

DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'reservations'
      AND indexdef ILIKE '%unique%'
      AND indexdef ILIKE '%restaurant_id%'
      AND indexdef ILIKE '%date%'
      AND indexdef ILIKE '%time%'
      AND indexdef NOT ILIKE '%user_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
    RAISE NOTICE 'Dropped index: %', idx.indexname;
  END LOOP;
END $$;

-- Also drop any named constraint (common auto-generated names)
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.reservations'::regclass
      AND contype = 'u'  -- unique constraint
  LOOP
    -- Check if this constraint covers restaurant_id+date+time but NOT user_id
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conname = con.conname
        AND c.conrelid = 'public.reservations'::regclass
      GROUP BY c.conname
      HAVING bool_or(a.attname = 'restaurant_id')
         AND bool_or(a.attname = 'date')
         AND bool_or(a.attname = 'time')
         AND NOT bool_or(a.attname = 'user_id')
    ) THEN
      EXECUTE format('ALTER TABLE public.reservations DROP CONSTRAINT %I', con.conname);
      RAISE NOTICE 'Dropped constraint: %', con.conname;
    END IF;
  END LOOP;
END $$;

-- Step 2: Create the correct unique constraint (per-user, per-slot)
CREATE UNIQUE INDEX IF NOT EXISTS reservations_user_restaurant_date_time_unique_idx
  ON public.reservations (user_id, restaurant_id, date, time);
