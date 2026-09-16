-- Keto macro tracker: foods + nutrition_log
-- Does not touch any existing table.

create table public.foods (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  name          text not null,
  category      text not null,          -- 'protein' | 'veg' | 'supplement' | 'restaurant' | 'fat'
  unit_label    text not null,          -- what one unit means: 'thigh', 'oz', 'wing', 'scoop', 'cup'
  default_qty   numeric not null default 1,
  protein_g     numeric not null,       -- per single unit
  calories      numeric not null,       -- per single unit
  net_carbs_g   numeric not null,       -- per single unit
  fat_g         numeric,
  is_favorite   boolean not null default false,
  carb_flag     text,                   -- warning text shown when tapped, e.g. shellfish
  sort_order    int not null default 100
);

create table public.nutrition_log (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  log_date      date not null,
  meal_slot     text not null,          -- 'meal_1' | 'meal_2' | 'shake' | 'snack'
  food_id       bigint references public.foods(id),
  food_name     text not null,          -- denormalized so history survives food edits
  quantity      numeric not null,
  protein_g     numeric not null,       -- computed at log time
  calories      numeric not null,
  net_carbs_g   numeric not null,
  entry_source  text not null default 'preset',  -- 'preset' | 'photo_estimate' | 'manual'
  notes         text
);

create index on public.nutrition_log (log_date desc);

-- RLS enabled, no anon policies: this app talks to Supabase only through
-- edge functions using the service role key, matching the build prompt's
-- "never an anon key in the client" requirement.
alter table public.foods enable row level security;
alter table public.nutrition_log enable row level security;

-- ===== Seed: food library =====

-- Proteins
insert into public.foods (name, category, unit_label, protein_g, calories, net_carbs_g, is_favorite, sort_order) values
('Chicken thigh, bone-in skin-on, air fried', 'protein', 'thigh', 18, 210, 0, true, 10),
('Chicken thigh, boneless skinless', 'protein', 'oz cooked', 6.5, 45, 0, true, 20),
('Chicken wing, air fried (per segment)', 'protein', 'wing', 6, 70, 0, true, 30),
('Sirloin steak', 'protein', 'oz cooked', 8.5, 62, 0, true, 40),
('Chuck steak', 'protein', 'oz cooked', 7.5, 85, 0, false, 50),
('Ribeye / Angus', 'protein', 'oz cooked', 7, 90, 0, false, 60),
('Ground turkey 93/7', 'protein', '4oz serving', 23, 170, 0, true, 70),
('Ground beef 80/20', 'protein', '4oz serving', 22, 285, 0, false, 80),
('Ground beef 90/10', 'protein', '4oz serving', 23, 200, 0, false, 90),
('Lamb chop, bone-in', 'protein', 'chop', 15, 200, 0, false, 100),
('Pork ribs, dry rub', 'protein', 'rib', 10, 140, 1, false, 110),
('Shrimp', 'protein', '4oz', 24, 110, 0, false, 120),
('Egg, large', 'protein', 'egg', 6, 72, 0.4, true, 130);

-- Restaurant / prepared
insert into public.foods (name, category, unit_label, protein_g, calories, net_carbs_g, is_favorite, sort_order) values
('Chipotle steak', 'restaurant', 'serving', 21, 150, 1, true, 10),
('Chipotle fajita veggies', 'restaurant', 'serving', 1, 20, 4, false, 20),
('Chipotle guacamole', 'restaurant', 'serving', 2, 230, 2, false, 30),
('Chipotle cheese', 'restaurant', 'serving', 6, 110, 1, false, 40),
('Chomps turkey stick', 'restaurant', 'stick', 10, 50, 0, false, 50);

-- Supplements / dairy
insert into public.foods (name, category, unit_label, protein_g, calories, net_carbs_g, is_favorite, sort_order) values
('Isopure whey', 'supplement', 'scoop (25g protein)', 25, 100, 0, true, 10),
('Greek yogurt, nonfat', 'supplement', 'cup', 23, 130, 9, true, 20),
('Greek yogurt, whole milk', 'supplement', 'cup', 20, 190, 8, false, 30),
('Almond butter', 'supplement', 'tbsp', 3.5, 98, 1.5, false, 40),
('Unsweetened almond milk', 'supplement', 'cup', 1, 30, 1, false, 50),
('Collagen peptides', 'supplement', 'scoop', 18, 70, 0, false, 60);

-- Vegetables
insert into public.foods (name, category, unit_label, protein_g, calories, net_carbs_g, is_favorite, sort_order) values
('Cauliflower, cooked', 'veg', 'cup', 2, 28, 2, false, 10),
('Broccoli, cooked', 'veg', 'cup', 4, 55, 6, true, 20),
('Asparagus, cooked', 'veg', 'cup', 4, 40, 3, false, 30),
('Shirataki noodles', 'veg', 'package', 0, 10, 0, false, 40),
('Avocado', 'veg', 'half', 2, 160, 2, true, 50),
('Spinach, cooked', 'veg', 'cup', 5, 41, 1, false, 60);

-- Carb-flag items (shellfish that read as keto-safe but aren't)
insert into public.foods (name, category, unit_label, protein_g, calories, net_carbs_g, is_favorite, carb_flag, sort_order) values
('Mussels', 'protein', '4oz', 20, 145, 3.5, false, 'High carb for shellfish — ~14g net carbs per pound', 140),
('Oysters', 'protein', '4oz', 10, 80, 4.5, false, 'High carb for shellfish — ~18g net carbs per pound', 150);
