-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Allows authenticated users to permanently delete their own account (Apple 5.1.1v).

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_remaining int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id into v_org_id
  from public.users
  where id = v_user_id;

  delete from public.users where id = v_user_id;

  if v_org_id is not null then
    select count(*)::int into v_remaining
    from public.users
    where organization_id = v_org_id;

    if v_remaining = 0 then
      delete from public.matches
      where nonprofit_id = v_org_id
         or listings_id in (
           select id from public.listings where organization_id = v_org_id
         );

      delete from public.listings where organization_id = v_org_id;
      delete from public.organizations where id = v_org_id;
    end if;
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
