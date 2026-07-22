import { supabase } from "./supabase";
import type { Note, NoteFolder, NoteColor } from "./types";

// ── Helper: Convert snake_case DB to camelCase ───────────────
function dbToNote(row: any): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    color: row.color as NoteColor,
    pinned: row.pinned,
    folderId: row.folder_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbToFolder(row: any): NoteFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ══════════════════════════════════════════════════════════════
// NOTES CRUD
// ══════════════════════════════════════════════════════════════

export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
    return [];
  }
  return (data || []).map(dbToNote);
}

export async function createNote(note: Omit<Note, "createdAt" | "updatedAt">): Promise<Note | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      id: note.id,
      title: note.title,
      body: note.body,
      color: note.color,
      pinned: note.pinned,
      folder_id: note.folderId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating note:", error);
    return null;
  }
  return dbToNote(data);
}

export async function updateNote(
  id: string,
  updates: Partial<Omit<Note, "id" | "createdAt" | "updatedAt">>
): Promise<Note | null> {
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.body !== undefined) payload.body = updates.body;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.pinned !== undefined) payload.pinned = updates.pinned;
  if (updates.folderId !== undefined) payload.folder_id = updates.folderId;

  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating note:", error);
    return null;
  }
  return dbToNote(data);
}

export async function deleteNote(id: string): Promise<boolean> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) {
    console.error("Error deleting note:", error);
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
// FOLDERS CRUD
// ══════════════════════════════════════════════════════════════

export async function fetchFolders(): Promise<NoteFolder[]> {
  const { data, error } = await supabase
    .from("note_folders")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching folders:", error);
    return [];
  }
  return (data || []).map(dbToFolder);
}

export async function createFolder(
  folder: Omit<NoteFolder, "createdAt" | "updatedAt">
): Promise<NoteFolder | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("note_folders")
    .insert({
      id: folder.id,
      name: folder.name,
      parent_id: folder.parentId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating folder:", error);
    return null;
  }
  return dbToFolder(data);
}

export async function updateFolder(
  id: string,
  name: string
): Promise<NoteFolder | null> {
  const { data, error } = await supabase
    .from("note_folders")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating folder:", error);
    return null;
  }
  return dbToFolder(data);
}

export async function deleteFolder(id: string): Promise<boolean> {
  const { error } = await supabase.from("note_folders").delete().eq("id", id);
  if (error) {
    console.error("Error deleting folder:", error);
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
// REALTIME SUBSCRIPTIONS (Optional)
// ══════════════════════════════════════════════════════════════

export function subscribeToNotes(
  callback: (note: Note, eventType: "INSERT" | "UPDATE" | "DELETE") => void
) {
  const channel = supabase
    .channel("notes-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notes" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          callback(
            { id: (payload.old as any).id } as Note,
            payload.eventType
          );
        } else {
          callback(dbToNote(payload.new), payload.eventType as any);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToFolders(
  callback: (
    folder: NoteFolder,
    eventType: "INSERT" | "UPDATE" | "DELETE"
  ) => void
) {
  const channel = supabase
    .channel("folders-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "note_folders" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          callback(
            { id: (payload.old as any).id } as NoteFolder,
            payload.eventType
          );
        } else {
          callback(dbToFolder(payload.new), payload.eventType as any);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ══════════════════════════════════════════════════════════════
// MIGRATION: LocalStorage → Supabase (One-time)
// ══════════════════════════════════════════════════════════════

const NOTES_STORAGE_KEY = "catatan_notes_v3";
const FOLDERS_STORAGE_KEY = "catatan_folders_v2";
const MIGRATION_FLAG_KEY = "catatan_migrated_to_supabase";

export async function migrateLocalStorageToSupabase(): Promise<void> {
  // Cek apakah sudah pernah migrasi
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === "true") {
    return;
  }

  try {
    // Load dari localStorage
    const notesRaw = localStorage.getItem(NOTES_STORAGE_KEY);
    const foldersRaw = localStorage.getItem(FOLDERS_STORAGE_KEY);

    if (!notesRaw && !foldersRaw) {
      // Tidak ada data localStorage, skip
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
      return;
    }

    const localNotes: Note[] = notesRaw ? JSON.parse(notesRaw) : [];
    const localFolders: NoteFolder[] = foldersRaw ? JSON.parse(foldersRaw) : [];

    console.log(
      `[Migration] Found ${localFolders.length} folders and ${localNotes.length} notes in localStorage`
    );

    // Cek apakah sudah ada data di Supabase
    const existingNotes = await fetchNotes();
    const existingFolders = await fetchFolders();

    if (existingNotes.length > 0 || existingFolders.length > 0) {
      console.log("[Migration] Supabase already has data, skipping migration");
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
      return;
    }

    // Migrate folders dulu (karena notes depend on folders)
    if (localFolders.length > 0) {
      const { error: foldersError } = await supabase
        .from("note_folders")
        .insert(
          localFolders.map((f) => ({
            id: f.id,
            name: f.name,
            parent_id: f.parentId,
            created_at: f.createdAt,
            updated_at: f.updatedAt,
          }))
        );

      if (foldersError) {
        console.error("[Migration] Error migrating folders:", foldersError);
        return;
      }
      console.log(`[Migration] Successfully migrated ${localFolders.length} folders`);
    }

    // Migrate notes
    if (localNotes.length > 0) {
      const { error: notesError } = await supabase.from("notes").insert(
        localNotes.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          color: n.color,
          pinned: n.pinned,
          folder_id: n.folderId,
          created_at: n.createdAt,
          updated_at: n.updatedAt,
        }))
      );

      if (notesError) {
        console.error("[Migration] Error migrating notes:", notesError);
        return;
      }
      console.log(`[Migration] Successfully migrated ${localNotes.length} notes`);
    }

    // Set flag bahwa migrasi sudah selesai
    localStorage.setItem(MIGRATION_FLAG_KEY, "true");
    console.log("[Migration] Migration completed successfully!");
  } catch (error) {
    console.error("[Migration] Migration failed:", error);
  }
}
