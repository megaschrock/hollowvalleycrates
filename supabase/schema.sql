-- Hollow Valley Crates — Supabase Schema
-- Run this once in the Supabase SQL editor

-- ─── TABLES ────────────────────────────────────────────────────────────────

create table if not exists settings (
  id                  int primary key,
  property_headline   text,
  property_description text,
  amenities           jsonb default '[]'::jsonb,
  nightly_rate        text,
  cleaning_fee        text,
  pet_fee             text,
  min_nights          text,
  airbnb_url          text,
  vrbo_url            text,
  phone               text,
  email               text,
  social_instagram    text,
  social_facebook     text,
  airbnb_ical_url     text,
  vrbo_ical_url       text,
  popup_enabled       boolean default false,
  popup_headline      text,
  popup_body          text,
  popup_cta_label     text,
  popup_cta_link      text,
  last_ical_refresh   timestamptz
);

create table if not exists photos (
  id            uuid primary key default gen_random_uuid(),
  url           text,
  storage_path  text,
  caption       text,
  display_order int,
  created_at    timestamptz default now()
);

create table if not exists blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date   date not null,
  reason     text,
  created_at timestamptz default now()
);

create table if not exists cached_ical_blocks (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  start_date  date not null,
  end_date    date not null,
  summary     text,
  last_synced timestamptz
);

create table if not exists inquiries (
  id           uuid primary key default gen_random_uuid(),
  first_name   text,
  last_name    text,
  email        text,
  phone        text,
  checkin      date,
  checkout     date,
  adults       int default 1,
  children     int default 0,
  pets         int default 0,
  notes        text,
  status       text default 'New',
  admin_notes  text,
  submitted_at timestamptz default now()
);

-- ─── SEED ──────────────────────────────────────────────────────────────────

insert into settings (id, property_headline, property_description, amenities, nightly_rate, cleaning_fee, pet_fee, min_nights)
values (
  1,
  'A Modern Retreat in the Ohio Countryside',
  'Hollow Valley Crates is a beautifully designed short-term rental nestled in the rolling hills of Ohio. The property blends contemporary architecture with natural surroundings — offering guests a rare combination of privacy, comfort, and design.',
  '["High-speed WiFi","Full kitchen","Washer & dryer","Fire pit","Hot tub","Smart TV","Free parking","Pet friendly","Air conditioning","Private yard"]',
  '250',
  '150',
  '50',
  '2'
)
on conflict (id) do nothing;

-- ─── STORAGE ───────────────────────────────────────────────────────────────

-- Create a public 'photos' storage bucket in Supabase dashboard
-- (Storage → New bucket → name: photos → Public: on)

-- ─── RLS POLICIES ──────────────────────────────────────────────────────────

alter table settings enable row level security;
alter table photos enable row level security;
alter table blocked_dates enable row level security;
alter table cached_ical_blocks enable row level security;
alter table inquiries enable row level security;

-- settings: public read, authenticated write
create policy "settings_public_read" on settings for select using (true);
create policy "settings_auth_write" on settings for update using (auth.role() = 'authenticated');

-- photos: public read, authenticated write
create policy "photos_public_read" on photos for select using (true);
create policy "photos_auth_insert" on photos for insert with check (auth.role() = 'authenticated');
create policy "photos_auth_update" on photos for update using (auth.role() = 'authenticated');
create policy "photos_auth_delete" on photos for delete using (auth.role() = 'authenticated');

-- blocked_dates: public read, authenticated write
create policy "blocked_dates_public_read" on blocked_dates for select using (true);
create policy "blocked_dates_auth_insert" on blocked_dates for insert with check (auth.role() = 'authenticated');
create policy "blocked_dates_auth_delete" on blocked_dates for delete using (auth.role() = 'authenticated');

-- cached_ical_blocks: public read, service role write only (via Netlify function)
create policy "ical_blocks_public_read" on cached_ical_blocks for select using (true);
-- service role bypasses RLS by default — no insert policy needed for it

-- inquiries: public insert, authenticated read/write
create policy "inquiries_public_insert" on inquiries for insert with check (true);
create policy "inquiries_auth_read" on inquiries for select using (auth.role() = 'authenticated');
create policy "inquiries_auth_update" on inquiries for update using (auth.role() = 'authenticated');
