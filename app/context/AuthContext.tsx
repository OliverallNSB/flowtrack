// app/context/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseclient";

type SimpleUser = {
  id: string;
  email: string | null;
} | null;

type Profile = {
  id: string;
  email: string | null;
  plan: "free" | "pro";
} | null;

type AuthContextType = {
  user: SimpleUser;
  profile: Profile;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimpleUser>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      try {
        // 1) Get Supabase session
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          console.error("Error getting session:", error.message);
          setUser(null);
          setProfile(null);
          return;
        }

        const supaUser = data.session?.user ?? null;

        if (!supaUser) {
          setUser(null);
          setProfile(null);
          return;
        }

        const simpleUser: SimpleUser = {
          id: supaUser.id,
          email: supaUser.email ?? null,
        };

        setUser(simpleUser);

        // 2) Look up plan in public.users by email
        let plan: "free" | "pro" = "free";
        let profileEmail: string | null = supaUser.email ?? null;
        let profileId: string = supaUser.id;

        if (supaUser.email) {
          const { data: userRow, error: userError } = await supabase
            .from("users")
            .select("id, email, plan")
            .eq("email", supaUser.email)
            .maybeSingle();

          if (!cancelled) {
            if (userError) {
              console.warn("Could not load plan from users table:", userError.message);
            } else if (userRow) {
              profileId = userRow.id ?? supaUser.id;
              profileEmail = userRow.email ?? supaUser.email;
              if (
                typeof userRow.plan === "string" &&
                userRow.plan.toLowerCase() === "pro"
              ) {
                plan = "pro";
              }
            }
          }
        }

        if (!cancelled) {
          setProfile({
            id: profileId,
            email: profileEmail,
            plan,
          });
        }
      } catch (err) {
        console.error("Unexpected auth error:", err);
        if (!cancelled) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
