-- ============================================================
-- Giggly Paws — All Pending Database Migrations
-- Run ALL of these in Supabase SQL Editor
-- ============================================================

-- ── 1. User Approval System ────────────────────────────────
-- Add is_approved column to users table
-- Existing users (including super-admin) are approved by default (true)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true;

-- Add auto_approve_users column to store_settings table
-- Default: true (auto-approve = on, matches existing behavior)
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS auto_approve_users BOOLEAN NOT NULL DEFAULT true;

-- ── 2. Hotel Rates & Package Names ────────────────────────
-- Stores editable hotel rate matrix and booking type labels as JSON
-- These override the hardcoded defaults in the app
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS hotel_rates JSONB;

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS hotel_booking_type_labels JSONB;

-- ── 3. Hotel Add-ons & Services ────────────────────────────
-- Stores the editable list of add-ons (Meal Prep, Reheating, etc.)
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS hotel_extras JSONB;

-- Stores selected add-ons per booking (which add-ons + quantity)
ALTER TABLE hotel_bookings
  ADD COLUMN IF NOT EXISTS hotel_extras JSONB DEFAULT '[]'::jsonb;

-- ── 4. Furparent Updates ─────────────────────────────────────
-- Tracks AM/PM/Evening update status for checked-in pets
-- Staff checks off when they've sent the pet owner an update
ALTER TABLE hotel_bookings
  ADD COLUMN IF NOT EXISTS furparent_updates JSONB DEFAULT '{"am":false,"pm":false,"evening":false}'::jsonb;

-- ── 5. Multi-Pet Grooming Bookings ──────────────────────────
-- Stores additional pets (2nd, 3rd, etc.) in a single grooming booking
-- Each entry: { id, petName, petBreed, petSpecies, serviceId, hairCut, addonIds }
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS pets JSONB DEFAULT '[]'::jsonb;

-- ── 6. Downpayment / Advance Payment ────────────────────────
-- Stores any advance payment collected at booking time
-- Auto-deducted from the final bill at checkout
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS downpayment NUMERIC DEFAULT 0;

ALTER TABLE hotel_bookings
  ADD COLUMN IF NOT EXISTS downpayment NUMERIC DEFAULT 0;

-- ============================================================
-- That's it! Here's what each column does:
--
-- users.is_approved
--   → true  = user can log in
--   → false = user sees "Awaiting Approval" screen at login
--
-- store_settings.auto_approve_users
--   → true  = new users AND new devices are auto-approved
--   → false = admin must manually approve each user/device
--
-- store_settings.hotel_rates
--   → JSON object: { "DAYCARE": { "XS": 400, "S": 450, ... }, ... }
--   → If null, app uses hardcoded default rates
--
-- store_settings.hotel_booking_type_labels
--   → JSON object: { "DAYCARE": "Daycare (9AM-5:30PM)", ... }
--   → If null, app uses hardcoded default labels
--
-- appointments.downpayment / hotel_bookings.downpayment
--   → Amount already paid by client at booking time
--   → Auto-deducted from final bill at checkout
-- ============================================================

-- ── 7. Transactions — downpayment column ────────────────────
-- Required so POS transactions with a downpayment save correctly.
-- Without this column the upsert fails silently and transactions
-- disappear on page refresh.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS downpayment NUMERIC DEFAULT 0;

-- ── 8. Products — species & weight size category ────────────
-- Added for service filtering by pet species and size.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pet_species TEXT DEFAULT 'BOTH';
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS weight_size_category TEXT DEFAULT 'ALL';

-- ── 9. Appointments — pre-applied discounts (Quick Edit) ────
-- Stores a discount pre-selected via "Edit Appointment" so it
-- auto-loads when the groomer opens the payment modal.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "preAppliedDiscountId" TEXT;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "preAppliedSpecialDiscount" NUMERIC DEFAULT 0;

-- ── 10. Appointments — species & size category ──────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "petSpecies" TEXT;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "detectedSizeCategory" TEXT;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "weightSize" TEXT;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "contactNumber" TEXT;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS addon_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS detected_size_category TEXT;

-- ── 11. Store Settings — additional columns ─────────────────
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS auto_approve_users BOOLEAN NOT NULL DEFAULT true;

-- ── 12. Appointments — pre-applied discounts (Quick Edit) ───
-- Stores discount selected via Edit Appointment so it auto-loads
-- in the payment modal. Column names must match mapAppointmentPayload.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "preAppliedDiscountId" TEXT;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "preAppliedSpecialDiscount" NUMERIC DEFAULT 0;

-- ============================================================
-- RUN ALL OF THE ABOVE in the Supabase SQL Editor.
-- Each statement is safe to run multiple times (IF NOT EXISTS).
-- ============================================================
