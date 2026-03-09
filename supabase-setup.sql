-- =============================================
-- GNH — Good Nutrition Habits
-- Ejecuta este SQL en Supabase → SQL Editor
-- =============================================

-- 1. Tabla profiles (extiende auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nombre text not null default '',
  apellido text not null default '',
  email text not null default '',
  telefono text default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- Activar RLS
alter table public.profiles enable row level security;

-- Políticas profiles
create policy "Usuarios ven su propio perfil"
  on profiles for select using (auth.uid() = id);

create policy "Usuarios editan su propio perfil"
  on profiles for update using (auth.uid() = id);

create policy "Admin ve todos los perfiles"
  on profiles for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 2. Tabla reservas
create table public.reservas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  servicio text not null,
  dia text not null,
  horario text not null,
  objetivo text not null,
  notas text default '',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'cancelada')),
  created_at timestamptz default now()
);

-- Activar RLS
alter table public.reservas enable row level security;

-- Políticas reservas
create policy "Usuarios ven sus reservas"
  on reservas for select using (auth.uid() = user_id);

create policy "Usuarios crean reservas"
  on reservas for insert with check (auth.uid() = user_id);

create policy "Admin ve todas las reservas"
  on reservas for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 3. Trigger: al registrarse, crear perfil automáticamente
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre, apellido, email, telefono)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'telefono', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Hacer admin a Bryan (ejecutar DESPUÉS de que Bryan se registre)
-- Reemplaza el email con el de Bryan:
-- update profiles set role = 'admin' where email = 'bryan@goodnutritionhabits.com';

-- 5. Avatar de perfil — ejecutar en Supabase SQL Editor
alter table public.profiles add column if not exists avatar_url text default null;

-- 6. Storage bucket para avatares
-- Ejecutar en Supabase → Storage → New bucket: "avatars", Public: true
-- Luego ejecutar estas políticas:
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "Usuarios suben su avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Usuarios actualizan su avatar"
  on storage.objects for update
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Avatares son públicos"
  on storage.objects for select
  using (bucket_id = 'avatars');
