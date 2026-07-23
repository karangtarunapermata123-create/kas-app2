import { useState, useEffect, useMemo, useRef } from "react";
import Button from "../components/Button";
import Modal from "../components/Modal";
import Input from "../components/Input";
import { useAuth, canEdit } from "../lib/auth";
import {
  fetchNotes,
  fetchFolders,
  createNote,
  updateNote,
  deleteNote,
  createFolder,
  updateFolder,
  deleteFolder,
  migrateLocalStorageToSupabase,
  subscribeToNotes,
  subscribeToFolders,
} from "../lib/notes";
import type { Note, NoteFolder, NoteColor } from "../lib/types";

// ── Re-export untuk backward compat jika ada import eksternal ─
export type { NoteColor, Note };
export type Folder = NoteFolder;

const colorClasses: Record<NoteColor, string> = {
  white: "bg-white dark:bg-slate-800",
  red: "bg-red-200 dark:bg-red-900/70",
  orange: "bg-orange-200 dark:bg-orange-900/60",
  yellow: "bg-yellow-200 dark:bg-yellow-900/60",
  green: "bg-green-200 dark:bg-green-900/60",
  teal: "bg-teal-200 dark:bg-teal-900/60",
  blue: "bg-blue-200 dark:bg-blue-900/60",
  indigo: "bg-indigo-200 dark:bg-indigo-900/60",
  purple: "bg-purple-200 dark:bg-purple-900/60",
};

const colorTextClasses: Record<NoteColor, string> = {
  white: "text-slate-900 dark:text-slate-100",
  red: "text-red-900 dark:text-red-100",
  orange: "text-orange-900 dark:text-orange-100",
  yellow: "text-yellow-900 dark:text-yellow-100",
  green: "text-green-900 dark:text-green-100",
  teal: "text-teal-900 dark:text-teal-100",
  blue: "text-blue-900 dark:text-blue-100",
  indigo: "text-indigo-900 dark:text-indigo-100",
  purple: "text-purple-900 dark:text-purple-100",
};

const colorBorderClasses: Record<NoteColor, string> = {
  white: "border-slate-200 dark:border-slate-700",
  red: "border-red-300 dark:border-red-700",
  orange: "border-orange-300 dark:border-orange-700",
  yellow: "border-yellow-300 dark:border-yellow-700",
  green: "border-green-300 dark:border-green-700",
  teal: "border-teal-300 dark:border-teal-700",
  blue: "border-blue-300 dark:border-blue-700",
  indigo: "border-indigo-300 dark:border-indigo-700",
  purple: "border-purple-300 dark:border-purple-700",
};



const colorOptions: { value: NoteColor; label: string; className: string }[] = [
  { value: "white", label: "Putih", className: "bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600" },
  { value: "red", label: "Merah", className: "bg-red-500 border-red-600 dark:bg-red-700" },
  { value: "orange", label: "Oranye", className: "bg-orange-500 border-orange-600 dark:bg-orange-700" },
  { value: "yellow", label: "Kuning", className: "bg-yellow-500 border-yellow-600 dark:bg-yellow-700" },
  { value: "green", label: "Hijau", className: "bg-green-500 border-green-600 dark:bg-green-700" },
  { value: "teal", label: "Teal", className: "bg-teal-500 border-teal-600 dark:bg-teal-700" },
  { value: "blue", label: "Biru", className: "bg-blue-500 border-blue-600 dark:bg-blue-700" },
  { value: "indigo", label: "Indigo", className: "bg-indigo-500 border-indigo-600 dark:bg-indigo-700" },
  { value: "purple", label: "Ungu", className: "bg-purple-500 border-purple-600 dark:bg-purple-700" },
];

// ── SVG Icons ────────────────────────────────────────────────
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
function IconSearch(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function IconClose(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
function IconPlusSmall(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}
function IconPin(props: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={props.filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}
function IconEdit(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}
function IconTrash(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}
function IconMoreVertical(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
    </svg>
  );
}
function IconChevronRight(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
function IconClock(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconNotes(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" />
    </svg>
  );
}
function IconArrowLeft(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  );
}
function IconLock(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconBold(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="M6 12h9a4 4 0 0 1 0 8H6V4h8a4 4 0 0 1 0 8" />
    </svg>
  );
}

function IconItalic(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function IconUnderline(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="M6 3v7a6 6 0 0 0 12 0V3" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  );
}

function IconStrikethrough(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="M17.3 19c.6-1.2 1-2.5 1-3.8 0-2.3-1.3-4.3-3.4-5.7" />
      <path d="M6.7 19c-.6-1.2-1-2.5-1-3.8 0-2.3 1.3-4.3 3.4-5.7" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function IconListBullet(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconListNumber(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 14h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </svg>
  );
}

function IconHighlight(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="m9 11-6 6 3.5 3.5L17 14l-2.5-2.5L13 10l-2 1z" />
      <path d="m14 3 5 5-7 7H9l-5-5 7-7h3z" transform="translate(2, 2) scale(0.8)" />
    </svg>
  );
}

function IconTextSize(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function IconClearFormat(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="m7 21-4.3-4.3" />
      <path d="M17 3l4 4" />
      <path d="M21 3l-4 4" />
      <path d="M3 21l4-4" />
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M3 21h4" />
      <path d="M17 21h4" />
    </svg>
  );
}

export default function CatatanPage() {
  const { profile } = useAuth();
  const canEditNotes = canEdit(profile?.role);

  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<NoteFolder[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editDetailTitle, setEditDetailTitle] = useState("");
  const [editDetailBody, setEditDetailBody] = useState("");
  const [editDetailColor, setEditDetailColor] = useState<NoteColor>("white");
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [createColor, setCreateColor] = useState<NoteColor>("white");

  // Folder modals
  const [openFolderModal, setOpenFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<NoteFolder | null>(null);
  const [folderName, setFolderName] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [menuOpenFolderId, setMenuOpenFolderId] = useState<string | null>(null);
  const [menuOpenNoteId, setMenuOpenNoteId] = useState<string | null>(null);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [arrowMenuIndex, setArrowMenuIndex] = useState<number | null>(null);
  const [arrowMenuPos, setArrowMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [activeNotePage, setActiveNotePage] = useState<"pinned" | "explorer">("pinned");

  const createEditorRef = useRef<HTMLDivElement>(null);
  const editEditorRef = useRef<HTMLDivElement>(null);
  const [activeEditor, setActiveEditor] = useState<"create" | "edit" | null>(null);

  function execCmd(command: string, value?: string) {
    const editor = activeEditor === "edit" ? editEditorRef.current : createEditorRef.current;
    if (editor) {
      editor.focus();
    }
    document.execCommand(command, false, value);
  }

  useEffect(() => {
    if (!activeEditor) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isEditorClick = target.closest("[contenteditable=true]") || target.closest("[contenteditable]");
      const isToolbarClick = target.closest("[title]") || target.closest("select");
      if (!isEditorClick && !isToolbarClick) {
        setActiveEditor(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeEditor]);

  function syncCreateEditor() {
    if (createEditorRef.current) {
      setCreateBody(createEditorRef.current.innerHTML);
    }
  }

  function syncEditEditor() {
    if (editEditorRef.current) {
      setEditDetailBody(editEditorRef.current.innerHTML);
    }
  }

  // Initial data fetch + migration
  useEffect(() => {
    async function init() {
      setLoading(true);
      await migrateLocalStorageToSupabase();
      const [notesData, foldersData] = await Promise.all([
        fetchNotes(),
        fetchFolders(),
      ]);
      setNotes(notesData);
      setFolders(foldersData);
      setLoading(false);
    }
    init();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const unsubNotes = subscribeToNotes((note, eventType) => {
      if (eventType === "INSERT") {
        setNotes((prev) => [note, ...prev]);
      } else if (eventType === "UPDATE") {
        setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
      } else if (eventType === "DELETE") {
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
      }
    });

    const unsubFolders = subscribeToFolders((folder, eventType) => {
      if (eventType === "INSERT") {
        setFolders((prev) => [...prev, folder]);
      } else if (eventType === "UPDATE") {
        setFolders((prev) => prev.map((f) => (f.id === folder.id ? folder : f)));
      } else if (eventType === "DELETE") {
        setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      }
    });

    return () => {
      unsubNotes();
      unsubFolders();
    };
  }, []);

  useEffect(() => {
    if (!isCreatingNote) return;
    const t = setTimeout(() => {
      if (createEditorRef.current) {
        createEditorRef.current.innerHTML = createBody || "";
      }
    }, 0);
    return () => clearTimeout(t);
  }, [isCreatingNote]);

  useEffect(() => {
    if (!isEditingDetail) return;
    const t = setTimeout(() => {
      if (editEditorRef.current) {
        editEditorRef.current.innerHTML = editDetailBody || "";
      }
    }, 0);
    return () => clearTimeout(t);
  }, [isEditingDetail]);

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpenNoteId) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-note-menu]")) {
        setMenuOpenNoteId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenNoteId]);

  useEffect(() => {
    if (!menuOpenFolderId) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-folder-menu]")) {
        setMenuOpenFolderId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenFolderId]);

  useEffect(() => {
    if (arrowMenuIndex === null) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-arrow-menu]")) {
        setArrowMenuIndex(null);
        setArrowMenuPos(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [arrowMenuIndex]);

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
  const allPinnedNotes = useMemo(
    () => notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes],
  );

  function navigateToFolder(folderId: string | null) {
    if (folderId === null) {
      setCurrentFolderId(null);
      setFolderPath([]);
      return;
    }
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    const path: NoteFolder[] = [];
    let node: NoteFolder | undefined = folder;
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
    if (!canEditNotes) return;
    setEditingFolder(null);
    setFolderName("");
    setOpenFolderModal(true);
  }

  function openEditFolder(folder: NoteFolder) {
    if (!canEditNotes) return;
    setEditingFolder(folder);
    setFolderName(folder.name);
    setOpenFolderModal(true);
  }

  async function saveFolder() {
    if (!canEditNotes) return;
    const name = folderName.trim();
    if (!name) return;

    if (editingFolder) {
      const updated = await updateFolder(editingFolder.id, name);
      if (updated) {
        setFolders((prev) =>
          prev.map((f) => (f.id === editingFolder.id ? updated : f))
        );
      }
    } else {
      const newFolder: Omit<NoteFolder, "createdAt" | "updatedAt"> = {
        id: `folder-${Date.now()}`,
        name,
        parentId: currentFolderId,
      };
      const created = await createFolder(newFolder);
      if (created) {
        setFolders((prev) => [...prev, created]);
      }
    }
    setOpenFolderModal(false);
    setFolderName("");
  }

  async function confirmDeleteFolder() {
    if (!canEditNotes || !deleteFolderId) return;

    const deleteRecursive = async (folderId: string) => {
      const childIds = folders.filter((f) => f.parentId === folderId).map((f) => f.id);
      for (const childId of childIds) {
        await deleteRecursive(childId);
      }
      await deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      // Update notes to set folderId to null
      const affectedNotes = notes.filter((n) => n.folderId === folderId);
      for (const note of affectedNotes) {
        await updateNote(note.id, { folderId: null });
      }
      setNotes((prev) => prev.map((n) => (n.folderId === folderId ? { ...n, folderId: null } : n)));
    };

    await deleteRecursive(deleteFolderId);

    if (currentFolderId === deleteFolderId) {
      navigateToFolder(null);
    } else if (folderPath.some((f) => f.id === deleteFolderId)) {
      const parentFolder = folders.find((f) => f.id === deleteFolderId)?.parentId ?? null;
      navigateToFolder(parentFolder);
    }
    setDeleteFolderId(null);
  }

  function openDetailEdit() {
    if (!canEditNotes || !viewingNote) return;
    setEditDetailTitle(viewingNote.title);
    setEditDetailBody(viewingNote.body);
    setEditDetailColor(viewingNote.color);
    setIsEditingDetail(true);
  }

  function cancelDetailEdit() {
    setIsEditingDetail(false);
    setViewingNote(null);
    setEditDetailTitle("");
    setEditDetailBody("");
    setEditDetailColor("white");
  }

  async function saveDetailEdit() {
    if (!canEditNotes || !viewingNote) return;
    const title = editDetailTitle.trim();
    const body = editEditorRef.current?.innerHTML || editDetailBody;
    const text = editEditorRef.current?.textContent || editDetailBody;
    if (!title && !text?.trim()) return;
    const updated = await updateNote(viewingNote.id, { title, body, color: editDetailColor });
    if (updated) {
      setNotes((prev) =>
        prev.map((n) => (n.id === viewingNote.id ? updated : n))
      );
      setViewingNote(null);
      setIsEditingDetail(false);
      setEditDetailTitle("");
      setEditDetailBody("");
      setEditDetailColor("white");
    }
  }

  function openAddNote() {
    if (!canEditNotes) return;
    setCreateTitle("");
    setCreateBody("");
    setCreateColor("white");
    setIsCreatingNote(true);
  }

  async function saveNewNote() {
    if (!canEditNotes) return;
    const title = createTitle.trim();
    const body = createEditorRef.current?.innerHTML || createBody;
    const text = createEditorRef.current?.textContent || createBody;
    if (!title && !text?.trim()) return;
    const created = await createNote({
      id: `note-${Date.now()}`,
      title,
      body,
      color: createColor,
      pinned: false,
      folderId: currentFolderId,
    });
    if (created) {
      setNotes((prev) => [created, ...prev]);
    }
    setIsCreatingNote(false);
  }

  function cancelCreateNote() {
    setIsCreatingNote(false);
  }

  async function togglePin(id: string) {
    if (!canEditNotes) return;
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const updated = await updateNote(id, { pinned: !note.pinned });
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    }
  }

  function copyNote(noteId: string) {
    if (!canEditNotes) return;
    setCopiedNoteId(noteId);
    setMoveMode(false);
    setMenuOpenNoteId(null);
  }

  function moveNote(noteId: string) {
    if (!canEditNotes) return;
    setCopiedNoteId(noteId);
    setMoveMode(true);
    setMenuOpenNoteId(null);
  }

  async function pasteNoteToFolder(folderId: string | null) {
    if (!canEditNotes || !copiedNoteId) return;
    if (moveMode) {
      const updated = await updateNote(copiedNoteId, { folderId });
      if (updated) {
        setNotes((prev) => prev.map((n) => (n.id === copiedNoteId ? updated : n)));
      }
    } else {
      const source = notes.find((n) => n.id === copiedNoteId);
      if (!source) return;
      const created = await createNote({
        id: `note-${Date.now()}`,
        title: source.title,
        body: source.body,
        color: source.color,
        pinned: false,
        folderId,
      });
      if (created) {
        setNotes((prev) => [created, ...prev]);
      }
    }
    setCopiedNoteId(null);
    setMoveMode(false);
  }

  async function confirmDelete() {
    if (!canEditNotes || !deleteConfirmId) return;
    const ok = await deleteNote(deleteConfirmId);
    if (ok) {
      setNotes((prev) => prev.filter((n) => n.id !== deleteConfirmId));
    }
    setDeleteConfirmId(null);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  // ── Sub-components ────────────────────────────────────────
  function FolderRow({ folder }: { folder: NoteFolder }) {
    const noteCount = notes.filter((n) => n.folderId === folder.id).length;
    const isMenuOpen = menuOpenFolderId === folder.id;
    return (
      <div className="group relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/40">
        <button
          type="button"
          onClick={() => navigateToFolder(folder.id)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          title={folder.name}
        >
          <IconFolderOpen className="h-6 w-6 shrink-0 text-amber-500 dark:text-amber-400" />
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{folder.name}</span>
            {noteCount > 0 && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">{noteCount} catatan</span>
            )}
          </div>
        </button>
        {canEditNotes && (
          <div className="relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setMenuOpenFolderId(isMenuOpen ? null : folder.id)}
              className="rounded-md p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            >
              <IconMoreVertical className="h-4 w-4" />
            </button>
            {isMenuOpen && (
              <div data-folder-menu className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
                <button type="button" onClick={() => { openEditFolder(folder); setMenuOpenFolderId(null); }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                  Ganti nama
                </button>
                <button type="button" onClick={() => { setDeleteFolderId(folder.id); setMenuOpenFolderId(null); }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                  Hapus
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function NoteRow({ note }: { note: Note }) {
    const isMenuOpen = menuOpenNoteId === note.id;
    const isCopied = copiedNoteId === note.id;
    return (
      <div className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${colorClasses[note.color]} ${colorBorderClasses[note.color]} ${isCopied ? "ring-2 ring-emerald-500/60" : ""}`}>
        <button type="button" onClick={() => setViewingNote(note)} className="flex flex-1 min-w-0 flex-col gap-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
              {note.title || "Tanpa judul"}
            </h3>
            {note.pinned && <IconPin className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" filled />}
          </div>
          {note.body && (
            <p className={`text-xs line-clamp-1 ${colorTextClasses[note.color]}`}>{note.body}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(note.updatedAt)}</span>
          </div>
        </button>
        {canEditNotes && (
          <div className="relative flex shrink-0 items-center">
            <button type="button" onClick={() => setMenuOpenNoteId(isMenuOpen ? null : note.id)}
              className="rounded-md p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300">
              <IconMoreVertical className="h-4 w-4" />
            </button>
            {isMenuOpen && (
              <div data-note-menu className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
                <button type="button" onClick={() => { togglePin(note.id); setMenuOpenNoteId(null); }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                  {note.pinned ? "Batal pin" : "Pin"}
                </button>
                <button type="button" onClick={() => copyNote(note.id)}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                  Salin
                </button>
                <button type="button" onClick={() => moveNote(note.id)}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                  Pindah
                </button>
                <button type="button" onClick={() => { setDeleteConfirmId(note.id); setMenuOpenNoteId(null); }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                  Hapus
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const isSearching = searchQuery.trim().length > 0;
  const showEmptyFolderState = filteredNotes.length === 0 && subfolders.length === 0;

  // ── Loading State ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Memuat catatan...</p>
      </div>
    );
  }

  // ── Detail View ───────────────────────────────────────────
  if (viewingNote) {
    const noteFolderName = viewingNote.folderId
      ? folders.find((f) => f.id === viewingNote.folderId)?.name
      : null;

    if (isEditingDetail) {
      return (
        <div className="flex flex-col gap-4 flex-1 min-h-0 -mx-4 px-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={cancelDetailEdit}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition">
              <IconArrowLeft className="h-4 w-4" />Kembali
            </button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={cancelDetailEdit}>Batal</Button>
              <Button onClick={saveDetailEdit} disabled={!editDetailTitle.trim() && !editDetailBody.trim()}>Simpan</Button>
            </div>
          </div>
          <input type="text" value={editDetailTitle} onChange={(e) => setEditDetailTitle(e.target.value)}
            placeholder="Judul catatan..."
            className="w-full text-xl font-bold text-slate-900 dark:text-white bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 pb-2 outline-none focus:border-slate-400 dark:focus:border-slate-500 placeholder-slate-300 dark:placeholder-slate-600"
          />
          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
            <span>{formatDate(viewingNote.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            {colorOptions.map((c) => {
              const selected = editDetailColor === c.value;
              return (
                <button key={c.value} type="button" onClick={() => setEditDetailColor(c.value)}
                  className={`h-6 w-6 rounded-full border-2 transition ${selected ? "border-slate-900 scale-110 dark:border-white" : "border-transparent hover:scale-105"} ${c.className}`}
                  title={c.label}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
            <button type="button" onClick={() => execCmd("bold")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Bold"><IconBold className="h-4 w-4" /></button>
            <button type="button" onClick={() => execCmd("italic")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Italic"><IconItalic className="h-4 w-4" /></button>
            <button type="button" onClick={() => execCmd("underline")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Underline"><IconUnderline className="h-4 w-4" /></button>
            <button type="button" onClick={() => execCmd("strikeThrough")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Strikethrough"><IconStrikethrough className="h-4 w-4" /></button>
            <select onChange={(e) => execCmd("fontSize", e.target.value)} className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 px-1 py-1" title="Ukuran teks">
              <option value="2">Kecil</option>
              <option value="3" selected>Normal</option>
              <option value="5">Besar</option>
              <option value="7">Sangat Besar</option>
            </select>
            <button type="button" onClick={() => execCmd("insertUnorderedList")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Bullet list"><IconListBullet className="h-4 w-4" /></button>
            <button type="button" onClick={() => execCmd("insertOrderedList")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Numbered list"><IconListNumber className="h-4 w-4" /></button>
            <button type="button" onClick={() => execCmd("hiliteColor", "#fef08a")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Highlight kuning"><span className="inline-block h-4 w-4 rounded bg-yellow-200 border border-yellow-300" /></button>
            <button type="button" onClick={() => execCmd("hiliteColor", "#bbf7d0")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Highlight hijau"><span className="inline-block h-4 w-4 rounded bg-green-200 border border-green-300" /></button>
            <button type="button" onClick={() => execCmd("hiliteColor", "#bfdbfe")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Highlight biru"><span className="inline-block h-4 w-4 rounded bg-blue-200 border border-blue-300" /></button>
            <button type="button" onClick={() => execCmd("removeFormat")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Hapus format"><IconClearFormat className="h-4 w-4" /></button>
          </div>
          <div
            ref={editEditorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncEditEditor}
            onFocus={() => setActiveEditor("edit")}
            data-placeholder="Tulis catatan..."
            className={`w-full flex-1 min-h-[300px] text-sm border-0 outline-none resize-none leading-relaxed rounded-lg p-2 ${colorClasses[editDetailColor]} ${colorTextClasses[editDetailColor]}`}
          />
        </div>
      );
    }

    // Mode view
    return (
      <div className="flex flex-col gap-4 flex-1 min-h-0 -mx-4 px-4">
        <button type="button" onClick={() => setViewingNote(null)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition">
          <IconArrowLeft className="h-4 w-4" />Kembali
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {viewingNote.title || "Tanpa judul"}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                <IconClock className="h-3.5 w-3.5" />
                Dibuat: {formatDate(viewingNote.createdAt)}
                {viewingNote.updatedAt !== viewingNote.createdAt && (
                  <span className="ml-1">· Diubah: {formatDate(viewingNote.updatedAt)}</span>
                )}
              </span>
            </div>
          </div>
          {canEditNotes && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={() => togglePin(viewingNote.id)}
                className={`rounded p-2 transition ${viewingNote.pinned ? "text-amber-600 dark:text-amber-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
                title={viewingNote.pinned ? "Batal pin" : "Pin"}>
                <IconPin className="h-5 w-5" filled={viewingNote.pinned} />
              </button>
              <button type="button" onClick={openDetailEdit}
                className="rounded p-2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300" title="Edit">
                <IconEdit className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => { setDeleteConfirmId(viewingNote.id); setViewingNote(null); }}
                className="rounded p-2 text-rose-400 transition hover:text-rose-600" title="Hapus">
                <IconTrash className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        {viewingNote.body ? (
          <div className={`whitespace-pre-wrap text-sm leading-relaxed flex-1 min-h-0 rounded-lg p-3 ${colorClasses[viewingNote.color]} ${colorTextClasses[viewingNote.color]}`}
            dangerouslySetInnerHTML={{ __html: viewingNote.body }}
          />
        ) : (
          <div className="text-sm text-slate-400 dark:text-slate-500 italic min-h-[200px]">
            Tidak ada isi catatan.
          </div>
        )}
      </div>
    );
  }

  // ── Create Note View ──────────────────────────────────────
  if (isCreatingNote) {
    return (
      <div className="flex flex-col gap-4 flex-1 min-h-0 -mx-4 px-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={cancelCreateNote}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition">
            <IconArrowLeft className="h-4 w-4" />Kembali
          </button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={cancelCreateNote}>Batal</Button>
            <Button onClick={saveNewNote} disabled={!createTitle.trim() && !createBody.trim()}>Simpan</Button>
          </div>
        </div>
        <input type="text" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)}
          placeholder="Judul catatan..."
          className="w-full text-xl font-bold text-slate-900 dark:text-white bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 pb-2 outline-none focus:border-slate-400 dark:focus:border-slate-500 placeholder-slate-300 dark:placeholder-slate-600"
        />
        <div className="flex items-center gap-1">
          {colorOptions.map((c) => {
            const selected = createColor === c.value;
            return (
              <button key={c.value} type="button" onClick={() => setCreateColor(c.value)}
                className={`h-6 w-6 rounded-full border-2 transition ${selected ? "border-slate-900 scale-110 dark:border-white" : "border-transparent hover:scale-105"} ${c.className}`}
                title={c.label}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
          <button type="button" onClick={() => execCmd("bold")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Bold"><IconBold className="h-4 w-4" /></button>
          <button type="button" onClick={() => execCmd("italic")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Italic"><IconItalic className="h-4 w-4" /></button>
          <button type="button" onClick={() => execCmd("underline")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Underline"><IconUnderline className="h-4 w-4" /></button>
          <button type="button" onClick={() => execCmd("strikeThrough")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Strikethrough"><IconStrikethrough className="h-4 w-4" /></button>
          <select onChange={(e) => execCmd("fontSize", e.target.value)} className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 px-1 py-1" title="Ukuran teks">
            <option value="2">Kecil</option>
            <option value="3" selected>Normal</option>
            <option value="5">Besar</option>
            <option value="7">Sangat Besar</option>
          </select>
          <button type="button" onClick={() => execCmd("insertUnorderedList")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Bullet list"><IconListBullet className="h-4 w-4" /></button>
          <button type="button" onClick={() => execCmd("insertOrderedList")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Numbered list"><IconListNumber className="h-4 w-4" /></button>
          <button type="button" onClick={() => execCmd("hiliteColor", "#fef08a")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Highlight kuning"><span className="inline-block h-4 w-4 rounded bg-yellow-200 border border-yellow-300" /></button>
          <button type="button" onClick={() => execCmd("hiliteColor", "#bbf7d0")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Highlight hijau"><span className="inline-block h-4 w-4 rounded bg-green-200 border border-green-300" /></button>
          <button type="button" onClick={() => execCmd("hiliteColor", "#bfdbfe")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Highlight biru"><span className="inline-block h-4 w-4 rounded bg-blue-200 border border-blue-300" /></button>
          <button type="button" onClick={() => execCmd("removeFormat")} className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" title="Hapus format"><IconClearFormat className="h-4 w-4" /></button>
        </div>
        <div
          ref={createEditorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncCreateEditor}
          onFocus={() => setActiveEditor("create")}
          data-placeholder="Tulis catatan..."
          className={`w-full flex-1 min-h-[300px] text-sm border-0 outline-none resize-none leading-relaxed rounded-lg p-2 ${colorClasses[createColor]} ${colorTextClasses[createColor]}`}
        />
      </div>
    );
  }

  // ── Main List View ────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 -mx-4 px-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari catatan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-8 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800 dark:focus:ring-slate-400/20"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700">
              <IconClose className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {canEditNotes && copiedNoteId && (
          <button type="button" onClick={() => pasteNoteToFolder(currentFolderId)}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            {moveMode ? "Pindah ke " : "Tempel ke "}{currentFolderId ? "folder ini" : "Catatan"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        <button
          type="button"
          onClick={() => setActiveNotePage("pinned")}
          className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
            activeNotePage === "pinned"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Disematkan ({allPinnedNotes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveNotePage("explorer")}
          className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
            activeNotePage === "explorer"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Semua Catatan
        </button>
      </div>

      {/* Pinned Notes Page */}
      {activeNotePage === "pinned" && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {allPinnedNotes.length > 0 ? (
            allPinnedNotes.map((note) => <NoteRow key={note.id} note={note} />)
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <IconPin className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada catatan yang disematkan</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Klik ikon pin pada catatan untuk menyematkannya
              </p>
            </div>
          )}
        </div>
      )}

      {/* Explorer Page */}
      {activeNotePage === "explorer" && (
        <>
          {/* Breadcrumb */}
          <div className="flex items-center justify-between gap-2 relative">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs text-slate-500 dark:text-slate-400 scrollbar-hide">
              <div className="shrink-0 sticky left-0 z-10 flex items-center gap-1 bg-slate-50 dark:bg-slate-950">
                <button type="button" onClick={() => {
                  if (!currentFolderId) return;
                  const parentId = folderPath.length > 0 ? folderPath[folderPath.length - 1].parentId : null;
                  navigateToFolder(parentId);
                }}
                  className={`rounded p-0.5 transition ${currentFolderId ? "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" : "text-slate-300 dark:text-slate-700 cursor-default"}`} title={currentFolderId ? "Kembali" : ""}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
                  </svg>
                </button>
                {canEditNotes && (
                  <>
                    <button type="button" onClick={openAddFolder}
                      className="cursor-pointer rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Tambah Folder">
                      <span className="relative flex items-center justify-center">
                        <IconFolder className="h-4 w-4" />
                        <IconPlusSmall className="absolute h-2 w-2" />
                      </span>
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                  </>
                )}
              </div>
              <button type="button" onClick={() => navigateToFolder(null)}
                className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 transition ${currentFolderId === null ? "bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white" : "hover:bg-slate-100/70 hover:text-slate-700 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"}`}>
                root
              </button>
              {folderPath.map((folder, idx) => {
                const parentId = folder.parentId;
                const siblingFolders = folders
                  .filter((f) => f.parentId === parentId && f.id !== folder.id)
                  .sort((a, b) => a.name.localeCompare(b.name, "id"));
                return (
                  <span key={folder.id} className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={(e) => {
                      if (arrowMenuIndex === idx) {
                        setArrowMenuIndex(null);
                        setArrowMenuPos(null);
                      } else {
                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                        setArrowMenuPos({ top: rect.bottom + 4, left: rect.left });
                        setArrowMenuIndex(idx);
                      }
                    }}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                      <IconChevronRight className="h-3 w-3" />
                    </button>
                    {idx === folderPath.length - 1 ? (
                      <span className="max-w-[150px] truncate rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white">{folder.name}</span>
                    ) : (
                      <button type="button" onClick={() => navigateToFolder(folder.id)}
                        className="max-w-[150px] truncate rounded-lg px-2 py-1 transition hover:bg-slate-100/70 hover:text-slate-700 dark:hover:bg-slate-800/60 dark:hover:text-slate-200">
                        {folder.name}
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <span className="shrink-0 sticky right-0 z-10 text-[11px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 pl-2">
              {currentFolderNotes.length} catatan{subfolders.length > 0 ? ` · ${subfolders.length} folder` : ""}
            </span>
            {/* Arrow popup rendered with fixed position near the clicked button */}
            {arrowMenuPos && arrowMenuIndex !== null && folderPath[arrowMenuIndex] && (() => {
              const folder = folderPath[arrowMenuIndex];
              const parentId = folder.parentId;
              const siblingFolders = folders
                .filter((f) => f.parentId === parentId && f.id !== folder.id)
                .sort((a, b) => a.name.localeCompare(b.name, "id"));
              if (siblingFolders.length === 0) return null;
              return (
                <div data-arrow-menu className="fixed z-50 min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden"
                  style={{ top: arrowMenuPos.top, left: arrowMenuPos.left }}>
                  {siblingFolders.map((sf) => (
                    <button key={sf.id} type="button" onClick={() => { navigateToFolder(sf.id); setArrowMenuIndex(null); setArrowMenuPos(null); }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                      {sf.name}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Subfolders */}
          {subfolders.length > 0 && (
            <div className="flex flex-col gap-1">
              {subfolders.map((folder) => (
                <FolderRow key={folder.id} folder={folder} />
              ))}
            </div>
          )}

          {/* Notes List */}
          {filteredNotes.length > 0 ? (
            <div className="flex flex-col gap-3">
              {pinnedNotes.length > 0 && (
                <div>
                  {otherNotes.length > 0 && (
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      <IconPin className="h-3 w-3" filled />Disematkan
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {pinnedNotes.map((note) => <NoteRow key={note.id} note={note} />)}
                  </div>
                </div>
              )}
              {otherNotes.length > 0 && (
                <div>
                  {pinnedNotes.length > 0 && (
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Lainnya
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {otherNotes.map((note) => <NoteRow key={note.id} note={note} />)}
                  </div>
                </div>
              )}
            </div>
          ) : isSearching ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <IconSearch className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tidak ada catatan yang cocok dengan &ldquo;{searchQuery}&rdquo;
              </p>
            </div>
          ) : showEmptyFolderState ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
              <IconNotes className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Belum ada catatan di sini</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {canEditNotes ? "Mulai dengan menambahkan catatan baru" : "Belum ada catatan yang dibuat"}
                </p>
              </div>
              {canEditNotes && <Button onClick={openAddNote}>+ Catatan</Button>}
            </div>
          ) : null}
        </>
      )}

      {/* Floating Action Button (admin only) */}
      {canEditNotes && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-6 z-50 md:bottom-6">
          <button type="button" onClick={openAddNote}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-700 active:scale-95 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            title="Tambah Catatan">
            <IconPlusSmall className="h-7 w-7" />
          </button>
        </div>
      )}

      {/* Modal Hapus Catatan */}
      <Modal open={!!deleteConfirmId} title="Hapus Catatan" onClose={() => setDeleteConfirmId(null)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yakin hapus catatan{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              &ldquo;{notes.find((n) => n.id === deleteConfirmId)?.title}&rdquo;
            </span>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Batal</Button>
            <button type="button" onClick={confirmDelete}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
              Hapus
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Tambah/Edit Folder */}
      <Modal open={openFolderModal} title={editingFolder ? "Edit Folder" : "Folder Baru"}
        onClose={() => { setOpenFolderModal(false); setFolderName(""); }}>
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Nama Folder</div>
            <Input placeholder="Contoh: Pekerjaan, Belanja, dll" value={folderName}
              onChange={(e) => setFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveFolder()}
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
              &ldquo;{folders.find((f) => f.id === deleteFolderId)?.name}&rdquo;
            </span>?{" "}
            Catatan di dalamnya akan tetap ada, hanya folder yang dihapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteFolderId(null)}>Batal</Button>
            <button type="button" onClick={confirmDeleteFolder}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
              Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
