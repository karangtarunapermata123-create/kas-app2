import { NavLink, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { formatIDR } from "../lib/money";
import { getBooks, getBookStatsMap } from "../lib/store";
import type { Book } from "../lib/types";

export default function BookGroupPage() {
  const { groupId } = useParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookStats, setBookStats] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getBooks()
      .then(setBooks)
      .catch(console.error)
      .finally(() => setIsLoaded(true));
  }, []);

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

  const groupBook = useMemo(
    () => books.find((book) => book.id === groupId && book.type === "group"),
    [books, groupId],
  );

  const memberBooks = useMemo(
    () =>
      books.filter((book) => book.groupId === groupId && book.type !== "group"),
    [books, groupId],
  );

  if (!isLoaded) {
    return null;
  }

  if (!groupBook) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        Group buku kas tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Total saldo group
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
          {formatIDR(bookStats[groupBook.id] ?? 0)}
        </div>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {memberBooks.length} kas di dalam group ini
        </div>
      </div>

      {memberBooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Belum ada kas buku kas di dalam group ini.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {memberBooks.map((book) => {
            const href =
              book.type === "rutin"
                ? `/buku-kas-rutin/${book.id}`
                : book.type === "kolektif"
                  ? `/buku-kas-kolektif/${book.id}`
                  : `/buku-kas/${book.id}`;

            return (
              <NavLink key={book.id} to={href} className="block">
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                  <div className="min-h-[2.5rem] line-clamp-2 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                    {book.name}
                  </div>

                  <div className="mt-auto">
                    <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Saldo
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                      {formatIDR(bookStats[book.id] ?? 0)}
                    </div>
                  </div>
                </div>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
