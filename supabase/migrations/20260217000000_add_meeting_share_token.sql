-- Add per-meeting share token for one-to-one shared links.
create extension if not exists pgcrypto;

alter table public.meetings
  add column if not exists share_token text;

update public.meetings
  set share_token = encode(digest(id::text || coalesce(owner_share_token, ''), 'sha256'), 'hex')
  where share_token is null;

alter table public.meetings
  alter column share_token set not null;

create unique index if not exists meetings_share_token_uq on public.meetings (share_token);
