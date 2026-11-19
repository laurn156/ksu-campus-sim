-- Campusverse limited testing setup. Run once in the Supabase SQL editor.
create table if not exists public.campus_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  appearance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists campus_username_unique on public.campus_profiles (lower(username));
alter table public.campus_profiles enable row level security;
create policy "profiles visible to signed in users" on public.campus_profiles for select to authenticated using (true);
create policy "create own profile" on public.campus_profiles for insert to authenticated with check (auth.uid() = id);
create policy "edit own profile" on public.campus_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Only explicitly approved test accounts can connect. Grant access using the SQL editor:
-- insert into public.campus_testers (id) select id from auth.users where email = 'tester@example.com';
create table if not exists public.campus_testers (id uuid primary key references auth.users(id) on delete cascade);
alter table public.campus_testers enable row level security;
create policy "read own tester status" on public.campus_testers for select to authenticated using (id = auth.uid());
create policy "testers read campus realtime" on realtime.messages for select to authenticated using (
  exists (select 1 from public.campus_testers where id = auth.uid()) and
  (realtime.topic() = 'campus-presence' or realtime.topic() like 'campus-player:%')
);
create policy "testers publish own realtime" on realtime.messages for insert to authenticated with check (
  exists (select 1 from public.campus_testers where id = auth.uid()) and
  (realtime.topic() = 'campus-presence' or realtime.topic() = 'campus-player:' || auth.uid()::text)
);
