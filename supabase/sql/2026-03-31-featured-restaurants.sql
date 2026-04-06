-- Add is_featured boolean column to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Index for efficient homepage query
CREATE INDEX IF NOT EXISTS idx_restaurants_is_featured
  ON restaurants(is_featured) WHERE is_featured = true;
