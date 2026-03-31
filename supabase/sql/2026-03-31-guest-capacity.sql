-- Add max_guests_per_table column to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS max_guests_per_table integer NOT NULL DEFAULT 4;

-- Guest capacity configs: per-restaurant guest-range table limits
-- Example: for 1-2 guests → 13 tables, 3-5 guests → 6 tables, 6-12 guests → 2 tables
CREATE TABLE IF NOT EXISTS restaurant_guest_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  min_guests integer NOT NULL CHECK (min_guests >= 1),
  max_guests integer NOT NULL CHECK (max_guests >= min_guests),
  max_tables integer NOT NULL CHECK (max_tables >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, min_guests, max_guests)
);

CREATE INDEX IF NOT EXISTS idx_guest_configs_restaurant
  ON restaurant_guest_configs(restaurant_id);
