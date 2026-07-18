import { NavLink, useLocation, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Input from "../components/Input";
import Modal from "../components/Modal";
import Select from "../components/Select";
import DashboardPage from "./DashboardPage";
import TransactionsPage from "./TransactionsPage";
import ReportsPage from "./ReportsPage";
import { getAllProfiles } from "../lib/users";
import { useAuth, canManageBooks } from "../lib/auth";
import type { Profile } from "../lib/auth";
import {
  addBook,
  deleteBook,
  getBookPermissions,
  getBooks,
  getBookStatsMap,
  getRoutineCategories,
  getRoutineChecklists,
  getRoutineFrequency,
  getRoutineMembers,
  renameBook,
  saveRoutineCategories,
  saveRoutineChecklists,
  saveRoutineFrequency,
  saveRoutineMembers,
  saveRoutineSessions,
  setBookGroupMembers,
  setBookPermissions,
  getUserBookPermissions,
  getBookViewPermissions,
  setBookViewPermissions,
  setBookViewPermissionsAdminOnly,
  isAdminOnlyBook,
  getUserBookViewPermissions,
  getAllRestrictedBookIds,
  SUPER_ADMIN_ONLY_SENTINEL,
} from "../lib/store";
import { formatIDR } from "../lib/money";
import type {
  Book,
  BookType,
  RoutineCategory,
  RoutineFrequency,
  RoutineMember,
} from "../lib/types";
import { uid } from "../lib/id";

export default function BukuKasPage() {
  const { bookId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tab, setTab] = useState<"dashboard" | "laporan">("dashboard");

  const [openManageBooks, setOpenManageBooks] = useState(false);
  const [openAddBook, setOpenAddBook] = useState(false);
  const [openEditBook, setOpenEditBook] = useState(false);
  const [openDeleteBookModal, setOpenDeleteBookModal] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editBookName, setEditBookName] = useState("");
  const [deleteBookConfirmText, setDeleteBookConfirmText] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | undefined>(undefined);
  const [bookStats, setBookStats] = useState<Record<string, number>>({});
  const [newBookName, setNewBookName] = useState("");
  const [newBookType, setNewBookType] = useState<BookType>("biasa");
  const [newRoutineFrequency, setNewRoutineFrequency] =
    useState<RoutineFrequency>("bulanan");
  const [newRoutineMembers, setNewRoutineMembers] = useState<RoutineMember[]>(
    [],
  );
  const [newRoutineCategories, setNewRoutineCategories] = useState<
    RoutineCategory[]
  >([]);
  const [editingBookType, setEditingBookType] = useState<BookType>("biasa");
  const [editRoutineFrequency, setEditRoutineFrequency] =
    useState<RoutineFrequency>("bulanan");
  const [editRoutineMembers, setEditRoutineMembers] = useState<RoutineMember[]>(
    [],
  );
  const [editRoutineCategories, setEditRoutineCategories] = useState<
    RoutineCategory[]
  >([]);
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<Set<string>>(
    new Set(),
  );
  const [editGroupMemberIds, setEditGroupMemberIds] = useState<Set<string>>(
    new Set(),
  );

  // State untuk modal kelola anggota dari user
  const [openMemberModal, setOpenMemberModal] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedMemberCategoryIds, setSelectedMemberCategoryIds] = useState<
    Record<string, Set<string>>
  >({}); // profileId -> Set of category ids
  const [memberSettingsTab, setMemberSettingsTab] = useState<string>(""); // current category id
  const [isEditMode, setIsEditMode] = useState(false); // untuk membedakan add vs edit

  // State untuk modal kelola kategori
  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<
    RoutineCategory[]
  >([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [isCategoryEditMode, setIsCategoryEditMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryAmount, setNewCategoryAmount] = useState("");

  // State untuk modal atur admin
  const [openPermissionModal, setOpenPermissionModal] = useState(false);
  const [permissionBookId, setPermissionBookId] = useState<string | null>(null);
  const [permissionUserIds, setPermissionUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [allAdminProfiles, setAllAdminProfiles] = useState<Profile[]>([]);

  // State untuk modal izin lihat buku
  const [openViewPermissionModal, setOpenViewPermissionModal] = useState(false);
  const [viewPermissionBookId, setViewPermissionBookId] = useState<string | null>(null);
  const [viewPermissionUserIds, setViewPermissionUserIds] = useState<Set<string>>(new Set());
  const [viewPermissionAdminOnly, setViewPermissionAdminOnly] = useState(false);
  const [allNonAdminProfiles, setAllNonAdminProfiles] = useState<Profile[]>([]);
  // null = semua buku (super_admin), Set = book_id yg punya restriksi lihat untuk user ini
  const [viewRestrictedBookIds, setViewRestrictedBookIds] = useState<Set<string> | null>(null);
  const [userViewAllowedBookIds, setUserViewAllowedBookIds] = useState<Set<string>>(new Set());
  const [viewPermissionsLoaded, setViewPermissionsLoaded] = useState(false);

  // State untuk modal alert
  const [openAlertModal, setOpenAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  // State untuk expand/collapse group di modal kelola buku
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  // State untuk quick add transaction
  const [openQuickAddModal, setOpenQuickAddModal] = useState(false);
  const [allowedBookIds, setAllowedBookIds] = useState<string[] | null>(null);

  function showAlert(message: string) {
    setAlertMessage(message);
    setOpenAlertModal(true);
  }

  // Load books on mount
  useEffect(() => {
    getBooks().then(setBooks).catch(console.error);
  }, []);

  // Load view restrictions untuk non-super_admin
  useEffect(() => {
    if (!profile) return;
    if (profile.role === "super_admin") {
      setViewRestrictedBookIds(null); // super admin lihat semua
      setViewPermissionsLoaded(true);
      return;
    }
    Promise.all([
      getAllRestrictedBookIds(),
      getUserBookViewPermissions(profile.id),
    ]).then(([restrictedIds, allowedIds]) => {
      setViewRestrictedBookIds(new Set(restrictedIds));
      setUserViewAllowedBookIds(new Set(allowedIds));
    }).catch(console.error).finally(() => {
      setViewPermissionsLoaded(true);
    });
  }, [profile]);

  // Load currentBook when bookId changes
  useEffect(() => {
    if (!bookId) {
      setCurrentBook(undefined);
      return;
    }
    getBooks()
      .then((all) => setCurrentBook(all.find((b) => b.id === bookId)))
      .catch(console.error);
  }, [bookId]);

  // Load bookStats whenever books list changes
  useEffect(() => {
    if (books.length === 0) return;
    let cancelled = false;

    async function loadStats() {
      const stats = await getBookStatsMap(books);
      if (!cancelled) {
        setBookStats(stats);
      }
    }

    loadStats().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [books]);

  // Redirect rutin/kolektif/group books
  useEffect(() => {
    if (currentBook?.type === "rutin" && bookId) {
      navigate(`/buku-kas-rutin/${bookId}`, { replace: true });
    } else if (currentBook?.type === "kolektif" && bookId) {
      navigate(`/buku-kas-kolektif/${bookId}`, { replace: true });
    } else if (currentBook?.type === "group" && bookId) {
      navigate(`/buku-kas/group/${bookId}`, { replace: true });
    }
  }, [currentBook, bookId, navigate]);

  if (bookId) {
    if (
      currentBook?.type === "rutin" ||
      currentBook?.type === "kolektif" ||
      currentBook?.type === "group"
    ) {
      return null;
    }

    const isRekeningTransactionsPage = location.pathname.endsWith(
      "/transaksi-rekening",
    );
    const isTransactionsPage =
      isRekeningTransactionsPage || location.pathname.endsWith("/transaksi");

    return (
      <div className={isTransactionsPage ? "flex flex-col flex-1 min-h-0" : "grid gap-4"}>
        {isTransactionsPage ? (
          <TransactionsPage
            bookId={bookId}
            mode={isRekeningTransactionsPage ? "rekening" : "semua"}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={
                  tab === "dashboard"
                    ? "rounded-lg px-3 py-2 text-sm font-medium bg-slate-900 dark:bg-slate-700 text-white"
                    : "rounded-lg px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }
                onClick={() => setTab("dashboard")}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={
                  tab === "laporan"
                    ? "rounded-lg px-3 py-2 text-sm font-medium bg-slate-900 dark:bg-slate-700 text-white"
                    : "rounded-lg px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }
                onClick={() => setTab("laporan")}
              >
                Laporan
              </button>
            </div>

            {tab === "dashboard" ? (
              <DashboardPage
                bookId={bookId}
                saldoHref={`/buku-kas/${bookId}/transaksi`}
                rekeningHref={`/buku-kas/${bookId}/transaksi-rekening`}
              />
            ) : (
              <ReportsPage bookId={bookId} />
            )}
          </>
        )}
      </div>
    );
  }

  async function refreshBooks() {
    const all = await getBooks();
    setBooks(all);
  }

  function getGroupMemberCount(groupId: string) {
    return books.filter((book) => book.groupId === groupId).length;
  }

  // Set kolektif book IDs untuk cek apakah groupId mengarah ke kolektif
  const kolektifBookIds = new Set(books.filter((b) => b.type === "kolektif").map((b) => b.id));

  function getTopLevelBooks() {
    return books
      .filter((book) => book.type === "group" || !book.groupId)
      .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  }

  function getAvailableBooksForGroup(groupId?: string | null) {
    return books.filter((book) => {
      if (book.type === "group") return false;
      if (groupId) {
        return !book.groupId || book.groupId === groupId;
      }
      return !book.groupId;
    });
  }

  function toggleNewGroupMember(bookId: string) {
    setNewGroupMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }

  function toggleEditGroupMember(bookId: string) {
    setEditGroupMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }

  async function createBook() {
    const n = newBookName.trim();
    if (!n) {
      showAlert("Nama buku tidak boleh kosong!");
      return;
    }

    if (newBookType === "group") {
      if (newGroupMemberIds.size === 0) {
        showAlert("Pilih minimal 1 card buku kas untuk dimasukkan ke group.");
        return;
      }
    }

    if (newBookType === "rutin") {
      // Hanya validasi anggota dan kategori untuk buku bulanan
      // Untuk per sesi, anggota dan kategori dikelola per sesi
      if (newRoutineFrequency === "bulanan") {
        const members = newRoutineMembers
          .map((m) => ({ ...m, name: m.name.trim() }))
          .filter((m) => m.name);

        if (members.length === 0) {
          showAlert(
            "Anggota tidak boleh kosong! Silakan kelola anggota terlebih dahulu.",
          );
          return;
        }

        const categories = newRoutineCategories
          .map((c) => ({
            ...c,
            name: c.name.trim(),
            amount: Number(c.amount) || 0,
          }))
          .filter((c) => c.name && c.amount > 0);

        if (categories.length === 0) {
          showAlert(
            "Kategori tidak boleh kosong! Silakan kelola kategori terlebih dahulu.",
          );
          return;
        }
      }
    }

    try {
      const book = await addBook(n, newBookType);
      if (newBookType === "group") {
        await setBookGroupMembers(book.id, [...newGroupMemberIds]);
      }
      if (newBookType === "rutin") {
        const freq: RoutineFrequency =
          newRoutineFrequency === "arisan" ? "arisan" : "bulanan";
        const members = newRoutineMembers
          .map((m) => ({ ...m, name: m.name.trim() }))
          .filter((m) => m.name);
        const categories = newRoutineCategories
          .map((c) => ({
            ...c,
            name: c.name.trim(),
            amount: Number(c.amount) || 0,
          }))
          .filter((c) => c.name && c.amount > 0);
        await saveRoutineFrequency(book.id, freq);
        await saveRoutineMembers(book.id, members);
        await saveRoutineCategories(book.id, categories);
        await saveRoutineChecklists(book.id, []);
        if (freq === "arisan") {
          await saveRoutineSessions(book.id, [
            { id: uid("ses"), name: "Sesi 1" },
          ]);
        } else {
          await saveRoutineSessions(book.id, []);
        }
      }
      setNewBookName("");
      setNewGroupMemberIds(new Set());
      await refreshBooks();
      setOpenAddBook(false);
    } catch (error) {
      console.error("Error creating book:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      showAlert(
        `Gagal membuat buku kas: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async function removeBook(id: string) {
    await deleteBook(id);
    await refreshBooks();
  }

  async function startEditBook(id: string) {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    setEditingBookId(id);
    setEditBookName(book.name);
    setEditingBookType(book.type);
    if (book.type === "group") {
      setEditGroupMemberIds(
        new Set(
          books
            .filter((candidate) => candidate.groupId === id)
            .map((candidate) => candidate.id),
        ),
      );
      setEditRoutineFrequency("bulanan");
      setEditRoutineMembers([]);
      setEditRoutineCategories([]);
    } else if (book.type === "rutin") {
      const [freq, members, categories] = await Promise.all([
        getRoutineFrequency(id),
        getRoutineMembers(id),
        getRoutineCategories(id),
      ]);
      setEditRoutineFrequency(freq);
      setEditRoutineMembers(members);
      setEditRoutineCategories(categories);
      setEditGroupMemberIds(new Set());
    } else {
      setEditRoutineFrequency("bulanan");
      setEditRoutineMembers([]);
      setEditRoutineCategories([]);
      setEditGroupMemberIds(new Set());
    }
    setOpenEditBook(true);
  }

  async function saveBookRename() {
    if (!editingBookId) return;
    const name = editBookName.trim();
    if (!name) {
      showAlert("Nama buku tidak boleh kosong!");
      return;
    }

    if (editingBookType === "group") {
      if (editGroupMemberIds.size === 0) {
        showAlert("Pilih minimal 1 card buku kas untuk dimasukkan ke group.");
        return;
      }
    }

    if (editingBookType === "rutin") {
      // Hanya validasi anggota dan kategori untuk buku bulanan
      // Untuk per sesi, anggota dan kategori dikelola per sesi
      if (editRoutineFrequency === "bulanan") {
        const members = editRoutineMembers
          .map((m) => ({ ...m, name: m.name.trim() }))
          .filter((m) => m.name);

        if (members.length === 0) {
          showAlert(
            "Anggota tidak boleh kosong! Silakan kelola anggota terlebih dahulu.",
          );
          return;
        }

        const categories = editRoutineCategories
          .map((c) => ({
            ...c,
            name: c.name.trim(),
            amount: Number(c.amount) || 0,
          }))
          .filter((c) => c.name && c.amount > 0);

        if (categories.length === 0) {
          showAlert(
            "Kategori tidak boleh kosong! Silakan kelola kategori terlebih dahulu.",
          );
          return;
        }
      }
    }

    try {
      await renameBook(editingBookId, name);
      if (editingBookType === "group") {
        await setBookGroupMembers(editingBookId, [...editGroupMemberIds]);
      }
      if (editingBookType === "rutin") {
        const freq: RoutineFrequency =
          editRoutineFrequency === "arisan" ? "arisan" : "bulanan";
        await saveRoutineFrequency(editingBookId, freq);

        if (freq === "bulanan") {
          // Untuk bulanan: simpan members dan categories, lalu bersihkan checklists yang tidak valid
          const members = editRoutineMembers
            .map((m) => ({ ...m, name: m.name.trim() }))
            .filter((m) => m.name);
          const categories = editRoutineCategories
            .map((c) => ({
              ...c,
              name: c.name.trim(),
              amount: Number(c.amount) || 0,
            }))
            .filter((c) => c.name && c.amount > 0);
          await saveRoutineMembers(editingBookId, members);
          await saveRoutineCategories(editingBookId, categories);
          const validMemberIds = new Set(members.map((m) => m.id));
          const validCategoryIds = new Set(categories.map((c) => c.id));
          const existingChecklists = await getRoutineChecklists(editingBookId);
          const cleanedChecklists = existingChecklists.filter(
            (c) =>
              validMemberIds.has(c.memberId) &&
              validCategoryIds.has(c.categoryId),
          );
          await saveRoutineChecklists(editingBookId, cleanedChecklists);
        }
        // Untuk arisan: tidak overwrite members/categories/checklists — dikelola per sesi
      }
      await refreshBooks();
      setOpenEditBook(false);
      setEditingBookId(null);
    } catch (error) {
      console.error("Error saving book:", error);
      showAlert("Gagal menyimpan perubahan. Silakan coba lagi.");
    }
  }

  function resetNewRoutineConfig() {
    setNewRoutineFrequency("bulanan");
    setNewRoutineMembers([]);
    setNewRoutineCategories([]);
  }

  function addNewRoutineMemberRow() {
    setNewRoutineMembers((prev) => [
      ...prev,
      { id: uid("rm"), name: "", categoryIds: newRoutineCategories.map(c => c.id) },
    ]);
  }

  function updateNewRoutineMember(id: string, name: string) {
    setNewRoutineMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name } : m)),
    );
  }

  function removeNewRoutineMember(id: string) {
    setNewRoutineMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function addNewRoutineCategoryRow() {
    setNewRoutineCategories((prev) => [
      ...prev,
      { id: uid("rc"), name: "", amount: 0 },
    ]);
  }

  function updateNewRoutineCategoryName(id: string, name: string) {
    setNewRoutineCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
    );
  }

  function updateNewRoutineCategoryAmount(id: string, raw: string) {
    const amount = Number(raw.replace(/\D/g, "")) || 0;
    setNewRoutineCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, amount } : c)),
    );
  }

  function removeNewRoutineCategory(id: string) {
    setNewRoutineCategories((prev) => prev.filter((c) => c.id !== id));
  }

  function addEditRoutineMemberRow() {
    setEditRoutineMembers((prev) => [
      ...prev,
      { id: uid("rm"), name: "", categoryIds: editRoutineCategories.map(c => c.id) },
    ]);
  }

  function updateEditRoutineMember(id: string, name: string) {
    setEditRoutineMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name } : m)),
    );
  }

  function removeEditRoutineMember(id: string) {
    setEditRoutineMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function addEditRoutineCategoryRow() {
    setEditRoutineCategories((prev) => [
      ...prev,
      { id: uid("rc"), name: "", amount: 0 },
    ]);
  }

  function updateEditRoutineCategoryName(id: string, name: string) {
    setEditRoutineCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
    );
  }

  function updateEditRoutineCategoryAmount(id: string, raw: string) {
    const amount = Number(raw.replace(/\D/g, "")) || 0;
    setEditRoutineCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, amount } : c)),
    );
  }

  function removeEditRoutineCategory(id: string) {
    setEditRoutineCategories((prev) => prev.filter((c) => c.id !== id));
  }

  // Get the current categories (for add or edit)
  function getCurrentCategoriesForMemberModal() {
    return isEditMode ? editRoutineCategories : newRoutineCategories;
  }

  async function openMemberModalForAdd() {
    const profiles = await getAllProfiles();
    setAllProfiles(profiles);
    const memberByName = new Map(
      newRoutineMembers.map((m) => [m.name.trim().toLowerCase(), m]),
    );
    const selected = new Set(
      profiles
        .filter((p) => memberByName.has(p.full_name.trim().toLowerCase()))
        .map((p) => p.id),
    );
    const currentCats = getCurrentCategoriesForMemberModal();
    const categoryIds: Record<string, Set<string>> = {};
    // Only set categoryIds for existing members
    for (const p of profiles) {
      const existing = memberByName.get(p.full_name.trim().toLowerCase());
      if (existing) {
        categoryIds[p.id] = new Set(existing.categoryIds);
      }
    }
    setSelectedProfileIds(selected);
    setSelectedMemberCategoryIds(categoryIds);
    if (newRoutineCategories.length > 0) {
      setMemberSettingsTab(newRoutineCategories[0].id);
    }
    setIsEditMode(false);
    setOpenMemberModal(true);
  }

  async function openMemberModalForEdit() {
    const profiles = await getAllProfiles();
    setAllProfiles(profiles);
    const memberByName = new Map(
      editRoutineMembers.map((m) => [m.name.trim().toLowerCase(), m]),
    );
    const selected = new Set(
      profiles
        .filter((p) => memberByName.has(p.full_name.trim().toLowerCase()))
        .map((p) => p.id),
    );
    const categoryIds: Record<string, Set<string>> = {};
    // Only set categoryIds for existing members
    for (const p of profiles) {
      const existing = memberByName.get(p.full_name.trim().toLowerCase());
      if (existing) {
        categoryIds[p.id] = new Set(existing.categoryIds);
      }
    }
    setSelectedProfileIds(selected);
    setSelectedMemberCategoryIds(categoryIds);
    if (editRoutineCategories.length > 0) {
      setMemberSettingsTab(editRoutineCategories[0].id);
    }
    setIsEditMode(true);
    setOpenMemberModal(true);
  }

  function toggleProfileSelection(profileId: string) {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
    // If adding a new profile, initialize with empty categoryIds
    setSelectedMemberCategoryIds((prev) => {
      const next = { ...prev };
      if (!next[profileId]) {
        next[profileId] = new Set(); // Empty set initially
      }
      return next;
    });
  }

  function toggleMemberCategory(profileId: string) {
    if (!memberSettingsTab) return;
    setSelectedMemberCategoryIds((prev) => {
      const next = { ...prev };
      const currentCats = next[profileId] || new Set();
      const newCats = new Set(currentCats);
      if (newCats.has(memberSettingsTab)) {
        newCats.delete(memberSettingsTab);
      } else {
        newCats.add(memberSettingsTab);
      }
      next[profileId] = newCats;
      // Update selected profiles to include user if they have any categories
      setSelectedProfileIds((prevIds) => {
        const nextIds = new Set(prevIds);
        if (newCats.size === 0) {
          nextIds.delete(profileId);
        } else {
          nextIds.add(profileId);
        }
        return nextIds;
      });
      return next;
    });
  }

  function applySelectedMembers() {
    const currentMembers = isEditMode ? editRoutineMembers : newRoutineMembers;
    const memberIdByProfileId = new Map(
      currentMembers.map((m) => [m.profileId ?? m.name.trim().toLowerCase(), m.id]),
    );
    const memberIdByName = new Map(
      currentMembers.map((m) => [m.name.trim().toLowerCase(), m.id]),
    );

    const selectedProfiles = allProfiles.filter((p) =>
      selectedProfileIds.has(p.id),
    );
    const members: RoutineMember[] = selectedProfiles.map((p) => ({
      id: memberIdByProfileId.get(p.id)
        ?? memberIdByName.get(p.full_name.trim().toLowerCase())
        ?? uid("rm"),
      name: p.full_name,
      profileId: p.id,
      categoryIds: Array.from(selectedMemberCategoryIds[p.id] || []),
    }));

    if (isEditMode) {
      setEditRoutineMembers(members);
    } else {
      setNewRoutineMembers(members);
    }

    setOpenMemberModal(false);
  }

  async function openCategoryModalForAdd() {
    // Load kategori yang sudah ada dari newRoutineCategories, PRESERVE the original ids!
    const existingCategories = newRoutineCategories.map((c) => ({
      id: c.id,
      name: c.name,
      amount: c.amount,
    }));

    setAvailableCategories(existingCategories);

    // Tandai semua kategori yang sudah ada sebagai selected
    const allIds = new Set(existingCategories.map((c) => c.id));
    setSelectedCategoryIds(allIds);
    setIsCategoryEditMode(false);
    setOpenCategoryModal(true);
  }

  async function openCategoryModalForEdit() {
    // Load kategori yang sudah ada dari editRoutineCategories, PRESERVE the original ids!
    const existingCategories = editRoutineCategories.map((c) => ({
      id: c.id,
      name: c.name,
      amount: c.amount,
    }));

    setAvailableCategories(existingCategories);

    // Tandai semua kategori yang sudah ada sebagai selected
    const allIds = new Set(existingCategories.map((c) => c.id));
    setSelectedCategoryIds(allIds);
    setIsCategoryEditMode(true);
    setOpenCategoryModal(true);
  }

  function toggleCategorySelection(categoryId: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function applySelectedCategories() {
    const selectedCats = availableCategories.filter((c) =>
      selectedCategoryIds.has(c.id),
    );
    const categories: RoutineCategory[] = selectedCats.map((c) => ({
      id: c.id, // PRESERVE the original id!
      name: c.name,
      amount: c.amount,
    }));

    if (isCategoryEditMode) {
      setEditRoutineCategories(categories);
    } else {
      setNewRoutineCategories(categories);
    }

    setOpenCategoryModal(false);
  }

  function addCategoryToModal() {
    const name = newCategoryName.trim();
    const amount = Number(newCategoryAmount.replace(/\D/g, "")) || 0;

    if (!name || amount <= 0) return;

    const newCategory: RoutineCategory = {
      id: uid("rc"),
      name,
      amount,
    };

    setAvailableCategories((prev) => [...prev, newCategory]);
    setSelectedCategoryIds((prev) => new Set([...prev, newCategory.id]));
    setNewCategoryName("");
    setNewCategoryAmount("");
  }

  function updateCategoryInModal(
    categoryId: string,
    field: "name" | "amount",
    value: string,
  ) {
    setAvailableCategories((prev) =>
      prev.map((c) => {
        if (c.id === categoryId) {
          if (field === "name") {
            return { ...c, name: value };
          } else {
            const amount = Number(value.replace(/\D/g, "")) || 0;
            return { ...c, amount };
          }
        }
        return c;
      }),
    );
  }

  function removeCategoryFromModal(categoryId: string) {
    setAvailableCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      next.delete(categoryId);
      return next;
    });
  }

  function getBookTypeLabel(book: Book) {
    if (book.type === "group") {
      const memberCount = getGroupMemberCount(book.id);
      return `Group Buku • ${memberCount} kas`;
    }

    const baseLabel =
      book.type === "rutin"
        ? "Buku Rutinan"
        : book.type === "kolektif"
          ? "Buku Kolektif"
          : "Buku Transaksi";

    if (book.groupId) {
      const groupName = books.find((item) => item.id === book.groupId)?.name;
      return groupName ? `${baseLabel} • Masuk group ${groupName}` : baseLabel;
    }

    return baseLabel;
  }

  /**
   * Cek apakah buku ini boleh dilihat user saat ini.
   * - super_admin: selalu boleh
   * - Buku yang tidak ada di viewRestrictedBookIds: semua boleh lihat
   * - Buku yang ada di viewRestrictedBookIds: hanya user yang ada di userViewAllowedBookIds
   */
  function canViewBook(bookId: string): boolean {
    if (!profile) return false;
    if (profile.role === "super_admin") return true;
    if (!viewPermissionsLoaded) return false; // tunggu sampai data selesai dimuat
    if (!viewRestrictedBookIds) return true;
    if (!viewRestrictedBookIds.has(bookId)) return true; // tidak di-restrict
    return userViewAllowedBookIds.has(bookId);
  }

  const topLevelBooks = getTopLevelBooks();
  const newGroupCandidates = getAvailableBooksForGroup();
  const editGroupCandidates = getAvailableBooksForGroup(editingBookId);

  // Tampilkan skeleton cards saat view permissions belum selesai dimuat
  const visibleBooks = viewPermissionsLoaded
    ? topLevelBooks.filter((b) => canViewBook(b.id))
    : null; // null = belum siap

  return (
    <div className="relative grid gap-4 overflow-x-hidden">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {visibleBooks === null ? (
          // Skeleton — jumlah sesuai total buku agar layout tidak loncat
          Array.from({ length: Math.max(2, topLevelBooks.length) }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 animate-pulse"
            >
              <div className="h-4 rounded bg-slate-200 dark:bg-slate-700 w-3/4" />
              <div className="mt-auto space-y-1.5">
                <div className="h-2.5 rounded bg-slate-200 dark:bg-slate-700 w-1/3" />
                <div className="h-4 rounded bg-slate-200 dark:bg-slate-700 w-1/2" />
              </div>
            </div>
          ))
        ) : visibleBooks.map((b) => {
          const isRoutineBook = b.type === "rutin";
          const isKolektifBook = b.type === "kolektif";
          const isGroupBook = b.type === "group";
          const href = isGroupBook
            ? `/buku-kas/group/${b.id}`
            : isRoutineBook
              ? `/buku-kas-rutin/${b.id}`
              : isKolektifBook
                ? `/buku-kas-kolektif/${b.id}`
                : `/buku-kas/${b.id}`;
          const totalSaldo = bookStats[b.id] ?? 0;

          const getBookTypeColor = (book: Book) => {
            if (book.type === "group") return "bg-purple-500";
            if (book.type === "rutin") return "bg-blue-500";
            if (book.type === "kolektif") return "bg-emerald-500";
            return "bg-amber-500";
          };

          const getBookTypeIcon = (book: Book) => {
            if (book.type === "group") {
              return (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              );
            }
            if (book.type === "rutin") {
              return (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              );
            }
            if (book.type === "kolektif") {
              return (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              );
            }
            return (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            );
          };

          return (
            <NavLink key={b.id} to={href} className="block group">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all duration-200 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-1">
                <div className="p-4">
                  {/* Book name and type badge */}
                  <div className="mb-3">
                    <h3 className="text-base font-bold leading-snug text-slate-900 dark:text-slate-100 line-clamp-2">
                      {b.name}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {getBookTypeIcon(b)}
                      <span>
                        {isGroupBook
                          ? `Group (${getGroupMemberCount(b.id)})`
                          : isRoutineBook
                            ? "Rutin"
                            : isKolektifBook
                              ? "Kolektif"
                              : "Transaksi"}
                      </span>
                    </div>
                  </div>

                  {/* Balance section */}
                  <div className="flex items-center justify-between rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 px-3 py-2.5">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                      {formatIDR(totalSaldo)}
                    </div>
                  </div>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/5 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
              </div>
            </NavLink>
          );
        })}
      </div>

      {/* FAB group */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-6 z-50 flex flex-col items-center gap-1.5 md:bottom-6">
        {canManageBooks(profile?.role) && (
          <button
            type="button"
            aria-label="Kelola buku kas"
            className="grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800"
            onClick={() => {
              refreshBooks();
              setOpenManageBooks(true);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5 a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}

        {/* FAB tombol + untuk quick add transaksi — hanya di halaman utama (tidak di dalam buku), hanya super_admin dan admin */}
        {!bookId && (profile?.role === "super_admin" || profile?.role === "admin") && (
          <button
            type="button"
            aria-label="Tambah transaksi"
            className="grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-500 active:scale-95 transition-all"
            onClick={async () => {
              refreshBooks();
              // Load allowed book IDs
              if (profile) {
                if (profile.role === "super_admin") {
                  // Super admin can see all books
                  setAllowedBookIds(null);
                } else if (profile.role === "admin") {
                  // Admin only sees assigned books
                  const allowedIds = await getUserBookPermissions(profile.id);
                  setAllowedBookIds(allowedIds);
                } else {
                  // Members don't see any? Or maybe same as admin? Let's check existing logic
                  // Wait, let's see what canEditTransactions does
                  // From auth.tsx: canEditTransactions is only super_admin, so let's follow that
                  setAllowedBookIds([]);
                }
              }
              setOpenQuickAddModal(true);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        )}
      </div>

      <Modal
        open={openManageBooks}
        title="Kelola Buku Kas"
        onClose={() => setOpenManageBooks(false)}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            {books.filter((b) => !b.groupId || (b.type === "biasa" && kolektifBookIds.has(b.groupId ?? ""))).map((b) => {
              const isGroup = b.type === "group";
              const groupMembers = isGroup ? books.filter((m) => m.groupId === b.id) : [];
              const isExpanded = expandedGroupIds.has(b.id);

              return (
                <div key={b.id}>
                  <div
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${isGroup ? "cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700/50" : ""}`}
                    onClick={isGroup ? () => setExpandedGroupIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(b.id)) next.delete(b.id); else next.add(b.id);
                      return next;
                    }) : undefined}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {isGroup && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {b.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {getBookTypeLabel(b)}
                        </div>
                      </div>
                    </div>
                    <Button variant="secondary" onClick={(e) => { e.stopPropagation(); startEditBook(b.id); }}>
                      Edit
                    </Button>
                  </div>

                  {/* Anggota group yang expand */}
                  {isGroup && isExpanded && groupMembers.length > 0 && (
                    <div className="ml-4 mt-1 grid gap-1 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                      {groupMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                              {member.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {getBookTypeLabel(member)}
                            </div>
                          </div>
                          <Button variant="secondary" onClick={() => startEditBook(member.id)}>
                            Edit
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {isGroup && isExpanded && groupMembers.length === 0 && (
                    <div className="ml-4 mt-1 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                        Belum ada buku kas dalam group ini.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setNewBookName("");
                setNewBookType("biasa");
                setNewGroupMemberIds(new Set());
                resetNewRoutineConfig();
                setOpenAddBook(true);
              }}
            >
              Tambah
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openAddBook}
        title="Tambah Buku Kas"
        onClose={() => setOpenAddBook(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">
              Nama buku
            </div>
            <Input
              placeholder="Contoh: Kas Pemuda"
              value={newBookName}
              onChange={(e) => setNewBookName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createBook();
              }}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">
              Tipe buku
            </div>
            <Select
              value={newBookType}
              onChange={(e) => setNewBookType(e.target.value as BookType)}
            >
              <option value="biasa">Buku Transaksi</option>
              <option value="rutin">Buku Rutinan</option>
              <option value="kolektif">Buku Kolektif</option>
              <option value="group">Group Buku</option>
            </Select>
          </div>
          {newBookType === "group" ? (
            <div className="grid gap-2">
              <div className="text-xs font-medium text-slate-600">
                Pilih card yang masuk ke group ini
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border p-2">
                {newGroupCandidates.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-slate-500">
                    Semua card sudah masuk group. Kosongkan dulu dari group lain
                    untuk dipindahkan ke group baru.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {newGroupCandidates.map((candidate) => (
                      <label
                        key={candidate.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={newGroupMemberIds.has(candidate.id)}
                          onChange={() => toggleNewGroupMember(candidate.id)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {candidate.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {getBookTypeLabel(candidate)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {newBookType === "rutin" ? (
            <>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">
                  Frekuensi
                </div>
                <Select
                  value={newRoutineFrequency}
                  onChange={(e) =>
                    setNewRoutineFrequency(e.target.value as RoutineFrequency)
                  }
                >
                  <option value="bulanan">Bulanan</option>
                  <option value="arisan">Per sesi</option>
                </Select>
              </div>
              {newRoutineFrequency === "bulanan" && (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={openMemberModalForAdd}>
                    Kelola Anggota
                  </Button>
                  <Button variant="secondary" onClick={openCategoryModalForAdd}>
                    Kelola Kategori
                  </Button>
                </div>
              )}
              {newRoutineFrequency === "arisan" && (
                <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                  💡 Untuk buku per sesi, anggota dan kategori dikelola per sesi
                  di halaman detail buku.
                </div>
              )}
            </>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpenAddBook(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                createBook();
              }}
            >
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openEditBook}
        title="Edit Buku Kas"
        onClose={() => setOpenEditBook(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">
              Nama buku
            </div>
            <Input
              placeholder="Nama buku"
              value={editBookName}
              onChange={(e) => setEditBookName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveBookRename();
              }}
            />
          </div>
          {/* Tombol atur admin & izin lihat — hanya untuk super_admin */}
          {profile?.role === "super_admin" &&
            editingBookId &&
            editingBookType !== "group" && (
              <div className="grid gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const [userIds, allProfilesData] = await Promise.all([
                        getBookPermissions(editingBookId!),
                        getAllProfiles(),
                      ]);
                      setPermissionBookId(editingBookId);
                      setPermissionUserIds(new Set(userIds));
                      setAllAdminProfiles(
                        allProfilesData.filter((p) => p.role === "admin"),
                      );
                      setOpenPermissionModal(true);
                    } catch (err) {
                      console.error("Error loading permissions:", err);
                      alert(
                        "Gagal memuat data: " +
                          (err instanceof Error ? err.message : String(err)),
                      );
                    }
                  }}
                  className="w-full"
                >
                  Izin Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const [viewUserIds, allProfilesData] = await Promise.all([
                        getBookViewPermissions(editingBookId!),
                        getAllProfiles(),
                      ]);
                      setViewPermissionBookId(editingBookId);
                      const adminOnly = isAdminOnlyBook(viewUserIds);
                      setViewPermissionAdminOnly(adminOnly);
                      // Filter out sentinel from displayed user ids
                      setViewPermissionUserIds(new Set(viewUserIds.filter(id => id !== SUPER_ADMIN_ONLY_SENTINEL)));
                      setAllNonAdminProfiles(
                        allProfilesData.filter((p) => p.role !== "super_admin"),
                      );
                      setOpenViewPermissionModal(true);
                    } catch (err) {
                      console.error("Error loading view permissions:", err);
                      alert(
                        "Gagal memuat data: " +
                          (err instanceof Error ? err.message : String(err)),
                      );
                    }
                  }}
                  className="w-full"
                >
                  Izin Lihat
                </Button>
              </div>
            )}
          {editingBookType === "group" ? (
            <div className="grid gap-2">
              <div className="text-xs font-medium text-slate-600">
                Card di dalam group
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border p-2">
                {editGroupCandidates.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-slate-500">
                    Tidak ada card tersedia untuk group ini.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {editGroupCandidates.map((candidate) => (
                      <label
                        key={candidate.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={editGroupMemberIds.has(candidate.id)}
                          onChange={() => toggleEditGroupMember(candidate.id)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {candidate.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {getBookTypeLabel(candidate)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {editingBookType === "rutin" ? (
            <>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">
                  Frekuensi
                </div>
                <Select
                  value={editRoutineFrequency}
                  onChange={(e) =>
                    setEditRoutineFrequency(e.target.value as RoutineFrequency)
                  }
                >
                  <option value="bulanan">Bulanan</option>
                  <option value="arisan">Per sesi</option>
                </Select>
              </div>
              {editRoutineFrequency === "bulanan" && (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={openMemberModalForEdit}>
                    Kelola Anggota
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={openCategoryModalForEdit}
                  >
                    Kelola Kategori
                  </Button>
                </div>
              )}
              {editRoutineFrequency === "arisan" && (
                <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                  💡 Untuk buku per sesi, anggota dan kategori dikelola per sesi
                  di halaman detail buku.
                </div>
              )}
            </>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="danger"
              onClick={() => setOpenDeleteBookModal(true)}
              disabled={books.length <= 1}
            >
              Hapus
            </Button>
            <Button variant="secondary" onClick={() => setOpenEditBook(false)}>
              Batal
            </Button>
            <Button onClick={saveBookRename}>Simpan</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openDeleteBookModal}
        title="Konfirmasi"
        onClose={() => {
          setOpenDeleteBookModal(false);
          setDeleteBookConfirmText("");
        }}
      >
        <div className="grid gap-4">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            Hapus buku kas ini? Semua data di buku ini akan hilang.
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Ketik <span className="font-bold text-rose-600">"{editBookName}"</span> untuk konfirmasi
            </div>
            <input
              className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-600/30"
              placeholder={editBookName}
              value={deleteBookConfirmText}
              onChange={(e) => setDeleteBookConfirmText(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setOpenDeleteBookModal(false);
                setDeleteBookConfirmText("");
              }}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={deleteBookConfirmText !== editBookName}
              onClick={() => {
                if (editingBookId) removeBook(editingBookId);
                setOpenDeleteBookModal(false);
                setOpenEditBook(false);
                setDeleteBookConfirmText("");
              }}
            >
              Hapus
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openMemberModal}
        title="Pilih Anggota dari User"
        onClose={() => setOpenMemberModal(false)}
      >
        <div className="grid gap-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Atur anggota lewat tab kategori. User aktif akan otomatis tersimpan jika dicentang minimal di salah satu tab.
          </div>
          {(() => {
            const currentCategories = getCurrentCategoriesForMemberModal();
            if (currentCategories.length > 0) {
              return (
                <>
                  <div className="flex gap-2 overflow-x-auto">
                    {currentCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setMemberSettingsTab(category.id)}
                        className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition rounded-lg ${
                          memberSettingsTab === category.id
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-96 overflow-auto">
                    {allProfiles.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        Belum ada user terdaftar
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {(() => {
                          const allChecked = allProfiles.length > 0 && allProfiles.every(p => {
                            const cats = selectedMemberCategoryIds[p.id] || new Set();
                            return cats.has(memberSettingsTab);
                          });
                          return (
                            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={() => {
                                  setSelectedMemberCategoryIds(prev => {
                                    const next = { ...prev };
                                    const categoryId = memberSettingsTab;
                                    allProfiles.forEach(p => {
                                      const current = next[p.id] || new Set();
                                      const newCats = new Set(current);
                                      if (allChecked) {
                                        newCats.delete(categoryId);
                                      } else {
                                        newCats.add(categoryId);
                                      }
                                      next[p.id] = newCats;
                                      // Update selected profiles
                                      setSelectedProfileIds(prevIds => {
                                        const nextIds = new Set(prevIds);
                                        if (newCats.size === 0) {
                                          nextIds.delete(p.id);
                                        } else {
                                          nextIds.add(p.id);
                                        }
                                        return nextIds;
                                      });
                                    });
                                    return next;
                                  });
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                              />
                              <span>Pilih Semua</span>
                            </label>
                          );
                        })()}
                        {[...allProfiles].sort((a, b) => a.full_name.localeCompare(b.full_name, "id")).map((profile) => {
                        const memberCatIds = selectedMemberCategoryIds[profile.id] || new Set();
                        const isChecked = memberCatIds.has(memberSettingsTab);
                        return (
                          <label
                            key={profile.id}
                            className="flex items-center gap-3 rounded-lg border px-3 py-3 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleMemberCategory(profile.id)}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-900">
                                {profile.full_name}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {currentCategories.map((cat) => (
                                  memberCatIds.has(cat.id) && (
                                    <span
                                      key={cat.id}
                                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                    >
                                      {cat.name}
                                    </span>
                                  )
                                ))}
                                {memberCatIds.size === 0 && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                    Tidak aktif
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                      </div>
                    )}
                  </div>
                </>
              );
            } else {
                return (
                  <div className="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                    Silakan buat kategori terlebih dahulu sebelum mengatur anggota.
                  </div>
                );
            }
          })()}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenMemberModal(false)}
            >
              Batal
            </Button>
            <Button onClick={applySelectedMembers}>Terapkan</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCategoryModal}
        title="Pilih Kategori"
        onClose={() => setOpenCategoryModal(false)}
      >
        <div className="grid gap-4">
          <div className="max-h-96 overflow-auto">
            {availableCategories.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Tidak ada kategori tersedia
              </div>
            ) : (
              <div className="grid gap-2">
                {availableCategories.map((category) => (
                  <div
                    key={category.id}
                    className="grid grid-cols-[auto_1fr_140px_auto] items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.has(category.id)}
                      onChange={() => toggleCategorySelection(category.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <Input
                      placeholder="Nama kategori"
                      value={category.name}
                      onChange={(e) =>
                        updateCategoryInModal(
                          category.id,
                          "name",
                          e.target.value,
                        )
                      }
                    />
                    <Input
                      placeholder="Nominal"
                      inputMode="numeric"
                      value={category.amount ? String(category.amount) : ""}
                      onChange={(e) =>
                        updateCategoryInModal(
                          category.id,
                          "amount",
                          e.target.value,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeCategoryFromModal(category.id)}
                      className="text-rose-600 hover:text-rose-700 text-xs font-medium px-2"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="mb-2 text-xs font-medium text-slate-600">
              Tambah Kategori Baru
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  placeholder="Nama kategori"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Input
                  placeholder="Nominal"
                  inputMode="numeric"
                  value={newCategoryAmount}
                  onChange={(e) => setNewCategoryAmount(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                onClick={addCategoryToModal}
                className="w-full"
              >
                Tambah ke Daftar
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenCategoryModal(false)}
            >
              Batal
            </Button>
            <Button onClick={applySelectedCategories}>Terapkan</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openAlertModal}
        title="Perhatian"
        onClose={() => setOpenAlertModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-sm text-slate-700">{alertMessage}</div>
          <div className="flex justify-end">
            <Button onClick={() => setOpenAlertModal(false)}>OK</Button>
          </div>
        </div>
      </Modal>

      {/* Modal atur admin (izin edit) */}
      <Modal
        open={openPermissionModal}
        title="Izin Edit Buku"
        onClose={() => setOpenPermissionModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Pilih admin yang boleh <span className="font-semibold text-slate-700 dark:text-slate-300">mengedit</span> buku ini.
          </div>
          {allAdminProfiles.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              Belum ada admin terdaftar.
            </div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-auto">
              {allAdminProfiles.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={permissionUserIds.has(p.id)}
                    onChange={() => {
                      setPermissionUserIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) {
                          next.delete(p.id);
                        } else {
                          next.add(p.id);
                        }
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {p.full_name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {p.email}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenPermissionModal(false)}
            >
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!permissionBookId) return;
                try {
                  await setBookPermissions(permissionBookId, [
                    ...permissionUserIds,
                  ]);
                  setOpenPermissionModal(false);
                } catch (error) {
                  console.error("Error saving permissions:", error);
                  alert("Gagal menyimpan pengaturan admin");
                }
              }}
            >
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal izin lihat buku */}
      <Modal
        open={openViewPermissionModal}
        title="Izin Lihat Buku"
        onClose={() => setOpenViewPermissionModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Atur siapa yang boleh <span className="font-semibold text-slate-700 dark:text-slate-300">melihat</span> card buku ini.
            Jika tidak ada restriksi, semua user bisa melihat.
          </div>

          {/* Tombol super admin only */}
          <button
            type="button"
            onClick={() => {
              setViewPermissionAdminOnly((prev) => {
                if (!prev) {
                  // Aktifkan admin only → clear semua pilihan user
                  setViewPermissionUserIds(new Set());
                }
                return !prev;
              });
            }}
            className={`flex items-center gap-3 w-full rounded-lg border px-3 py-2.5 text-left transition ${
              viewPermissionAdminOnly
                ? "border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/20"
                : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            }`}
          >
            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition ${
              viewPermissionAdminOnly
                ? "border-rose-500 bg-rose-500"
                : "border-slate-300 dark:border-slate-600"
            }`}>
              {viewPermissionAdminOnly && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              )}
            </div>
            <div>
              <div className={`text-sm font-medium ${viewPermissionAdminOnly ? "text-rose-700 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>
                Hanya Super Admin
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                Semua user lain tidak bisa melihat buku ini
              </div>
            </div>
          </button>

          {/* Daftar user — disabled saat admin only aktif */}
          {!viewPermissionAdminOnly && (
            <>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Atau pilih user tertentu:
              </div>
              {allNonAdminProfiles.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  Belum ada user terdaftar.
                </div>
              ) : (
                <div className="grid gap-2 max-h-56 overflow-auto">
                  {allNonAdminProfiles.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <input
                        type="checkbox"
                        checked={viewPermissionUserIds.has(p.id)}
                        onChange={() => {
                          setViewPermissionUserIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) {
                              next.delete(p.id);
                            } else {
                              next.add(p.id);
                            }
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {p.full_name}
                        </div>
                        <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                          {p.email}
                          <span className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${p.role === "admin" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                            {p.role === "admin" ? "Admin" : "Member"}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Status info */}
          {viewPermissionAdminOnly ? (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              Buku ini hanya terlihat oleh Super Admin.
            </div>
          ) : viewPermissionUserIds.size > 0 ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Hanya {viewPermissionUserIds.size} user yang dipilih bisa melihat buku ini (+ super admin).
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              Tidak ada restriksi — semua user bisa melihat buku ini.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenViewPermissionModal(false)}
            >
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!viewPermissionBookId) return;
                try {
                  if (viewPermissionAdminOnly) {
                    await setBookViewPermissionsAdminOnly(viewPermissionBookId);
                  } else {
                    await setBookViewPermissions(viewPermissionBookId, [...viewPermissionUserIds]);
                  }
                  // Refresh view restrictions untuk user saat ini
                  if (profile && profile.role !== "super_admin") {
                    const [restrictedIds, allowedIds] = await Promise.all([
                      getAllRestrictedBookIds(),
                      getUserBookViewPermissions(profile.id),
                    ]);
                    setViewRestrictedBookIds(new Set(restrictedIds));
                    setUserViewAllowedBookIds(new Set(allowedIds));
                  }
                  setOpenViewPermissionModal(false);
                } catch (error) {
                  console.error("Error saving view permissions:", error);
                  alert("Gagal menyimpan pengaturan. Pastikan migration sudah dijalankan.");
                }
              }}
            >
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal pilih buku transaksi untuk quick add */}
      <Modal
        open={openQuickAddModal}
        title="Tambah Transaksi"
        onClose={() => setOpenQuickAddModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-sm text-slate-500">
            Pilih buku transaksi tujuan:
          </div>
          <div className="grid gap-2 max-h-80 overflow-auto">
            {books
              .filter((b) => {
                if (b.type !== "biasa") return false;
                if (allowedBookIds === null) return true; // Super admin
                return allowedBookIds.includes(b.id);
              })
              .map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setOpenQuickAddModal(false);
                    navigate(`/buku-kas/${b.id}/transaksi`, { state: { openAddTransaction: true } });
                  }}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {b.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Buku Transaksi
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-slate-400"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            {books.filter((b) => {
                if (b.type !== "biasa") return false;
                if (allowedBookIds === null) return true;
                return allowedBookIds.includes(b.id);
              }).length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                Belum ada buku transaksi yang dapat diakses.
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpenQuickAddModal(false)}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
