-- Psyllium reminder (macros.html TODAY card), logged alongside the other daily habits
alter table public.daily_habits add column if not exists psyllium boolean default false;
