-- ============================================================
-- Giggly Paws Hotel Rooms — Reset to Actual Current Rooms
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Delete all existing rooms
--   (safe if no active CHECKED_IN bookings reference them)
DELETE FROM hotel_rooms;

-- Step 2: Insert the actual 5 rooms
--   3 Small Cages  -->  S1, S2, S3
--   2 Large Cages  -->  L1, L2

INSERT INTO hotel_rooms (id, room_number, room_name, room_type, daily_rate, capacity, description, is_active)
VALUES
  (gen_random_uuid(), 'S1', 'Small Cage 1', 'Small Cage',  0, 1, 'Small cage for XS-M pets', true),
  (gen_random_uuid(), 'S2', 'Small Cage 2', 'Small Cage',  0, 1, 'Small cage for XS-M pets', true),
  (gen_random_uuid(), 'S3', 'Small Cage 3', 'Small Cage',  0, 1, 'Small cage for XS-M pets', true),
  (gen_random_uuid(), 'L1', 'Large Cage 1', 'Large Cage',  0, 1, 'Large cage for L-XXL pets', true),
  (gen_random_uuid(), 'L2', 'Large Cage 2', 'Large Cage',  0, 1, 'Large cage for L-XXL pets', true);

-- ============================================================
-- Done! 5 rooms total:
--   S1 Small Cage 1   (Small Cage)
--   S2 Small Cage 2   (Small Cage)
--   S3 Small Cage 3   (Small Cage)
--   L1 Large Cage 1   (Large Cage)
--   L2 Large Cage 2   (Large Cage)
-- ============================================================
