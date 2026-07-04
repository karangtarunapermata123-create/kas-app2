import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, startAbsensiRealtime } from "./supabase";

export type UserRole = "super_admin" | "admin" | "member";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
};

// Helper functions untuk role-based access control
export function canManageBooks(role: UserRole | undefined): boolean {
  return role === "super_admin";
}

export function canManageUsers(role: UserRole | undefined): boolean {
  return role === "super_admin";
}

export function canEditAttendance(role: UserRole | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

export function canEditTransactions(role: UserRole | undefined): boolean {
  return role === "super_admin";
}

export function canEdit(role: UserRole | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

export function isReadOnly(role: UserRole | undefined): boolean {
  return role === "member" || !role;
}

/**
 * Cek apakah user bisa edit buku tertentu.
 * Super_admin bisa edit semua buku.
 * Admin bisa edit hanya buku yang di-assign.
 */
export async function canEditBook(
  profile: Profile | null,
  bookId: string,
): Promise<boolean> {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role === "admin") {
    const { getBookPermissions } = await import("./store");
    const allowedUserIds = await getBookPermissions(bookId);
    return allowedUserIds.includes(profile.id);
  }
  return false;
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error && data) {
      setProfile(data as Profile);
    }
  }

  useEffect(() => {
    // Ambil session awal
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
        startAbsensiRealtime();
      } else {
        setLoading(false);
      }
    });

    // Listen perubahan auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        startAbsensiRealtime();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(
    email: string,
    password: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function refreshProfile() {
    const userId = user?.id;
    if (userId) await fetchProfile(userId);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, refreshProfile, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
