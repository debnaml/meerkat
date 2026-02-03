-- 0002_fix_current_org_id.sql
-- Ensure current_org_id() pulls org_id from JWT app_metadata claims

create or replace function public.current_org_id()
returns uuid
language plpgsql
stable
as $$
declare
  claims jsonb;
  org_claim text;
begin
  begin
    claims := current_setting('request.jwt.claims', true)::jsonb;
  exception
    when others then
      return null;
  end;

  if claims ? 'org_id' then
    org_claim := claims ->> 'org_id';
  elsif claims ? 'app_metadata' then
    org_claim := (claims -> 'app_metadata') ->> 'org_id';
  end if;

  return nullif(org_claim, '')::uuid;
end;
$$;
