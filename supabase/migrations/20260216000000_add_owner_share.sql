alter table if exists public.meetings
  add column if not exists owner_email text;

alter table if exists public.meetings
  add column if not exists owner_share_token text;

create index if not exists meetings_owner_share_token_idx on public.meetings(owner_share_token);
create index if not exists meetings_owner_email_idx on public.meetings(owner_email);
