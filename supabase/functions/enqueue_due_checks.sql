create or replace function public.enqueue_due_checks(max_jobs integer default 200)
returns integer
language plpgsql
as $$
declare
  inserted_count integer;
begin
  with due as (
    select id, org_id, interval_minutes
    from public.monitors
    where enabled = true
      and coalesce(next_check_at, now()) <= now()
    order by next_check_at nulls first
    limit max_jobs
    for update skip locked
  ), inserted as (
    insert into public.pending_checks (monitor_id, org_id, scheduled_for)
    select id, org_id, now()
    from due
    on conflict (monitor_id) do nothing
    returning monitor_id
  ), bumped as (
    update public.monitors m
      set next_check_at = greatest(coalesce(m.next_check_at, now()), now()) + (m.interval_minutes || ' minutes')::interval
    from due
    where m.id = due.id
    returning m.id
  )
  select count(*)
  into inserted_count
  from inserted;

  return coalesce(inserted_count, 0);
end;
$$;
