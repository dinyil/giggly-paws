-- ============================================================
--  GigglyPaws POS – Complete Supabase SQL Schema
--  Run this in your Supabase SQL Editor (new project)
-- ============================================================

-- ─────────────────────────────────────────
--  1. USERS
-- ─────────────────────────────────────────
create table if not exists public.users (
  id        text primary key,
  name      text not null,
  pin       text not null,   -- format: "SALT:HASH"
  role      text not null    -- 'ADMIN' | 'CASHIER' | 'GROOMER'
);
alter table public.users enable row level security;
create policy "Allow all" on public.users for all using (true) with check (true);

-- ─────────────────────────────────────────
--  2. DEVICES
-- ─────────────────────────────────────────
create table if not exists public.devices (
  id          text primary key,
  name        text,
  custom_name text,
  os          text,
  browser     text,
  device_type text,
  status      text not null default 'PENDING',  -- 'PENDING' | 'APPROVED' | 'BLOCKED'
  "lastActive" text,
  ip          text,
  location    text
);
alter table public.devices enable row level security;
create policy "Allow all" on public.devices for all using (true) with check (true);

-- ─────────────────────────────────────────
--  3. STORE SETTINGS
-- ─────────────────────────────────────────
create table if not exists public.store_settings (
  id                          text primary key default 'global_settings',
  name                        text,
  address                     text,
  "contactNumber"             text,
  "vatRate"                   numeric default 12,
  hotel_vat_enabled           boolean default false,
  "gcashNumber"               text,
  "gcashQr"                   text,
  "receiptHeader"             text,
  "receiptFooter"             text,
  logo                        text,

  -- SMS
  sms_enabled                 boolean default false,
  text_bee_api_key            text,
  text_bee_device_id          text,

  -- Email / Google
  email_enabled               boolean default false,
  email_sender_name           text,
  email_footer_text           text,
  google_client_id            text,
  google_client_secret        text,
  google_refresh_token        text,

  -- Grooming Templates
  sms_template_upcoming       text,
  email_subject_upcoming      text,
  email_body_upcoming         text,
  sms_template_waiting        text,
  email_subject_waiting       text,
  email_body_waiting          text,
  sms_template_ongoing        text,
  email_subject_ongoing       text,
  email_body_ongoing          text,
  sms_template_completed      text,
  email_subject_completed     text,
  email_body_completed        text,

  -- Promo Templates
  sms_template_promo          text,
  email_subject_promo         text,
  email_body_promo            text,

  -- Hotel Templates
  sms_template_hotel_booked   text,
  email_subject_hotel_booked  text,
  email_body_hotel_booked     text,
  sms_template_hotel_checkin  text,
  email_subject_hotel_checkin text,
  email_body_hotel_checkin    text,
  sms_template_hotel_reminder text,
  email_subject_hotel_reminder text,
  email_body_hotel_reminder   text,
  sms_template_hotel_checkout text,
  email_subject_hotel_checkout text,
  email_body_hotel_checkout   text
);
alter table public.store_settings enable row level security;
create policy "Allow all" on public.store_settings for all using (true) with check (true);

-- ─────────────────────────────────────────
--  4. PRODUCTS & SERVICES
-- ─────────────────────────────────────────
create table if not exists public.products (
  id        text primary key,
  name      text not null,
  price     numeric not null default 0,
  cost      numeric not null default 0,
  category  text,
  stock     integer not null default 0,
  "isService" boolean not null default false
);
alter table public.products enable row level security;
create policy "Allow all" on public.products for all using (true) with check (true);

-- ─────────────────────────────────────────
--  5. PRODUCT CATEGORIES
-- ─────────────────────────────────────────
create table if not exists public.product_categories (
  id   text primary key default gen_random_uuid()::text,
  name text not null unique
);
alter table public.product_categories enable row level security;
create policy "Allow all" on public.product_categories for all using (true) with check (true);

-- ─────────────────────────────────────────
--  6. SERVICE CATEGORIES
-- ─────────────────────────────────────────
create table if not exists public.service_categories (
  id   text primary key default gen_random_uuid()::text,
  name text not null unique
);
alter table public.service_categories enable row level security;
create policy "Allow all" on public.service_categories for all using (true) with check (true);

-- ─────────────────────────────────────────
--  7. CLIENTS
-- ─────────────────────────────────────────
create table if not exists public.clients (
  id             text primary key,
  name           text not null,
  contact_number text,
  email          text,
  address        text,
  notes          text,
  first_seen     text,
  pets           jsonb default '[]'::jsonb   -- Array of Pet objects
);
alter table public.clients enable row level security;
create policy "Allow all" on public.clients for all using (true) with check (true);

-- ─────────────────────────────────────────
--  8. TRANSACTIONS
-- ─────────────────────────────────────────
create table if not exists public.transactions (
  id              text primary key,
  items           jsonb not null default '[]'::jsonb,
  subtotal        numeric not null default 0,
  vat             numeric not null default 0,
  total           numeric not null default 0,
  discount        numeric not null default 0,
  "paymentMethod" text not null default 'CASH',  -- 'CASH' | 'GCASH' | 'SPLIT'
  "gcashRef"      text,
  "cashReceived"  numeric,
  "cashierId"     text,
  date            text
);
alter table public.transactions enable row level security;
create policy "Allow all" on public.transactions for all using (true) with check (true);

-- ─────────────────────────────────────────
--  9. GROOMING APPOINTMENTS
-- ─────────────────────────────────────────
create table if not exists public.appointments (
  id              text primary key,
  "petName"       text,
  "petBreed"      text,
  "petColor"      text,
  "weightSize"    text,
  "ownerName"     text,
  "contactNumber" text,
  email           text,
  "serviceId"     text,
  "hairCut"       text,
  date            text,
  time            text,
  status          text default 'SCHEDULED',  -- 'SCHEDULED' | 'ONGOING' | 'COMPLETED'
  "groomerId"     text
);
alter table public.appointments enable row level security;
create policy "Allow all" on public.appointments for all using (true) with check (true);

-- ─────────────────────────────────────────
--  10. DISCOUNTS / PROMOS
-- ─────────────────────────────────────────
create table if not exists public.discounts (
  id            text primary key,
  name          text not null,
  type          text not null,     -- 'PERCENTAGE' | 'FIXED'
  value         numeric not null default 0,
  active        boolean not null default true,
  trigger_type  text default 'MANUAL',
  trigger_value text,
  is_permanent  boolean default true,
  start_date    text,
  end_date      text
);
alter table public.discounts enable row level security;
create policy "Allow all" on public.discounts for all using (true) with check (true);

-- ─────────────────────────────────────────
--  11. LOGS / AUDIT TRAIL
-- ─────────────────────────────────────────
create table if not exists public.logs (
  id            text primary key,
  action        text,
  details       text,
  timestamp     text,
  "userId"      text,
  "referenceId" text
);
alter table public.logs enable row level security;
create policy "Allow all" on public.logs for all using (true) with check (true);

-- ─────────────────────────────────────────
--  12. MESSAGES (Chat / Notifications Inbox)
-- ─────────────────────────────────────────
create table if not exists public.messages (
  id        text primary key,
  client_id text not null,
  direction text not null,   -- 'INBOUND' | 'OUTBOUND'
  channel   text not null,   -- 'SMS' | 'EMAIL'
  content   text,
  timestamp text,
  status    text,            -- 'SENT' | 'FAILED' | 'RECEIVED'
  read      boolean default false
);
alter table public.messages enable row level security;
create policy "Allow all" on public.messages for all using (true) with check (true);

-- ─────────────────────────────────────────
--  13. TEMPLATE HISTORY
-- ─────────────────────────────────────────
create table if not exists public.template_history (
  id         text primary key,
  category   text,            -- 'GROOMING' | 'PROMO'
  channel    text,            -- 'SMS' | 'EMAIL_SUBJECT' | 'EMAIL_BODY' | 'EMAIL_FOOTER'
  content    text,
  created_at text
);
alter table public.template_history enable row level security;
create policy "Allow all" on public.template_history for all using (true) with check (true);

-- ─────────────────────────────────────────
--  14. SMS TRACKER (Rate Limiting)
-- ─────────────────────────────────────────
create table if not exists public.sms_tracker (
  hour_key   text primary key,   -- format: "YYYY-MM-DD-HH"
  count      integer default 0,
  updated_at text
);
alter table public.sms_tracker enable row level security;
create policy "Allow all" on public.sms_tracker for all using (true) with check (true);

-- ─────────────────────────────────────────
--  15. HOTEL ROOMS
-- ─────────────────────────────────────────
create table if not exists public.hotel_rooms (
  id          text primary key,
  room_number text not null,
  room_name   text,
  room_type   text default 'Standard',
  daily_rate  numeric not null default 0,
  capacity    integer not null default 1,
  description text,
  is_active   boolean not null default true
);
alter table public.hotel_rooms enable row level security;
create policy "Allow all" on public.hotel_rooms for all using (true) with check (true);

-- ─────────────────────────────────────────
--  16. HOTEL BOOKINGS
-- ─────────────────────────────────────────
create table if not exists public.hotel_bookings (
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
  status           text not null default 'RESERVED',  -- 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'
  daily_rate       numeric not null default 0,
  total_nights     integer not null default 0,
  total_amount     numeric not null default 0,
  addon_ids        jsonb default '[]'::jsonb,
  notes            text,
  staff_id         text,
  transaction_id   text
);
alter table public.hotel_bookings enable row level security;
create policy "Allow all" on public.hotel_bookings for all using (true) with check (true);

-- ─────────────────────────────────────────
--  17. REALTIME – Enable on all tables
-- ─────────────────────────────────────────
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.devices;
alter publication supabase_realtime add table public.store_settings;
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.product_categories;
alter publication supabase_realtime add table public.service_categories;
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.discounts;
alter publication supabase_realtime add table public.logs;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.template_history;
alter publication supabase_realtime add table public.sms_tracker;
alter publication supabase_realtime add table public.hotel_rooms;
alter publication supabase_realtime add table public.hotel_bookings;

-- ─────────────────────────────────────────
--  18. STORAGE SIZE HELPER (Optional)
--      Required for the Storage Usage meter
--      in Settings → Cloud Database section
-- ─────────────────────────────────────────
create or replace function public.get_database_size_bytes()
returns bigint
language sql
security definer
as $$
  select pg_database_size(current_database());
$$;
