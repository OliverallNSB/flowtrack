// lib/userService.ts
import { supabase } from "./supabaseclient";

export type PlanType = "free" | "pro";

export type UserProfile = {
  id: string;
  email: string;
  plan: PlanType;
};

 export async function getUserProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, plan")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.warn(
      "No user profile found in 'users' table. Using default FREE profile.",
      error?.message
    );

    // Fallback: user exists in auth, but no profile row yet
    return {
      id: userId,
      email: "",      // we’ll still show plan correctly; email can be pulled from auth if needed
      plan: "free",
    };
  }

  return {
    id: data.id,
    email: data.email ?? "",
    plan: (data.plan as PlanType) ?? "free",
  };
}


export async function updateUserPlan(
  userId: string,
  plan: PlanType
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("users")
    .update({ plan })
    .eq("id", userId)
    .select("id, email, plan")
    .single();

  if (error) {
    console.error("Error updating user plan:", error.message);
    throw error;
  }

  return {
    id: data.id,
    email: data.email,
    plan: (data.plan as PlanType) ?? "free",
  };
}
