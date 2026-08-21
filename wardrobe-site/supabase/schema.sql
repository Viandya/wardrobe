-- ═══════════════════════════════════════════════════════════
--  Гардероб — схема базы данных
--  Открой в Supabase: SQL Editor → New query → вставь всё → Run
-- ═══════════════════════════════════════════════════════════

-- ── Вещи ──
create table if not exists public.items (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text default '',
  category    text not null,
  seasons     text[] default '{}',
  formality   int  default 2,
  colors      text[] default '{}',
  fav         boolean default false,
  wear        int default 0,
  last_worn   date,
  is_wish     boolean default false,
  set_key     text,
  img_path    text not null,
  created_at  timestamptz default now()
);

-- ── Капсулы ──
create table if not exists public.looks (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text default '',
  season      text,
  occasion    text,
  tpl         text,
  placed      jsonb default '[]'::jsonb,
  worn_dates  text[] default '{}',
  created_at  timestamptz default now()
);

-- ── Настройки (город для погоды) ──
create table if not exists public.settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  city        text,
  lat         double precision,
  lon         double precision,
  city_label  text
);

create index if not exists items_user_idx on public.items(user_id);
create index if not exists looks_user_idx on public.looks(user_id);

-- ═══ Доступ: каждый видит и меняет только своё ═══
alter table public.items    enable row level security;
alter table public.looks    enable row level security;
alter table public.settings enable row level security;

drop policy if exists "свои вещи" on public.items;
create policy "свои вещи" on public.items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "свои капсулы" on public.looks;
create policy "свои капсулы" on public.looks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "свои настройки" on public.settings;
create policy "свои настройки" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══ Хранилище фотографий ═══
insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', true)
on conflict (id) do nothing;

-- Загружать, менять и удалять можно только в свою папку (её имя = твой id)
drop policy if exists "загрузка своих фото" on storage.objects;
create policy "загрузка своих фото" on storage.objects
  for insert with check (
    bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "правка своих фото" on storage.objects;
create policy "правка своих фото" on storage.objects
  for update using (
    bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "удаление своих фото" on storage.objects;
create policy "удаление своих фото" on storage.objects
  for delete using (
    bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "чтение фото" on storage.objects;
create policy "чтение фото" on storage.objects
  for select using (bucket_id = 'wardrobe');
