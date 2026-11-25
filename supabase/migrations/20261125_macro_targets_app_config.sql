-- Macro targets move out of code into app_config so recalibrating is a row update.
-- Read only by nutrition-targets / nutrition-history (service role); app_config has RLS on, no policies.
-- Update later, e.g.:  update app_config set value='2100-2300', updated_at=now() where key='macro_training_kcal';
insert into public.app_config (key, value) values
  ('macro_training_kcal',  '2150-2350'),
  ('macro_rest_kcal',      '1950-2150'),
  ('macro_protein_g',      '225'),
  ('macro_recal_weight',   '203.6'),
  ('macro_training_fat_g', '135'),
  ('macro_rest_fat_g',     '115')
on conflict (key) do update set value = excluded.value, updated_at = now();
