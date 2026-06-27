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
  const [selectedMemberTypes, setSelectedMemberTypes] = useState<
    Record<string, { kas: boolean; arisan: boolean }>
  >({});
  const [memberSettingsTab, setMemberSettingsTab] = useState<"kas" | "arisan">(
    "kas",
  );
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

  // State untuk modal alert
  const [openAlertModal, setOpenAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  function showAlert(message: string) {
    setAlertMessage(message);
    setOpenAlertModal(true);
  }

  // Load books on mount
  useEffect(() => {
    getBooks().then(setBooks).catch(console.error);
  }, []);

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
      <div className="grid gap-4">
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

  function getTopLevelBooks() {
    return books.filter((book) => book.type === "group" || !book.groupId);
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
      { id: uid("rm"), name: "", joinsKas: true, joinsArisan: true },
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
      { id: uid("rm"), name: "", joinsKas: true, joinsArisan: true },
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
    const types = Object.fromEntries(
      profiles.map((p) => {
        const existing = memberByName.get(p.full_name.trim().toLowerCase());
        return [
          p.id,
          {
            kas: existing?.joinsKas ?? true,
            arisan: existing?.joinsArisan ?? true,
          },
        ];
      }),
    );
    setSelectedProfileIds(selected);
    setSelectedMemberTypes(types);
    setMemberSettingsTab("kas");
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
    const types = Object.fromEntries(
      profiles.map((p) => {
        const existing = memberByName.get(p.full_name.trim().toLowerCase());
        return [
          p.id,
          {
            kas: existing?.joinsKas ?? true,
            arisan: existing?.joinsArisan ?? true,
          },
        ];
      }),
    );
    setSelectedProfileIds(selected);
    setSelectedMemberTypes(types);
    setMemberSettingsTab("kas");
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
    setSelectedMemberTypes((prev) => ({
      ...prev,
      [profileId]: prev[profileId] ?? { kas: true, arisan: true },
    }));
  }

  function toggleMemberType(profileId: string, type: "kas" | "arisan") {
    setSelectedMemberTypes((prev) => {
      const current = prev[profileId] ?? { kas: true, arisan: true };
      const next = {
        kas: type === "kas" ? !current.kas : current.kas,
        arisan: type === "arisan" ? !current.arisan : current.arisan,
      };

      setSelectedProfileIds((prevIds) => {
        const nextIds = new Set(prevIds);
        if (next.kas || next.arisan) {
          nextIds.add(profileId);
        } else {
          nextIds.delete(profileId);
        }
        return nextIds;
      });

      return {
        ...prev,
        [profileId]: next,
      };
    });
  }

  function applySelectedMembers() {
    const currentMembers = isEditMode ? editRoutineMembers : newRoutineMembers;
    const memberIdByName = new Map(
      currentMembers.map((m) => [m.name.trim().toLowerCase(), m.id]),
    );

    const selectedProfiles = allProfiles.filter((p) => {
      const types = selectedMemberTypes[p.id];
      return Boolean(types?.kas || types?.arisan);
    });
    const members: RoutineMember[] = selectedProfiles.map((p) => ({
      id: memberIdByName.get(p.full_name.trim().toLowerCase()) ?? uid("rm"),
      name: p.full_name,
      joinsKas: selectedMemberTypes[p.id]?.kas ?? true,
      joinsArisan: selectedMemberTypes[p.id]?.arisan ?? true,
    }));

    if (isEditMode) {
      setEditRoutineMembers(members);
    } else {
      setNewRoutineMembers(members);
    }

    setOpenMemberModal(false);
  }

  async function openCategoryModalForAdd() {
    // Load kategori yang sudah ada dari newRoutineCategories
    const existingCategories = newRoutineCategories.map((c) => ({
      id: uid("rc"), // Generate ID baru untuk modal
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
    // Load kategori yang sudah ada dari editRoutineCategories
    const existingCategories = editRoutineCategories.map((c) => ({
      id: uid("rc"), // Generate ID baru untuk modal
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
      id: uid("rc"),
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
      return `Group Buku • ${memberCount} card`;
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

  const topLevelBooks = getTopLevelBooks();
  const newGroupCandidates = getAvailableBooksForGroup();
  const editGroupCandidates = getAvailableBooksForGroup(editingBookId);

  return (
    <div className="relative grid gap-4 overflow-x-hidden">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {topLevelBooks.map((b) => {
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

          return (
            <NavLink key={b.id} to={href} className="block">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                    {b.name}
                  </div>
                  {isGroupBook ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                      Group
                    </span>
                  ) : null}
                </div>

                {isGroupBook ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {getGroupMemberCount(b.id)} card di dalam group
                  </div>
                ) : null}

                <div className="mt-auto">
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wide">
                    Saldo
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                    {formatIDR(totalSaldo)}
                  </div>
                </div>
              </div>
            </NavLink>
          );
        })}
      </div>

      {canManageBooks(profile?.role) && (
        <button
          type="button"
          aria-label="Kelola buku kas"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-6 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 md:bottom-6"
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

      <Modal
        open={openManageBooks}
        title="Kelola Buku Kas"
        onClose={() => setOpenManageBooks(false)}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            {books.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {b.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {getBookTypeLabel(b)}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => startEditBook(b.id)}>
                  Edit
                </Button>
              </div>
            ))}
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
          {/* Tombol atur admin — hanya untuk super_admin */}
          {profile?.role === "super_admin" &&
            editingBookId &&
            editingBookType !== "group" && (
              <div>
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
                  Atur Admin
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
        onClose={() => setOpenDeleteBookModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-sm text-slate-700">
            Hapus buku kas ini? Semua data di buku ini akan hilang.
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenDeleteBookModal(false)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (editingBookId) removeBook(editingBookId);
                setOpenDeleteBookModal(false);
                setOpenEditBook(false);
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
            Atur anggota lewat 2 tab supaya lebih cepat. User aktif akan
            otomatis tersimpan jika dicentang minimal di salah satu tab.
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMemberSettingsTab("kas")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                memberSettingsTab === "kas"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Setting Kas
            </button>
            <button
              type="button"
              onClick={() => setMemberSettingsTab("arisan")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                memberSettingsTab === "arisan"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Setting Arisan
            </button>
          </div>

          <div className="max-h-96 overflow-auto">
            {allProfiles.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Belum ada user terdaftar
              </div>
            ) : (
              <div className="grid gap-2">
                {allProfiles.map((profile) => {
                  const types = selectedMemberTypes[profile.id] ?? {
                    kas: true,
                    arisan: true,
                  };
                  const isChecked =
                    memberSettingsTab === "kas" ? types.kas : types.arisan;

                  return (
                    <label
                      key={profile.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          toggleMemberType(profile.id, memberSettingsTab)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900">
                          {profile.full_name}
                        </div>
                        <div className="mt-1 flex gap-1">
                          {types.kas ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              Kas
                            </span>
                          ) : null}
                          {types.arisan ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                              Arisan
                            </span>
                          ) : null}
                          {!types.kas && !types.arisan ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              Tidak aktif
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

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

      {/* Modal atur admin */}
      <Modal
        open={openPermissionModal}
        title="Atur Admin untuk Buku"
        onClose={() => setOpenPermissionModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-xs text-slate-500">
            Pilih admin yang boleh mengedit buku ini.
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
    </div>
  );
}
