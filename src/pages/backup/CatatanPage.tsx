import { useState, useEffect, useMemo } from "react";
import Button from "../components/Button";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Select from "../components/Select";

export type NoteColor = "white" | "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "indigo" | "purple";

export type Note = {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  pinned: boolean;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

const NOTES_STORAGE_KEY = "catatan_notes_v3";
const FOLDERS_STORAGE_KEY = "catatan_folders_v2";

const colorClasses: Record<NoteColor, string> = {
  white: "bg-white dark:bg-slate-800",
  red: "bg-red-50 dark:bg-red-900/30",
  orange: "bg-orange-50 dark:bg-orange-900/20",
  yellow: "bg-yellow-50 dark:bg-yellow-900/20",
  green: "bg-green-50 dark:bg-green-900/20",
  teal: "bg-teal-50 dark:bg-teal-900/20",
  blue: "bg-blue-50 dark:bg-blue-900/20",
  indigo: "bg-indigo-50 dark:bg-indigo-900/20",
  purple: "bg-purple-50 dark:bg-purple-900/20",
};

const colorBorderClasses: Record<NoteColor, string> = {
  white: "border-slate-200 dark:border-slate-700",
  red: "border-red-200 dark:border-red-800",
  orange: "border-orange-200 dark:border-orange-800",
  yellow: "border-yellow-200 dark:border-yellow-800",
  green: "border-green-200 dark:border-green-800",
  teal: "border-teal-200 dark:border-teal-800",
  blue: "border-blue-200 dark:border-blue-800",
  indigo: "border-indigo-200 dark:border-indigo-800",
  purple: "border-purple-200 dark:border-purple-800",
};

const colorOptions: { value: NoteColor; label: string; className: string }[] = [
  { value: "white", label: "Putih", className: "bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600" },
  { value: "red", label: "Merah", className: "bg-red-400" },
  { value: "orange", label: "Oranye", className: "bg-orange-400" },
  { value: "yellow", label: "Kuning", className: "bg-yellow-400" },
  { value: "green", label: "Hijau", className: "bg-green-400" },
  { value: "teal", label: "Teal", className: "bg-teal-400" },
  { value: "blue", label: "Biru", className: "bg-blue-400" },
  { value: "indigo", label: "Indigo", className: "bg-indigo-400" },
  { value: "purple", label: "Ungu", className: "bg-purple-400" },
];

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

function loadFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveFolders(folders: Folder[]) {
  localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
}

function IconFolder(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function IconFolderOpen(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function CatatanPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [openEditor, setOpenEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorBody, setEditorBody] = useState("");
  const [editorColor, setEditorColor] = useState<NoteColor>("white");
  const [editorFolderId, setEditorFolderId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Folder modals
  const [openFolderModal, setOpenFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  useEffect(() => {
    setNotes(loadNotes());
    setFolders(loadFolders());
  }, []);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  useEffect(() => {
    saveFolders(folders);
  }, [folders]);

  const rootFolders = useMemo(
    () => folders.filter((f) => f.parentId === null).sort((a, b) => a.name.localeCompare(b.name, "id")),
    [folders],
  );

  const subfolders = useMemo(
    () => folders.filter((f) => f.parentId === currentFolderId).sort((a, b) => a.name.localeCompare(b.name, "id")),
    [folders, currentFolderId],
  );

  const currentFolderNotes = useMemo(() => {
    return notes
      .filter((n) => n.folderId === currentFolderId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, currentFolderId]);

  const filteredNotes = useMemo(() => {
    let result = currentFolderNotes;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((n) => {
        const text = `${n.title} ${n.body}`.toLowerCase();
        return text.includes(q);
      });
    }
    return result;
  }, [currentFolderNotes, searchQuery]);

  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [filteredNotes],
  );
  const otherNotes = useMemo(
    () => filteredNotes.filter((n) => !n.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [filteredNotes],
  );

  function navigateToFolder(folderId: string | null) {
    if (folderId === null) {
      setCurrentFolderId(null);
      setFolderPath([]);
      return;
    }
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    const path: Folder[] = [];
    let node: Folder | undefined = folder;
    while (node) {
      path.unshift(node);
      if (node!.parentId) {
        const parent = folders.find((f) => f.id === node!.parentId);
        node = parent ?? undefined;
      } else {
        node = undefined;
      }
    }
    setFolderPath(path);
    setCurrentFolderId(folderId);
  }

  function openAddFolder() {
    setEditingFolder(null);
    setFolderName("");
    setOpenFolderModal(true);
  }

  function openEditFolder(folder: Folder) {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setOpenFolderModal(true);
  }

  async function saveFolder() {
    const name = folderName.trim();
    if (!name) return;

    if (editingFolder) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === editingFolder.id
            ? { ...f, name, updatedAt: new Date().toISOString() }
            : f,
        ),
      );
    } else {
      const newFolder: Folder = {
        id: `folder-${Date.now()}`,
        name,
        parentId: currentFolderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setFolders((prev) => [...prev, newFolder]);
    }
    setOpenFolderModal(false);
    setFolderName("");
  }

  function confirmDeleteFolder() {
    if (!deleteFolderId) return;
    
    const deleteRecursive = (folderId: string) => {
      const childIds = folders.filter((f) => f.parentId === folderId).map((f) => f.id);
      childIds.forEach(deleteRecursive);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setNotes((prev) => prev.map((n) => (n.folderId === folderId ? { ...n, folderId: null } : n)));
    };

    deleteRecursive(deleteFolderId);
    
    if (currentFolderId === deleteFolderId) {
      navigateToFolder(null);
    } else if (folderPath.some((f) => f.id === deleteFolderId)) {
      const parentFolder = folders.find((f) => f.id === deleteFolderId)?.parentId ?? null;
      navigateToFolder(parentFolder);
    }
    setDeleteFolderId(null);
  }

  function openAddNote() {
    setEditingNote(null);
    setEditorTitle("");
    setEditorBody("");
    setEditorColor("white");
    setEditorFolderId(currentFolderId);
    setOpenEditor(true);
  }

  function openEditNote(note: Note) {
    setEditingNote(note);
    setEditorTitle(note.title);
    setEditorBody(note.body);
    setEditorColor(note.color);
    setEditorFolderId(note.folderId);
    setOpenEditor(true);
  }

  async function saveNote() {
    const title = editorTitle.trim();
    const body = editorBody.trim();
    if (!title && !body) return;

    if (editingNote) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNote.id
            ? { ...n, title, body, color: editorColor, folderId: editorFolderId, updatedAt: new Date().toISOString() }
            : n,
        ),
      );
    } else {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title,
        body,
        color: editorColor,
        pinned: false,
        folderId: editorFolderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNotes((prev) => [newNote, ...prev]);
    }
    setOpenEditor(false);
  }

  function togglePin(id: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n)),
    );
  }

  function confirmDelete() {
    if (!deleteConfirmId) return;
    setNotes((prev) => prev.filter((n) => n.id !== deleteConfirmId));
    setDeleteConfirmId(null);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            placeholder="Cari catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400"
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
        <Button onClick={openAddNote} className="shrink-0">
          + Catatan
        </Button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 overflow-x-auto scrollbar-hide">
        <button
          type="button"
          onClick={() => navigateToFolder(null)}
          className={`shrink-0 rounded px-2 py-1 transition ${currentFolderId === null ? "font-semibold text-slate-900 dark:text-white" : "hover:text-slate-700 dark:hover:text-slate-200"}`}
        >
          Catatan
        </button>
        {folderPath.map((folder, idx) => (
          <span key={folder.id} className="flex items-center gap-1 shrink-0">
            <span className="text-slate-400">/</span>
            {idx === folderPath.length - 1 ? (
              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">{folder.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => navigateToFolder(folder.id)}
                className="truncate max-w-[150px] hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                {folder.name}
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Subfolders */}
      {subfolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {subfolders.map((folder) => (
            <div
              key={folder.id}
              className="group flex flex-col items-center gap-1"
            >
              <button
                type="button"
                onClick={() => navigateToFolder(folder.id)}
                className="relative flex items-center justify-center w-12 h-12 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-700/50"
                title={folder.name}
              >
                <IconFolderOpen className="h-8 w-8 text-amber-500 dark:text-amber-400" />
              </button>
              <div className="flex items-center gap-0.5 w-full justify-center">
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 text-center truncate max-w-[90px]">{folder.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditFolder(folder);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), openEditFolder(folder))}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 transition group-hover:opacity-100"
                  title="Edit folder"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                  </svg>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteFolderId(folder.id);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setDeleteFolderId(folder.id))}
                  className="rounded p-0.5 text-slate-400 hover:text-rose-600 opacity-0 transition group-hover:opacity-100"
                  title="Hapus folder"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredNotes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {pinnedNotes.map((note) => (
            <div
              key={note.id}
              className={`group relative rounded-xl border p-4 shadow-sm transition hover:shadow-md ${colorClasses[note.color]} ${colorBorderClasses[note.color]}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">{note.title || "Tanpa judul"}</h3>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => togglePin(note.id)}
                    className={`rounded p-1 text-xs transition ${note.pinned ? "text-amber-600 dark:text-amber-400" : "text-slate-400 opacity-0 group-hover:opacity-100"}`}
                    title={note.pinned ? "Batal pin" : "Pin"}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M15 4h3v5.5l-1.5 1.5-2-2V4h-1v7.5l-2 2-1.5-1.5V4H6v5.5L4.5 9 3 10.5V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4h-3Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditNote(note)}
                    className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-300"
                    title="Edit"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(note.id)}
                    className="rounded p-1 text-rose-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                    title="Hapus"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              {note.folderId && (
                <div className="mb-2">
                  <span className="inline-flex rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-200">
                    {folders.find((f) => f.id === note.folderId)?.name ?? "Folder"}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300 line-clamp-6">{note.body || " "}</p>
              <div className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">{formatDate(note.updatedAt)}</div>
            </div>
          ))}
          {otherNotes.map((note) => (
            <div
              key={note.id}
              className={`group relative rounded-xl border p-4 shadow-sm transition hover:shadow-md ${colorClasses[note.color]} ${colorBorderClasses[note.color]}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">{note.title || "Tanpa judul"}</h3>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => togglePin(note.id)}
                    className={`rounded p-1 text-xs transition ${note.pinned ? "text-amber-600 dark:text-amber-400" : "text-slate-400 opacity-0 group-hover:opacity-100"}`}
                    title={note.pinned ? "Batal pin" : "Pin"}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M15 4h3v5.5l-1.5 1.5-2-2V4h-1v7.5l-2 2-1.5-1.5V4H6v5.5L4.5 9 3 10.5V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4h-3Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditNote(note)}
                    className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-300"
                    title="Edit"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(note.id)}
                    className="rounded p-1 text-rose-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                    title="Hapus"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              {note.folderId && (
                <div className="mb-2">
                  <span className="inline-flex rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-200">
                    {folders.find((f) => f.id === note.folderId)?.name ?? "Folder"}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300 line-clamp-6">{note.body || " "}</p>
              <div className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">{formatDate(note.updatedAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Floating action buttons */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-6 z-50 flex flex-col gap-2 md:bottom-6">
        <button
          type="button"
          onClick={openAddFolder}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-700 text-white shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition active:scale-95"
          title="Tambah Folder"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={openAddNote}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-700 text-white shadow-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition active:scale-95"
          title="Tambah Catatan"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Modal Tambah/Edit Catatan */}
      <Modal
        open={openEditor}
        title={editingNote ? "Edit Catatan" : "Catatan Baru"}
        onClose={() => setOpenEditor(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Judul</div>
            <Input
              placeholder="Contoh: Belanja bulanan"
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveNote()}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Isi</div>
            <textarea
              placeholder="Tulis catatan..."
              value={editorBody}
              onChange={(e) => setEditorBody(e.target.value)}
              className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50"
              rows={5}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Folder</div>
            <Select
              value={editorFolderId ?? ""}
              onChange={(e) => setEditorFolderId(e.target.value || null)}
              className="w-full"
            >
              <option value="">Tanpa folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Warna</div>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setEditorColor(c.value)}
                  className={`h-8 w-8 rounded-full border-2 transition ${c.className} ${editorColor === c.value ? "border-slate-900 dark:border-white scale-110" : "border-transparent"}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenEditor(false)}>Batal</Button>
            <Button onClick={saveNote} disabled={!editorTitle.trim() && !editorBody.trim()}>
              {editingNote ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Hapus Catatan */}
      <Modal open={!!deleteConfirmId} title="Hapus Catatan" onClose={() => setDeleteConfirmId(null)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yakin hapus catatan{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{notes.find((n) => n.id === deleteConfirmId)?.title}"
            </span>
            ?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Batal</Button>
            <button
              type="button"
              onClick={confirmDelete}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              Hapus
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Tambah/Edit Folder */}
      <Modal
        open={openFolderModal}
        title={editingFolder ? "Edit Folder" : "Folder Baru"}
        onClose={() => {
          setOpenFolderModal(false);
          setFolderName("");
        }}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Nama Folder</div>
            <Input
              placeholder="Contoh: Pekerjaan, Belanja, dll"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveFolder()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setOpenFolderModal(false); setFolderName(""); }}>Batal</Button>
            <Button onClick={saveFolder} disabled={!folderName.trim()}>
              {editingFolder ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Hapus Folder */}
      <Modal open={!!deleteFolderId} title="Hapus Folder" onClose={() => setDeleteFolderId(null)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yakin hapus folder{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{folders.find((f) => f.id === deleteFolderId)?.name}"
            </span>
            ? Catatan di dalamnya akan tetap ada, hanya folder yang dihapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteFolderId(null)}>Batal</Button>
            <button
              type="button"
              onClick={confirmDeleteFolder}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
