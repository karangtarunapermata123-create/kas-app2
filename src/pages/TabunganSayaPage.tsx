import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getUserKolektifSessions, getKolektifConfig, getBooks } from "../lib/store";
import { formatIDR } from "../lib/money";
import type { KolektifSession, Book } from "../lib/types";

export default function TabunganSayaPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<KolektifSession[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [sessionTotals, setSessionTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile) return;
      try {
        const [sessionsData, booksData] = await Promise.all([
          getUserKolektifSessions(profile.id),
          getBooks(),
        ]);
        setSessions(sessionsData);
        setBooks(booksData);

        // Jika hanya ada satu sub-buku, langsung navigasi ke halaman detailnya
        if (sessionsData.length === 1) {
          navigate(`/buku-kas-kolektif/${sessionsData[0].bookId}/sesi/${sessionsData[0].id}`, { state: { fromTabunganSaya: true } });
          return;
        }

        // Hitung total untuk setiap session
        const totals: Record<string, number> = {};
        await Promise.all(
          sessionsData.map(async (session) => {
            const config = await getKolektifConfig(session.id);
            totals[session.id] = config.rows.reduce((sum, row) => {
              let rowTotal = row.amount;
              if (config.headerLabelType === "number") rowTotal += (row.headerValue ?? (Number(row.label) || 0));
              if (config.noteLabelType === "number") rowTotal += (row.noteValue ?? (Number(row.note) || 0));
              for (const col of config.extraColumns) {
                if (col.columnType === "number") {
                  const extraVal = row.extraValues?.[col.id];
                  let val: number = 0;
                  if (typeof extraVal === "string") {
                    val = Number(extraVal);
                  } else if (extraVal && typeof extraVal === "object") {
                    val = Number(extraVal.value);
                  }
                  rowTotal += Number.isFinite(val) ? val : 0;
                }
              }
              return sum + rowTotal;
            }, 0);
          })
        );
        setSessionTotals(totals);
      } catch (e) {
        console.error("Gagal memuat data tabungan:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <svg
          className="animate-spin h-6 w-6 mr-2"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Memuat...
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Tabungan Saya</h1>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-6 py-12 text-center text-sm text-slate-400">
          Belum ada tabungan.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {sessions.map((session) => {
            const book = books.find((b) => b.id === session.bookId);
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => navigate(`/buku-kas-kolektif/${session.bookId}/sesi/${session.id}`, { state: { fromTabunganSaya: true } })}
                className="w-full flex items-center justify-between gap-3 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b last:border-b-0 border-slate-100 dark:border-slate-700"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white truncate">
                    {session.name}
                  </div>
                  {book && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {book.name}
                    </div>
                  )}
                </div>
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                  {formatIDR(sessionTotals[session.id] ?? 0)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
