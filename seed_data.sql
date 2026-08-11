-- ============================================================
--  GigglyPaws POS – SEED DATA RESTORE
--  Run this in your Supabase SQL Editor.
--  Safe to run multiple times (idempotent).
-- ============================================================


-- ─────────────────────────────────────────
-- 1. ADD MISSING COLUMNS (safe, idempotent)
--    Adds columns your current schema is missing.
-- ─────────────────────────────────────────

-- hotel_vat_enabled
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='hotel_vat_enabled') THEN
    ALTER TABLE store_settings ADD COLUMN hotel_vat_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Hotel SMS/Email template columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='sms_template_hotel_booked') THEN
    ALTER TABLE store_settings ADD COLUMN sms_template_hotel_booked text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='email_subject_hotel_booked') THEN
    ALTER TABLE store_settings ADD COLUMN email_subject_hotel_booked text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='email_body_hotel_booked') THEN
    ALTER TABLE store_settings ADD COLUMN email_body_hotel_booked text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='sms_template_hotel_checkin') THEN
    ALTER TABLE store_settings ADD COLUMN sms_template_hotel_checkin text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='email_subject_hotel_checkin') THEN
    ALTER TABLE store_settings ADD COLUMN email_subject_hotel_checkin text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='email_body_hotel_checkin') THEN
    ALTER TABLE store_settings ADD COLUMN email_body_hotel_checkin text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='sms_template_hotel_reminder') THEN
    ALTER TABLE store_settings ADD COLUMN sms_template_hotel_reminder text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='email_subject_hotel_reminder') THEN
    ALTER TABLE store_settings ADD COLUMN email_subject_hotel_reminder text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='email_body_hotel_reminder') THEN
    ALTER TABLE store_settings ADD COLUMN email_body_hotel_reminder text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='sms_template_hotel_checkout') THEN
    ALTER TABLE store_settings ADD COLUMN sms_template_hotel_checkout text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='email_subject_hotel_checkout') THEN
    ALTER TABLE store_settings ADD COLUMN email_subject_hotel_checkout text DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='email_body_hotel_checkout') THEN
    ALTER TABLE store_settings ADD COLUMN email_body_hotel_checkout text DEFAULT '';
  END IF;
END $$;

-- Products: pet species + size filtering columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='pet_species') THEN
    ALTER TABLE public.products ADD COLUMN pet_species text DEFAULT 'BOTH';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='weight_size_category') THEN
    ALTER TABLE public.products ADD COLUMN weight_size_category text DEFAULT 'ALL';
  END IF;
END $$;

-- Appointments: addon_ids + species/size
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='addon_ids') THEN
    ALTER TABLE appointments ADD COLUMN addon_ids jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='pet_species') THEN
    ALTER TABLE public.appointments ADD COLUMN pet_species text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='detected_size_category') THEN
    ALTER TABLE public.appointments ADD COLUMN detected_size_category text;
  END IF;
END $$;


-- ─────────────────────────────────────────
-- 2. HOTEL TABLES (safe if already exist)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hotel_rooms (
  id          text primary key,
  room_number text not null,
  room_name   text,
  room_type   text default 'Standard',
  daily_rate  numeric not null default 0,
  capacity    integer not null default 1,
  description text,
  is_active   boolean not null default true
);
ALTER TABLE public.hotel_rooms ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hotel_rooms' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON public.hotel_rooms FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.hotel_bookings (
  id               text primary key,
  room_id          text not null,
  client_id        text,
  pet_id           text,
  pet_name         text not null,
  owner_name       text not null,
  contact_number   text,
  email            text,
  check_in         text,
  check_out        text,
  actual_check_in  text,
  actual_check_out text,
  status           text not null default 'RESERVED',
  daily_rate       numeric not null default 0,
  total_nights     integer not null default 0,
  total_amount     numeric not null default 0,
  addon_ids        jsonb default '[]'::jsonb,
  notes            text,
  staff_id         text,
  transaction_id   text
);
ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hotel_bookings' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON public.hotel_bookings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────
-- 3. ADMIN USER  (PIN: 1234)
-- ─────────────────────────────────────────
INSERT INTO public.users (id, name, pin, role)
VALUES (
  'super-admin',
  'Admin',
  'admin-salt-2024:904e57929497534475459371060932c0202979774620572da93630f9a239b03c',
  'ADMIN'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  pin  = EXCLUDED.pin,
  role = EXCLUDED.role;


-- ─────────────────────────────────────────
-- 4. STORE SETTINGS
-- ─────────────────────────────────────────
INSERT INTO public.store_settings (
  id, name, address, "contactNumber", "vatRate",
  hotel_vat_enabled,
  "gcashNumber", "gcashQr", "receiptHeader", "receiptFooter", logo,
  receipt_paper_size, sms_enabled, email_enabled,
  email_sender_name, email_footer_text,
  sms_template_upcoming, email_subject_upcoming, email_body_upcoming,
  sms_template_waiting,  email_subject_waiting,  email_body_waiting,
  sms_template_ongoing,  email_subject_ongoing,  email_body_ongoing,
  sms_template_completed,email_subject_completed,email_body_completed,
  sms_template_promo,    email_subject_promo,    email_body_promo,
  sms_template_hotel_booked,   email_subject_hotel_booked,   email_body_hotel_booked,
  sms_template_hotel_checkin,  email_subject_hotel_checkin,  email_body_hotel_checkin,
  sms_template_hotel_reminder, email_subject_hotel_reminder, email_body_hotel_reminder,
  sms_template_hotel_checkout, email_subject_hotel_checkout, email_body_hotel_checkout
)
VALUES (
  'global_settings', 'GigglyPaws Pet Shop', '123 Dogwood Lane, Manila',
  '0917-000-0000', 12,
  false,
  '0917-123-4567', '', 'Thank you for choosing GigglyPaws!', 'No return, no exchange after 7 days.', '',
  '80mm', false, false,
  'GigglyPaws', 'Thank you for trusting us with your furry friend!',
  'Hi {ownerName}! This is a reminder for {petName}''s appointment at {shopName} on {date} at {time}. See you!',
  'Upcoming Appointment Reminder - {shopName}',
  'We are excited to see {petName} soon! This is a reminder for your appointment on <b>{date}</b> at <b>{time}</b>.',
  'Hi {ownerName}, {petName} is now checked in and waiting for their turn. We''ll start shortly!',
  '{petName} is checked in!',
  '{petName} has been successfully checked in. We will take great care of them!',
  'Update: {petName}''s grooming session has started! We''re making them look fabulous.',
  'Grooming Started for {petName}',
  'Our groomers have started working their magic on {petName}. We will notify you once they are ready for pickup.',
  'Good news {ownerName}! {petName} is ready for pickup! Total due: P{price}. See you soon!',
  '{petName} is Ready for Pickup!',
  'Good news! <b>{petName}</b> is looking fresh, clean, and amazing. They are ready to be picked up at your convenience.',
  '{shopName} PROMO: {promoName}! Get {discountValue}. {rules} Valid until {endDate}. Visit us at {shopName}!',
  'Special Promo: {promoName}',
  'Hello Fur Parent! We have a special treat for you: {promoName}. Get {discountValue}. {rules}. Valid until: {endDate}. Visit us at {shopName}, {address}',
  'Hi {ownerName}! {petName}''s stay at {shopName} is confirmed. Room: {roomNumber} | Check-in: {checkIn} | Check-out: {checkOut}. See you!',
  'Booking Confirmed - {petName}''s Stay at {shopName}',
  'Hi {ownerName}!<br><br>We are excited to welcome <b>{petName}</b>!<br><br><b>Room:</b> {roomNumber}<br><b>Check-in:</b> {checkIn}<br><b>Check-out:</b> {checkOut}<br><b>Total:</b> P{totalAmount}<br><br>See you soon!',
  'Hi {ownerName}! {petName} is now checked in at {shopName}, Room {roomNumber}. We will take great care of them!',
  '{petName} Has Checked In!',
  'Great news, {ownerName}!<br><br><b>{petName}</b> has been successfully checked into Room {roomNumber} at {shopName}. We will take great care of them until {checkOut}.',
  'Hi {ownerName}! Reminder: {petName}''s check-out at {shopName} is tomorrow, {checkOut}. See you then!',
  'Check-Out Reminder for {petName} Tomorrow',
  'Hi {ownerName}!<br><br>Just a friendly reminder that <b>{petName}</b> is scheduled to check out from {shopName} tomorrow, <b>{checkOut}</b>. We look forward to seeing you!',
  'Hi {ownerName}! {petName} is ready for pick-up at {shopName}. Total: P{totalAmount}. Thank you for choosing us!',
  '{petName} is Ready for Pick-Up!',
  'Hi {ownerName}!<br><br><b>{petName}</b> had a wonderful stay and is now ready to go home!<br><br><b>Room:</b> {roomNumber}<br><b>Stay:</b> {checkIn} - {checkOut}<br><b>Total Amount:</b> P{totalAmount}<br><br>Thank you for trusting us with your fur baby!'
)
ON CONFLICT (id) DO UPDATE SET
  name                         = EXCLUDED.name,
  address                      = EXCLUDED.address,
  "contactNumber"              = EXCLUDED."contactNumber",
  "vatRate"                    = EXCLUDED."vatRate",
  hotel_vat_enabled            = EXCLUDED.hotel_vat_enabled,
  "gcashNumber"                = EXCLUDED."gcashNumber",
  "receiptHeader"              = EXCLUDED."receiptHeader",
  "receiptFooter"              = EXCLUDED."receiptFooter",
  receipt_paper_size           = EXCLUDED.receipt_paper_size,
  sms_enabled                  = EXCLUDED.sms_enabled,
  email_enabled                = EXCLUDED.email_enabled,
  email_sender_name            = EXCLUDED.email_sender_name,
  email_footer_text            = EXCLUDED.email_footer_text,
  sms_template_upcoming        = EXCLUDED.sms_template_upcoming,
  email_subject_upcoming       = EXCLUDED.email_subject_upcoming,
  email_body_upcoming          = EXCLUDED.email_body_upcoming,
  sms_template_waiting         = EXCLUDED.sms_template_waiting,
  email_subject_waiting        = EXCLUDED.email_subject_waiting,
  email_body_waiting           = EXCLUDED.email_body_waiting,
  sms_template_ongoing         = EXCLUDED.sms_template_ongoing,
  email_subject_ongoing        = EXCLUDED.email_subject_ongoing,
  email_body_ongoing           = EXCLUDED.email_body_ongoing,
  sms_template_completed       = EXCLUDED.sms_template_completed,
  email_subject_completed      = EXCLUDED.email_subject_completed,
  email_body_completed         = EXCLUDED.email_body_completed,
  sms_template_promo           = EXCLUDED.sms_template_promo,
  email_subject_promo          = EXCLUDED.email_subject_promo,
  email_body_promo             = EXCLUDED.email_body_promo,
  sms_template_hotel_booked    = EXCLUDED.sms_template_hotel_booked,
  email_subject_hotel_booked   = EXCLUDED.email_subject_hotel_booked,
  email_body_hotel_booked      = EXCLUDED.email_body_hotel_booked,
  sms_template_hotel_checkin   = EXCLUDED.sms_template_hotel_checkin,
  email_subject_hotel_checkin  = EXCLUDED.email_subject_hotel_checkin,
  email_body_hotel_checkin     = EXCLUDED.email_body_hotel_checkin,
  sms_template_hotel_reminder  = EXCLUDED.sms_template_hotel_reminder,
  email_subject_hotel_reminder = EXCLUDED.email_subject_hotel_reminder,
  email_body_hotel_reminder    = EXCLUDED.email_body_hotel_reminder,
  sms_template_hotel_checkout  = EXCLUDED.sms_template_hotel_checkout,
  email_subject_hotel_checkout = EXCLUDED.email_subject_hotel_checkout,
  email_body_hotel_checkout    = EXCLUDED.email_body_hotel_checkout;


-- ─────────────────────────────────────────
-- 5. PRODUCT CATEGORIES
-- ─────────────────────────────────────────
INSERT INTO public.product_categories (name) VALUES
  ('FOOD'), ('TOYS'), ('ACCESSORIES'), ('CARE'), ('GROOMING')
ON CONFLICT (name) DO NOTHING;


-- ─────────────────────────────────────────
-- 6. SERVICE CATEGORIES
-- ─────────────────────────────────────────
INSERT INTO public.service_categories (name) VALUES
  ('GROOMING'), ('SPA'), ('CONSULTATION')
ON CONFLICT (name) DO NOTHING;


-- ─────────────────────────────────────────
-- 7. REALTIME
-- ─────────────────────────────────────────
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.users;             EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;           EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;    EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products;          EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories;EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.service_categories;EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;           EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;      EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;      EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.discounts;         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;              EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;          EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.template_history;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hotel_rooms;       EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hotel_bookings;    EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;


-- ─────────────────────────────────────────
-- 8. UTILITY FUNCTION
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_database_size_bytes()
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT pg_database_size(current_database());
$$;


-- ─────────────────────────────────────────
-- 9. REPLICA IDENTITY
-- ─────────────────────────────────────────
ALTER TABLE store_settings  REPLICA IDENTITY FULL;
ALTER TABLE products        REPLICA IDENTITY FULL;
ALTER TABLE appointments    REPLICA IDENTITY FULL;
ALTER TABLE transactions    REPLICA IDENTITY FULL;
ALTER TABLE clients         REPLICA IDENTITY FULL;
ALTER TABLE users           REPLICA IDENTITY FULL;
ALTER TABLE devices         REPLICA IDENTITY FULL;
ALTER TABLE messages        REPLICA IDENTITY FULL;


-- ─────────────────────────────────────────
-- 10. GROOMING SERVICES (from pricelist)
--     DOG: 8 packages × 6 sizes = 48 services
--     DOG add-ons: 4  |  DOG ala carte: 7 × 6 sizes = 42
--     CAT: 6 packages + 7 ala carte = 13 services
-- ─────────────────────────────────────────

-- DOG BASIC
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-basic-xs',  'Dog Basic - XS (0–2kg)',      250, 0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-basic-s',   'Dog Basic - Small (2–5kg)',    300, 0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-basic-m',   'Dog Basic - Medium (5–10kg)',  400, 0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-basic-l',   'Dog Basic - Large (10–16kg)',  600, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-basic-xl',  'Dog Basic - XLarge (16–25kg)', 750, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-basic-xxl', 'Dog Basic - XXLarge (25kg+)',  900, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG LUXURY BASIC (HYDRA)
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-luxbasic-xs',  'Dog Luxury Basic Hydra - XS',      350,  0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-luxbasic-s',   'Dog Luxury Basic Hydra - Small',   400,  0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-luxbasic-m',   'Dog Luxury Basic Hydra - Medium',  500,  0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-luxbasic-l',   'Dog Luxury Basic Hydra - Large',   750,  0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-luxbasic-xl',  'Dog Luxury Basic Hydra - XLarge',  900,  0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-luxbasic-xxl', 'Dog Luxury Basic Hydra - XXLarge', 1100, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG GRANDE
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-grande-xs',  'Dog Grande - XS',      350,  0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-grande-s',   'Dog Grande - Small',   400,  0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-grande-m',   'Dog Grande - Medium',  500,  0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-grande-l',   'Dog Grande - Large',   700,  0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-grande-xl',  'Dog Grande - XLarge',  900,  0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-grande-xxl', 'Dog Grande - XXLarge', 1100, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG LUXURY GRANDE (HYDRA)
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-luxgrande-xs',  'Dog Luxury Grande Hydra - XS',      450,  0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-luxgrande-s',   'Dog Luxury Grande Hydra - Small',   500,  0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-luxgrande-m',   'Dog Luxury Grande Hydra - Medium',  600,  0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-luxgrande-l',   'Dog Luxury Grande Hydra - Large',   850,  0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-luxgrande-xl',  'Dog Luxury Grande Hydra - XLarge',  1050, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-luxgrande-xxl', 'Dog Luxury Grande Hydra - XXLarge', 1300, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG PREMIUM
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-premium-xs',  'Dog Premium - XS',      450,  0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-premium-s',   'Dog Premium - Small',   550,  0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-premium-m',   'Dog Premium - Medium',  650,  0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-premium-l',   'Dog Premium - Large',   900,  0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-premium-xl',  'Dog Premium - XLarge',  1050, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-premium-xxl', 'Dog Premium - XXLarge', 1250, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG LUXURY PREMIUM (HYDRA)
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-luxpremium-xs',  'Dog Luxury Premium Hydra - XS',      550,  0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-luxpremium-s',   'Dog Luxury Premium Hydra - Small',   650,  0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-luxpremium-m',   'Dog Luxury Premium Hydra - Medium',  750,  0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-luxpremium-l',   'Dog Luxury Premium Hydra - Large',   1050, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-luxpremium-xl',  'Dog Luxury Premium Hydra - XLarge',  1200, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-luxpremium-xxl', 'Dog Luxury Premium Hydra - XXLarge', 1450, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG DELUXE
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-deluxe-xs',  'Dog Deluxe - XS',      600,  0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-deluxe-s',   'Dog Deluxe - Small',   700,  0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-deluxe-m',   'Dog Deluxe - Medium',  800,  0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-deluxe-l',   'Dog Deluxe - Large',   1000, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-deluxe-xl',  'Dog Deluxe - XLarge',  1250, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-deluxe-xxl', 'Dog Deluxe - XXLarge', 1400, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG LUXURY (HYDRA)
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-luxury-xs',  'Dog Luxury Hydra - XS',      700,  0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-luxury-s',   'Dog Luxury Hydra - Small',   800,  0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-luxury-m',   'Dog Luxury Hydra - Medium',  900,  0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-luxury-l',   'Dog Luxury Hydra - Large',   1150, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-luxury-xl',  'Dog Luxury Hydra - XLarge',  1450, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-luxury-xxl', 'Dog Luxury Hydra - XXLarge', 1600, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG ADD-ONS (size-agnostic, show for all dog sizes)
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-addon-dematting',    'Dematting',        0, 0, 999, 'GROOMING', true, 'DOG', 'ALL'),
  ('dog-addon-antiodor',     'Anti Odor',        0, 0, 999, 'GROOMING', true, 'DOG', 'ALL'),
  ('dog-addon-whitening',    'Whitening',        0, 0, 999, 'GROOMING', true, 'DOG', 'ALL'),
  ('dog-addon-antitickflea', 'Anti Tick & Flea', 0, 0, 999, 'GROOMING', true, 'DOG', 'ALL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG ALA CARTE – XS
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-ac-earclean-xs',  'Ear Cleaning',       100, 0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-ac-earsoln-xs',   'Ear Solution',       100, 0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-ac-nailcut-xs',   'Nail Cut',           100, 0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-ac-facetrim-xs',  'Face Trim',          250, 0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-ac-pawtrim-xs',   'Paw Trim',           150, 0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-ac-buttshave-xs', 'Butt & Belly Shave', 250, 0, 999, 'GROOMING', true, 'DOG', 'XS'),
  ('dog-ac-cologne-xs',   'Cologne',            100, 0, 999, 'GROOMING', true, 'DOG', 'XS')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG ALA CARTE – S
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-ac-earclean-s',  'Ear Cleaning',       100, 0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-ac-earsoln-s',   'Ear Solution',       100, 0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-ac-nailcut-s',   'Nail Cut',           100, 0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-ac-facetrim-s',  'Face Trim',          250, 0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-ac-pawtrim-s',   'Paw Trim',           150, 0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-ac-buttshave-s', 'Butt & Belly Shave', 250, 0, 999, 'GROOMING', true, 'DOG', 'S'),
  ('dog-ac-cologne-s',   'Cologne',            100, 0, 999, 'GROOMING', true, 'DOG', 'S')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG ALA CARTE – M
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-ac-earclean-m',  'Ear Cleaning',       100, 0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-ac-earsoln-m',   'Ear Solution',       100, 0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-ac-nailcut-m',   'Nail Cut',           125, 0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-ac-facetrim-m',  'Face Trim',          300, 0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-ac-pawtrim-m',   'Paw Trim',           300, 0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-ac-buttshave-m', 'Butt & Belly Shave', 300, 0, 999, 'GROOMING', true, 'DOG', 'M'),
  ('dog-ac-cologne-m',   'Cologne',            150, 0, 999, 'GROOMING', true, 'DOG', 'M')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG ALA CARTE – L
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-ac-earclean-l',  'Ear Cleaning',       100, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-ac-earsoln-l',   'Ear Solution',       100, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-ac-nailcut-l',   'Nail Cut',           125, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-ac-facetrim-l',  'Face Trim',          300, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-ac-pawtrim-l',   'Paw Trim',           300, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-ac-buttshave-l', 'Butt & Belly Shave', 300, 0, 999, 'GROOMING', true, 'DOG', 'L'),
  ('dog-ac-cologne-l',   'Cologne',            150, 0, 999, 'GROOMING', true, 'DOG', 'L')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG ALA CARTE – XL
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-ac-earclean-xl',  'Ear Cleaning',       100, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-ac-earsoln-xl',   'Ear Solution',       100, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-ac-nailcut-xl',   'Nail Cut',           125, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-ac-facetrim-xl',  'Face Trim',          300, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-ac-pawtrim-xl',   'Paw Trim',           300, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-ac-buttshave-xl', 'Butt & Belly Shave', 300, 0, 999, 'GROOMING', true, 'DOG', 'XL'),
  ('dog-ac-cologne-xl',   'Cologne',            150, 0, 999, 'GROOMING', true, 'DOG', 'XL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- DOG ALA CARTE – XXL
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('dog-ac-earclean-xxl',  'Ear Cleaning',       100, 0, 999, 'GROOMING', true, 'DOG', 'XXL'),
  ('dog-ac-earsoln-xxl',   'Ear Solution',       100, 0, 999, 'GROOMING', true, 'DOG', 'XXL'),
  ('dog-ac-nailcut-xxl',   'Nail Cut',           150, 0, 999, 'GROOMING', true, 'DOG', 'XXL'),
  ('dog-ac-facetrim-xxl',  'Face Trim',          300, 0, 999, 'GROOMING', true, 'DOG', 'XXL'),
  ('dog-ac-pawtrim-xxl',   'Paw Trim',           300, 0, 999, 'GROOMING', true, 'DOG', 'XXL'),
  ('dog-ac-buttshave-xxl', 'Butt & Belly Shave', 300, 0, 999, 'GROOMING', true, 'DOG', 'XXL'),
  ('dog-ac-cologne-xxl',   'Cologne',            200, 0, 999, 'GROOMING', true, 'DOG', 'XXL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- CAT PACKAGES (flat pricing)
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('cat-basic',     'Cat Basic',                500, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-luxbasic',  'Cat Luxury Basic (Hydra)',  600, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-grande',    'Cat Grande',               700, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-luxgrande', 'Cat Luxury Grande (Hydra)', 600, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-deluxe',    'Cat Deluxe',               750, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-luxury',    'Cat Luxury (Hydra)',        850, 0, 999, 'GROOMING', true, 'CAT', 'ALL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;

-- CAT ALA CARTE
INSERT INTO public.products (id, name, price, cost, stock, category, "isService", pet_species, weight_size_category) VALUES
  ('cat-ac-earclean',  'Cat Ear Cleaning',       150, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-ac-earsoln',   'Cat Ear Solution',       150, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-ac-nailcut',   'Cat Nail Cut',           150, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-ac-facetrim',  'Cat Face Trim',          250, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-ac-pawtrim',   'Cat Paw Trim',           150, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-ac-buttshave', 'Cat Butt & Belly Shave', 250, 0, 999, 'GROOMING', true, 'CAT', 'ALL'),
  ('cat-ac-cologne',   'Cat Cologne Spray',      100, 0, 999, 'GROOMING', true, 'CAT', 'ALL')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
  pet_species=EXCLUDED.pet_species, weight_size_category=EXCLUDED.weight_size_category;


-- ✅ DONE — Login with PIN: 1234 (Admin)
