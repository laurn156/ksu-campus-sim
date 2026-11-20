-- Run after setup.sql and social.sql on the existing Supabase project.
-- Offline roaming is opt-in. Presence, not a stored boolean, is the source of truth for online status.
alter table public.campus_profiles add column if not exists offline_roaming boolean not null default false;
alter table public.campus_profiles add column if not exists major text check (char_length(major) <= 80);

-- All authenticated users may join presence and read player broadcasts; each user may publish
-- only to their own player topic. Never permit clients to impersonate another player's channel.
drop policy if exists "testers read campus realtime" on realtime.messages;
drop policy if exists "testers publish own realtime" on realtime.messages;
drop policy if exists "campus realtime read" on realtime.messages;
drop policy if exists "campus realtime write" on realtime.messages;
create policy "campus realtime read" on realtime.messages for select to authenticated using
  (realtime.topic() = 'campus-presence' or realtime.topic() like 'campus-player:%');
create policy "campus realtime write" on realtime.messages for insert to authenticated with check
  (realtime.topic() = 'campus-presence' or realtime.topic() = 'campus-player:' || auth.uid()::text);
-- Demo anonymous accounts cannot opt into the persistent registered-player simulation.
drop policy if exists "create own profile" on public.campus_profiles;
drop policy if exists "edit own profile" on public.campus_profiles;
create policy "create own profile" on public.campus_profiles for insert to authenticated with check
  (auth.uid() = id and (not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not offline_roaming));
create policy "edit own profile" on public.campus_profiles for update to authenticated using (auth.uid()=id) with check
  (auth.uid() = id and (not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not offline_roaming));
