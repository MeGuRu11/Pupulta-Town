begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
set local time zone 'America/Los_Angeles';
select plan(32);

select is(private.grid_period(), 16, 'street and lot pattern repeats every 16 cells');
select is(private.street_cells(), 4, 'the street is four cells wide');

select is(private.fits_lot(x, z, size), expected, description)
from (values
  (4, 4, 'M'::public.task_size, true, 'M fits in the first four by four cells'),
  (10, 10, 'L', true, 'L fits through the last cell of the block on both axes'),
  (12, 12, 'M', true, 'M fits when both edges end at the last block cell'),
  (13, 12, 'M', false, 'M cannot cross a street on the x axis'),
  (12, 13, 'M', false, 'M cannot cross a street on the z axis'),
  (15, 15, 'L', false, 'lot corners in different blocks still cross the intervening streets'),
  (3, 4, 'S', false, 'even S cannot occupy a sidewalk'),
  (-4, -4, 'M', true, 'M fits against the end of a negative block'),
  (2147483647, 4, 'S', true, 'S at the largest integer occupies a representable cell'),
  (2147483647, 4, 'M', false, 'M cannot extend beyond the largest integer cell')
) as examples(x, z, size, expected, description);

select is(private.decay_stage(due_on, now_at, closed_at), expected, description)
from (values
  (date '2026-11-10', timestamptz '2026-11-09 21:00:00+00', null::timestamptz, 'none', 'due day has no decay'),
  (date '2026-11-10', timestamptz '2026-11-10 20:59:59.999+00', null, 'none', 'last millisecond before Moscow midnight'),
  (date '2026-11-10', timestamptz '2026-11-10 21:00:00+00', null, 'dirt', 'day one starts at Moscow midnight'),
  (date '2026-11-10', timestamptz '2026-11-12 20:59:59.999+00', null, 'dirt', 'last millisecond of day two'),
  (date '2026-11-10', timestamptz '2026-11-12 21:00:00+00', null, 'graffiti', 'day three starts graffiti'),
  (date '2026-11-10', timestamptz '2026-11-16 20:59:59.999+00', null, 'graffiti', 'last millisecond of day six'),
  (date '2026-11-10', timestamptz '2026-11-16 21:00:00+00', null, 'defect', 'day seven starts defect'),
  (date '2026-11-10', timestamptz '2026-11-23 20:59:59.999+00', null, 'defect', 'last millisecond of day thirteen'),
  (date '2026-11-10', timestamptz '2026-11-23 21:00:00+00', null, 'repair', 'day fourteen starts repair'),
  (date '2026-11-10', timestamptz '2026-11-30 20:59:59.999+00', null, 'repair', 'last millisecond of day twenty'),
  (date '2026-11-10', timestamptz '2026-11-30 21:00:00+00', null, 'fire', 'day twenty-one starts fire across a month boundary'),
  (date '2026-11-10', timestamptz '2027-05-31 21:00:00+00', null, 'fire', 'no stage follows fire'),
  (date '2026-11-10', timestamptz '2026-11-30 21:00:00+00', timestamptz '2026-11-30 21:00:00+00', 'none', 'closing clears fire at the exact closing instant'),
  (date '2026-11-10', timestamptz '2026-11-10 21:00:00+00', timestamptz '2026-11-11 21:00:00+00', 'dirt', 'a future closing time does not clear decay'),
  (date '2026-11-10', timestamptz '2026-11-08 21:00:00+00', null, 'none', 'before the due day there is no decay')
) as examples(due_on, now_at, closed_at, expected, description);

select is(private.decay_stage(date '2026-11-10', timestamptz '2026-11-10 21:00:00+00'),
  'dirt', 'omitting the closing time evaluates an open task');

select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon cannot access the private schema');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated cannot access the private schema');
select ok(not has_function_privilege('anon', 'private.fits_lot(integer,integer,public.task_size)', 'EXECUTE'),
  'anon cannot execute the placement helper');
select ok(not has_function_privilege('authenticated', 'private.decay_stage(date,timestamptz,timestamptz)', 'EXECUTE'),
  'authenticated cannot execute the decay helper');

select * from finish();
rollback;
