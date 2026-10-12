-- FEAT-20: daily kettlebell circuit, logged alongside the other daily habits
alter table public.daily_habits add column if not exists kettlebell boolean default false;
alter table public.daily_habits add column if not exists kettlebell_log jsonb;
