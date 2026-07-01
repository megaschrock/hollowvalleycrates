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

-- ─── PHASE 5: OWNERSHIP OS ─────────────────────────────────────────────────

alter table settings add column if not exists mission text default '';
alter table settings add column if not exists vision text default '';
alter table settings add column if not exists company_values jsonb default '[]'::jsonb;

create table if not exists objectives (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text default '',
  period_label text not null default 'H1 2026',
  status       text not null default 'on_track',
  archived     boolean default false,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

create table if not exists meetings (
  id           uuid primary key default gen_random_uuid(),
  meeting_date date not null default current_date,
  status       text not null default 'in_progress',
  created_at   timestamptz default now()
);

create table if not exists meeting_personal_updates (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references meetings(id) on delete cascade,
  person_name text not null,
  update_text text default '',
  created_at  timestamptz default now()
);

create table if not exists meeting_talking_points (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  content      text not null,
  source_type  text default 'manual',
  source_label text default '',
  notes        text default '',
  resolved     boolean default false,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

create table if not exists meeting_todos (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  assigned_to        text default '',
  due_date           date,
  completed          boolean default false,
  completed_at       timestamptz,
  created_meeting_id uuid references meetings(id),
  notes              text default '',
  created_at         timestamptz default now()
);

alter table objectives enable row level security;
alter table meetings enable row level security;
alter table meeting_personal_updates enable row level security;
alter table meeting_talking_points enable row level security;
alter table meeting_todos enable row level security;

create policy "objectives_auth" on objectives for all using (auth.role() = 'authenticated');
create policy "meetings_auth" on meetings for all using (auth.role() = 'authenticated');
create policy "meeting_updates_auth" on meeting_personal_updates for all using (auth.role() = 'authenticated');
create policy "meeting_tp_auth" on meeting_talking_points for all using (auth.role() = 'authenticated');
create policy "meeting_todos_auth" on meeting_todos for all using (auth.role() = 'authenticated');

-- ─── PHASE 5B: RESERVATIONS + MONTHLY REPORTS + TEAM ─────────────────────

alter table settings add column if not exists team_members jsonb default '[]'::jsonb;


-- Reservations table additions
alter table reservations add column if not exists discount numeric default 0;
alter table reservations add column if not exists host_fee numeric default 0;
alter table reservations add column if not exists entered_in_dda boolean default false;

-- Ensure reservations has RLS and auth policy
alter table reservations enable row level security;
create policy if not exists "reservations_auth" on reservations for all using (auth.role() = 'authenticated');

-- Monthly reports (metrics snapshots tied to a meeting)
create table if not exists monthly_reports (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid references meetings(id) on delete set null,
  report_month date not null,
  metrics      jsonb not null default '{}',
  expenses     jsonb not null default '{}',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table monthly_reports enable row level security;
create policy "monthly_reports_auth" on monthly_reports for all using (auth.role() = 'authenticated');

-- ─── PHASE 5C: OBJECTIVE ASSIGNEES + QUARTERLY PERIODS ────────────────────

alter table objectives add column if not exists assigned_to text default '';
