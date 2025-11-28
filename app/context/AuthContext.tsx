"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import type { User } from "@supabase/supabase-js";

type AppUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
  created_at?: string;
};

type AuthContextValue = {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (authUser: User | null) => {
  if (!authUser) {
    setProfile(null);
    return;
  }

  // 1) Try to load existing row from "users"
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle(); // allows 0 or 1 row without throwing

  if (error) {
    console.error("Error loading user profile:", error);
    setProfile(null);
    return;
  }

  // 2) If no row exists yet, create a default one (plan = "free")
  if (!data) {
    const insertPayload = {
      id: authUser.id,
      email: authUser.email,
      plan: "free" as const,
    };

    const { data: created, error: insertError } = await supabase
      .from("users")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating user profile:", insertError);
      setProfile(null);
      return;
    }

    setProfile(created as AppUser);
    return;
  }

  // 3) Existing row found
  setProfile(data as AppUser);
};


  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // Load auth session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authUser = session?.user ?? null;
      setUser(authUser);

      // Load the user row from "users"
      await loadUserProfile(authUser);

      setLoading(false);
    };

    init();

    // Listen for login/logout changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      loadUserProfile(authUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
