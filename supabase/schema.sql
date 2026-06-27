-- ============================================================
-- SCHEMA KAS PEMUDA
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Profiles (extend auth.users) ────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'member' check (role in ('super_admin', 'admin', 'member')),
  created_at  timestamptz not null default now()
);

-- Auto-create profile saat user baru register
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'member')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Books ────────────────────────────────────────────────────
create table if not exists public.books (
  id          text primary key,
  name        text not null,
  type        text not null default 'biasa' check (type in ('biasa', 'rutin', 'kolektif', 'group')),
  group_id    text references public.books(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint books_group_no_self_check check (group_id is null or group_id <> id),
  constraint books_group_type_check check (type <> 'group' or group_id is null)
);

-- ── Categories ───────────────────────────────────────────────
create table if not exists public.categories (
  id          text primary key,
  book_id     text not null references public.books(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ── Transactions ─────────────────────────────────────────────
create table if not exists public.transactions (
  id                  text primary key,
  book_id             text not null references public.books(id) on delete cascade,
  date                text not null,
  type                text not null check (type in ('masuk', 'keluar')),
  category_id         text not null,
  amount              bigint not null,
  note                text not null default '',
  masuk_ke_rekening   boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ── Routine Members ──────────────────────────────────────────
create table if not exists public.routine_members (
  id            text primary key,
  book_id       text not null references public.books(id) on delete cascade,
  name          text not null,
  joins_kas     boolean not null default true,
  joins_arisan  boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Routine Categories ───────────────────────────────────────
create table if not exists public.routine_categories (
  id          text primary key,
  book_id     text not null references public.books(id) on delete cascade,
  name        text not null,
  amount      bigint not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Routine Checklists ───────────────────────────────────────
create table if not exists public.routine_checklists (
  id          bigserial primary key,
  book_id     text not null references public.books(id) on delete cascade,
  period_key  text not null,
  member_id   text not null,
  category_id text not null,
  checked     boolean not null default false,
  date        text,
  count       integer not null default 1,
  not_paid    boolean not null default false,
  unique (book_id, period_key, member_id, category_id)
);

-- ── Routine Frequency ────────────────────────────────────────
create table if not exists public.routine_frequency (
  book_id     text primary key references public.books(id) on delete cascade,
  frequency   text not null default 'bulanan' check (frequency in ('bulanan', 'arisan'))
);

-- ── Routine Sessions ─────────────────────────────────────────
create table if not exists public.routine_sessions (
  id          text primary key,
  book_id     text not null references public.books(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ── Routine Cash Entries ─────────────────────────────────────
create table if not exists public.routine_cash_entries (
  id          text primary key,
  book_id     text not null references public.books(id) on delete cascade,
  date        text not null,
  type        text not null check (type in ('masuk', 'keluar')),
  amount      bigint not null default 0,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists idx_routine_cash_entries_book_date
on public.routine_cash_entries(book_id, date desc, created_at desc);

-- ── Routine Arisan Entries ───────────────────────────────────
create table if not exists public.routine_arisan_entries (
  id          text primary key,
  book_id     text not null references public.books(id) on delete cascade,
  scope_type  text not null check (scope_type in ('year', 'session')),
  scope_key   text not null,
  name        text not null,
  amount      bigint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_routine_arisan_entries_scope
on public.routine_arisan_entries(book_id, scope_type, scope_key, created_at);

-- ── Activities ───────────────────────────────────────────────
create table if not exists public.activities (
  id          text primary key,
  name        text not null,
  type        text not null check (type in ('sekali', 'rutin')),
  frequency   text check (frequency in ('mingguan', 'bulanan')),
  date        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ── Activity Sessions ────────────────────────────────────────
create table if not exists public.activity_sessions (
  id          text primary key,
  activity_id text not null references public.activities(id) on delete cascade,
  label       text not null,
  date        text not null,
  created_at  timestamptz not null default now()
);

-- ── Attendance Records ───────────────────────────────────────
create table if not exists public.attendance_records (
  id          text primary key,
  activity_id text not null references public.activities(id) on delete cascade,
  session_id  text references public.activity_sessions(id) on delete cascade,
  member_name text not null,
  status      text not null check (status in ('hadir', 'izin', 'tidak-hadir')),
  note        text,
  timestamp   timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────────
-- Untuk sementara semua authenticated user bisa baca/tulis
-- Nanti bisa diperketat sesuai role

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.routine_members enable row level security;
alter table public.routine_categories enable row level security;
alter table public.routine_checklists enable row level security;
alter table public.routine_frequency enable row level security;
alter table public.routine_sessions enable row level security;
alter table public.routine_cash_entries enable row level security;
alter table public.routine_arisan_entries enable row level security;
alter table public.activities enable row level security;
alter table public.activity_sessions enable row level security;
alter table public.attendance_records enable row level security;

-- Profiles: user bisa lihat semua, edit milik sendiri
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Super admin bisa update semua profile (untuk ganti role)
create policy "profiles_update_admin" on public.profiles for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'));

-- Semua tabel data: authenticated user bisa semua operasi
create policy "books_all" on public.books for all to authenticated using (true) with check (true);
create policy "categories_all" on public.categories for all to authenticated using (true) with check (true);
create policy "transactions_all" on public.transactions for all to authenticated using (true) with check (true);
create policy "routine_members_all" on public.routine_members for all to authenticated using (true) with check (true);
create policy "routine_categories_all" on public.routine_categories for all to authenticated using (true) with check (true);
create policy "routine_checklists_all" on public.routine_checklists for all to authenticated using (true) with check (true);
create policy "routine_frequency_all" on public.routine_frequency for all to authenticated using (true) with check (true);
create policy "routine_sessions_all" on public.routine_sessions for all to authenticated using (true) with check (true);
create policy "routine_cash_entries_all" on public.routine_cash_entries for all to authenticated using (true) with check (true);
create policy "routine_arisan_entries_all" on public.routine_arisan_entries for all to authenticated using (true) with check (true);
create policy "activities_all" on public.activities for all to authenticated using (true) with check (true);
create policy "activity_sessions_all" on public.activity_sessions for all to authenticated using (true) with check (true);
create policy "attendance_records_all" on public.attendance_records for all to authenticated using (true) with check (true);
