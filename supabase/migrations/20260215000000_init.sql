create extension if not exists pgcrypto;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date text not null,
  place text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'attendance_status'
      and n.nspname = 'public'
  ) then
    create type public.attendance_status as enum ('참석', '불참', '보류');
  end if;
end
$$;

create table if not exists public.meeting_members (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  status attendance_status not null default '보류',
  created_at timestamptz not null default now()
);

create index if not exists meeting_members_meeting_id_idx on public.meeting_members(meeting_id);
