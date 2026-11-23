create schema private;
revoke all on schema private from public, anon, authenticated;

create type public.task_size as enum ('S', 'M', 'L');

-- Keep decisions 0010 and 0011 in sync with packages/shared/src/grid.ts.
create function private.grid_period()
returns integer
language sql immutable
set search_path = ''
as $$
  select 16;
$$;

create function private.street_cells()
returns integer
language sql immutable
set search_path = ''
as $$
  select 4;
$$;

-- Returns the side of the square footprint in cells (decision 0008).
create function private.footprint(p_size public.task_size)
returns integer
language sql immutable strict
set search_path = ''
as $$
  select case p_size
    when 'S' then 1
    when 'M' then 4
    when 'L' then 6
  end;
$$;

create function private.cell_kind(p_x integer, p_z integer)
returns text
language sql immutable strict
set search_path = ''
as $$
  with grid as (
    select private.grid_period() as period, private.street_cells() as street
  ), coords as (
    select ((p_x % period) + period) % period as x,
           ((p_z % period) + period) % period as z,
           street
    from grid
  ), lanes as (
    select case
             when x >= street then 'lot'
             when x in (0, street - 1) then 'sidewalk'
             else 'road'
           end as along_x,
           case
             when z >= street then 'lot'
             when z in (0, street - 1) then 'sidewalk'
             else 'road'
           end as along_z
    from coords
  )
  select case
    when along_x = 'lot' then along_z
    when along_z = 'lot' or along_x = along_z then along_x
    else 'crosswalk'
  end
  from lanes;
$$;

-- The footprint must fit entirely in one block, including its last occupied cell.
create function private.fits_lot(p_x integer, p_z integer, p_size public.task_size)
returns boolean
language sql immutable strict
set search_path = ''
as $$
  with grid as (
    select private.grid_period() as period,
           private.street_cells() as street,
           private.footprint(p_size) as side
  ), coords as (
    select ((p_x % period) + period) % period as x,
           ((p_z % period) + period) % period as z,
           period, street, side
    from grid
  )
  select x between street and period - side
     and z between street and period - side
     and p_x::bigint + side - 1 <= 2147483647
     and p_z::bigint + side - 1 <= 2147483647
  from coords;
$$;

-- Decision 0012 uses a fixed UTC+3 calendar day, independent of session timezone.
create function private.decay_stage(p_due_on date, p_now timestamptz, p_closed_at timestamptz default null)
returns text
language sql immutable
set search_path = ''
as $$
  with moscow as (
    select (p_now at time zone interval '3 hours')::date as local_day
  ), overdue as (
    select case when local_day > p_due_on and isfinite(p_due_on) and isfinite(p_now)
      then local_day - p_due_on
      else 0
    end as days
    from moscow
  )
  select case
    when p_due_on is null or p_now is null or not isfinite(p_due_on) or not isfinite(p_now) then null
    when p_closed_at <= p_now then 'none'
    when days >= 21 then 'fire'
    when days >= 14 then 'repair'
    when days >= 7 then 'defect'
    when days >= 3 then 'graffiti'
    when days >= 1 then 'dirt'
    else 'none'
  end
  from overdue;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
