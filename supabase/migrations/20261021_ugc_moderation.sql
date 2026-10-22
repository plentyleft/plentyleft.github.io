-- Guideline 1.2 (UGC). Safe to re-run. Review before applying to prod.

-- Profile columns (existing rows keep terms_* null; banned defaults false)
alter table public.users
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists banned boolean not null default false;

-- Soft-delete listings
alter table public.listings
  add column if not exists removed_at timestamptz,
  add column if not exists removed_reason text;

-- Reports (reporter_id nullable so rows survive account deletion)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  content_type text not null check (content_type in ('listing', 'user', 'organization')),
  content_id uuid,
  reported_user_id uuid references public.users(id) on delete set null,
  reported_organization_id uuid references public.organizations(id) on delete set null,
  reason text not null check (reason in (
    'spam', 'offensive', 'unsafe_food', 'harassment', 'other', 'blocked'
  )),
  note text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports alter column reporter_id drop not null;

do $$
begin
  alter table public.reports drop constraint if exists reports_reporter_id_fkey;
  alter table public.reports
    add constraint reports_reporter_id_fkey
    foreign key (reporter_id) references public.users(id) on delete set null;
exception when others then
  null;
end $$;

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id);

alter table public.reports enable row level security;

drop policy if exists "Users can insert own reports" on public.reports;
create policy "Users can insert own reports"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "Users can read own reports" on public.reports;
create policy "Users can read own reports"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

-- Org-level blocks (UI label: Block user)
create table if not exists public.blocked_organizations (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_organization_id)
);

create index if not exists blocked_orgs_blocker_idx
  on public.blocked_organizations (blocker_id);

alter table public.blocked_organizations enable row level security;

drop policy if exists "Users manage own blocks" on public.blocked_organizations;
create policy "Users manage own blocks"
  on public.blocked_organizations for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

create or replace function public.my_blocked_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select blocked_organization_id
  from public.blocked_organizations
  where blocker_id = auth.uid();
$$;

revoke all on function public.my_blocked_organization_ids() from public;
revoke all on function public.my_blocked_organization_ids() from anon;
grant execute on function public.my_blocked_organization_ids() to authenticated;

create or replace function public.is_banned(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select banned from public.users where id = uid), false);
$$;

revoke all on function public.is_banned(uuid) from public;
revoke all on function public.is_banned(uuid) from anon;
grant execute on function public.is_banned(uuid) to authenticated;

create or replace function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned() then
    raise exception 'Account suspended';
  end if;
  update public.users
  set terms_accepted_at = now(),
      terms_version = p_version
  where id = auth.uid();
end;
$$;

revoke all on function public.accept_terms(text) from public;
revoke all on function public.accept_terms(text) from anon;
grant execute on function public.accept_terms(text) to authenticated;

-- Clients cannot change banned (SQL editor: auth.uid() is null → allowed)
create or replace function public.protect_user_moderation_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.banned is distinct from old.banned then
    raise exception 'banned can only be changed by an admin';
  end if;
  return new;
end;
$$;

drop trigger if exists users_protect_moderation on public.users;
create trigger users_protect_moderation
  before update on public.users
  for each row execute function public.protect_user_moderation_columns();

-- Word-boundary content filter
create or replace function public.contains_objectionable_content(t text)
returns boolean
language sql
immutable
as $$
  select coalesce(t, '') ~* '\m(nigger|faggot|retard(ed)?|kill yourself|kys|child porn|csam|rape you)\M';
$$;

create or replace function public.listings_filter_objectionable()
returns trigger
language plpgsql
as $$
begin
  if public.contains_objectionable_content(new.title)
     or public.contains_objectionable_content(new.notes)
     or public.contains_objectionable_content(new.pickup_address) then
    raise exception 'Listing contains prohibited language';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_filter_objectionable_trg on public.listings;
create trigger listings_filter_objectionable_trg
  before insert or update of title, notes, pickup_address
  on public.listings
  for each row execute function public.listings_filter_objectionable();

-- Admin helpers (no execute for anon/authenticated)
create or replace function public.admin_remove_listing(
  p_listing_id uuid,
  p_reason text default 'moderation'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set removed_at = now(),
      removed_reason = p_reason
  where id = p_listing_id;
end;
$$;

create or replace function public.admin_ban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set banned = true where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
end;
$$;

create or replace function public.admin_ban_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id from public.users where organization_id = p_org_id
  loop
    perform public.admin_ban_user(r.id);
  end loop;

  update public.listings
  set removed_at = now(),
      removed_reason = 'organization banned'
  where organization_id = p_org_id
    and removed_at is null;
end;
$$;

revoke all on function public.admin_remove_listing(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_ban_user(uuid) from public, anon, authenticated;
revoke all on function public.admin_ban_organization(uuid) from public, anon, authenticated;

-- Restrictive RLS (AND with existing permissive policies)
drop policy if exists "Banned users locked out of listings" on public.listings;
create policy "Banned users locked out of listings"
  on public.listings
  as restrictive
  for all
  to authenticated
  using (not public.is_banned())
  with check (not public.is_banned());

drop policy if exists "Banned users locked out of matches" on public.matches;
create policy "Banned users locked out of matches"
  on public.matches
  as restrictive
  for all
  to authenticated
  using (not public.is_banned())
  with check (not public.is_banned());

drop policy if exists "Hide removed listings" on public.listings;
create policy "Hide removed listings"
  on public.listings
  as restrictive
  for select
  to authenticated
  using (removed_at is null);

drop policy if exists "Hide blocked organization listings" on public.listings;
create policy "Hide blocked organization listings"
  on public.listings
  as restrictive
  for select
  to authenticated
  using (
    organization_id not in (select public.my_blocked_organization_ids())
  );

drop policy if exists "Hide blocked organization matches" on public.matches;
create policy "Hide blocked organization matches"
  on public.matches
  as restrictive
  for select
  to authenticated
  using (
    nonprofit_id not in (select public.my_blocked_organization_ids())
    and not exists (
      select 1
      from public.listings l
      where l.id = matches.listings_id
        and l.organization_id in (select public.my_blocked_organization_ids())
    )
  );

comment on table public.reports is 'UGC reports + block notifications for App Store Guideline 1.2';
comment on table public.blocked_organizations is 'Org-level blocks; UI labeled Block user';
