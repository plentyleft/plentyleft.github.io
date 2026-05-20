-- Demo data for App Store screenshots (nonprofit "Available food" screen).
-- 1. Create two dev accounts in the app:
--    - Org: "Screenshot Corp" (corporate)
--    - Org: "Screenshot Nonprofit" (nonprofit)
-- 2. Run this entire script in Supabase SQL Editor.

do $$
declare
  v_corp_org uuid;
  v_np_org uuid;
  v_listing uuid;
begin
  select id into v_corp_org from public.organizations
  where name ilike 'Screenshot Corp%' order by created_at desc limit 1;

  select id into v_np_org from public.organizations
  where name ilike 'Screenshot Nonprofit%' order by created_at desc limit 1;

  if v_corp_org is null or v_np_org is null then
    raise exception 'Create Screenshot Corp and Screenshot Nonprofit via dev Sign up first.';
  end if;

  insert into public.listings (
    organization_id, title, food_types, quantity_kg, serves_approx,
    dietary_flags, pickup_address, pickup_start, pickup_end,
    status, notes, expires_at
  ) values (
    v_corp_org,
    'Office lunch — sandwiches & salads',
    array['sandwiches', 'salads', 'prepared food'],
    12, 25,
    array['vegetarian'],
    '123 Market St, San Francisco, CA',
    now() + interval '2 hours',
    now() + interval '5 hours',
    'matched',
    'Fresh surplus from today''s catering. Please bring containers.',
    now() + interval '5 hours'
  )
  returning id into v_listing;

  insert into public.matches (listings_id, nonprofit_id, status, match_score, matched_at)
  values (v_listing, v_np_org, 'pending', 0.92, now());
end;
$$;
