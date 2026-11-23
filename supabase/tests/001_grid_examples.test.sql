-- Generated from packages/shared/src/rules-examples.ts.
-- Regenerate with: node scripts/generate-db-grid-tests.ts
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

select is(ARRAY[private.footprint('S'), private.footprint('S')], ARRAY[1, 1], 'S takes 1 by 1 cells');
select is(ARRAY[private.footprint('M'), private.footprint('M')], ARRAY[4, 4], 'M takes 4 by 4 cells');
select is(ARRAY[private.footprint('L'), private.footprint('L')], ARRAY[6, 6], 'L takes 6 by 6 cells');

select is(private.cell_kind(0, 8), 'sidewalk', 'cell (0, 8) is sidewalk');
select is(private.cell_kind(1, 8), 'road', 'cell (1, 8) is road');
select is(private.cell_kind(2, 8), 'road', 'cell (2, 8) is road');
select is(private.cell_kind(3, 8), 'sidewalk', 'cell (3, 8) is sidewalk');
select is(private.cell_kind(4, 8), 'lot', 'cell (4, 8) is lot');
select is(private.cell_kind(8, 8), 'lot', 'cell (8, 8) is lot');
select is(private.cell_kind(15, 15), 'lot', 'cell (15, 15) is lot');
select is(private.cell_kind(16, 8), 'sidewalk', 'cell (16, 8) is sidewalk');
select is(private.cell_kind(17, 8), 'road', 'cell (17, 8) is road');
select is(private.cell_kind(19, 8), 'sidewalk', 'cell (19, 8) is sidewalk');
select is(private.cell_kind(8, 0), 'sidewalk', 'cell (8, 0) is sidewalk');
select is(private.cell_kind(8, 1), 'road', 'cell (8, 1) is road');
select is(private.cell_kind(8, 3), 'sidewalk', 'cell (8, 3) is sidewalk');
select is(private.cell_kind(0, 0), 'sidewalk', 'cell (0, 0) is sidewalk');
select is(private.cell_kind(3, 3), 'sidewalk', 'cell (3, 3) is sidewalk');
select is(private.cell_kind(1, 0), 'crosswalk', 'cell (1, 0) is crosswalk');
select is(private.cell_kind(0, 2), 'crosswalk', 'cell (0, 2) is crosswalk');
select is(private.cell_kind(3, 1), 'crosswalk', 'cell (3, 1) is crosswalk');
select is(private.cell_kind(1, 1), 'road', 'cell (1, 1) is road');
select is(private.cell_kind(2, 2), 'road', 'cell (2, 2) is road');
select is(private.cell_kind(-1, 8), 'lot', 'cell (-1, 8) is lot');
select is(private.cell_kind(-13, 8), 'sidewalk', 'cell (-13, 8) is sidewalk');
select is(private.cell_kind(-16, -15), 'crosswalk', 'cell (-16, -15) is crosswalk');

select * from finish();
rollback;
