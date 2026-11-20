-- Apply in the existing Supabase project. A server-side lock serializes arrivals,
-- and short leases clear occupants who disconnect without sending an exit.
create table if not exists public.campus_gym_event_state (
  id integer primary key check (id = 1), event_index integer not null default 0 check (event_index between 0 and 2),
  changed_at timestamptz not null default now()
);
insert into public.campus_gym_event_state(id) values (1) on conflict do nothing;
create table if not exists public.campus_gym_event_visits (
  token uuid primary key, user_id uuid not null, last_seen timestamptz not null default now()
);
alter table public.campus_gym_event_state enable row level security;
alter table public.campus_gym_event_visits enable row level security;
revoke all on public.campus_gym_event_state, public.campus_gym_event_visits from anon, authenticated;
create or replace function public.campus_gym_event_visit(visit_token uuid, leaving boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare current_event integer; last_change timestamptz;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select event_index, changed_at into current_event,last_change from campus_gym_event_state where id=1 for update;
 delete from campus_gym_event_visits where last_seen < now() - interval '60 seconds';
 if leaving then
   delete from campus_gym_event_visits where token=visit_token and user_id=auth.uid();
 else
   if not exists(select 1 from campus_gym_event_visits) and last_change < now() - interval '5 minutes' then
     current_event := (current_event+1)%3;
     update campus_gym_event_state set event_index=current_event,changed_at=now() where id=1;
   end if;
   insert into campus_gym_event_visits(token,user_id,last_seen) values(visit_token,auth.uid(),now())
   on conflict(token) do update set last_seen=now() where campus_gym_event_visits.user_id=auth.uid();
 end if;
 return current_event;
end $$;
revoke all on function public.campus_gym_event_visit(uuid,boolean) from public;
grant execute on function public.campus_gym_event_visit(uuid,boolean) to authenticated;
