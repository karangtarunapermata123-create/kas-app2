-- ============================================================
-- MIGRATION: Catatan (Notes) + Folders
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Note Folders ─────────────────────────────────────────────
create table if not exists public.note_folders (
  id          text primary key,
  name        text not null,
  parent_id   text references public.note_folders(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Notes ────────────────────────────────────────────────────
create table if not exists public.notes (
  id          text primary key,
  title       text not null default '',
  body        text not null default '',
  color       text not null default 'white'
                check (color in ('white','red','orange','yellow','green','teal','blue','indigo','purple')),
  pinned      boolean not null default false,
  folder_id   text references public.note_folders(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists notes_folder_id_idx     on public.notes(folder_id);
create index if not exists notes_updated_at_idx    on public.notes(updated_at desc);
create index if not exists note_folders_parent_idx on public.note_folders(parent_id);

-- ── RLS: Enable ──────────────────────────────────────────────
alter table public.note_folders enable row level security;
alter table public.notes        enable row level security;

-- ── RLS: note_folders ────────────────────────────────────────

-- Semua user terautentikasi bisa SELECT (baca)
create policy "note_folders: authenticated can select"
  on public.note_folders for select
  to authenticated
  using (true);

-- Hanya admin & super_admin bisa INSERT
create policy "note_folders: admin can insert"
  on public.note_folders for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- Hanya admin & super_admin bisa UPDATE
create policy "note_folders: admin can update"
  on public.note_folders for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- Hanya admin & super_admin bisa DELETE
create policy "note_folders: admin can delete"
  on public.note_folders for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- ── RLS: notes ───────────────────────────────────────────────

-- Semua user terautentikasi bisa SELECT (baca)
create policy "notes: authenticated can select"
  on public.notes for select
  to authenticated
  using (true);

-- Hanya admin & super_admin bisa INSERT
create policy "notes: admin can insert"
  on public.notes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- Hanya admin & super_admin bisa UPDATE
create policy "notes: admin can update"
  on public.notes for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- Hanya admin & super_admin bisa DELETE
create policy "notes: admin can delete"
  on public.notes for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );
