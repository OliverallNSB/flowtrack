// app/dashboard/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseclient";
import { useAuth } from "@/app/context/AuthContext";

type TransactionType = "income" | "expense";

type Transaction = {
  id: string;
  user_id: string;
  created_at: string | null;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
};

type Category = {
  name: string;
  type: TransactionType;
};

// ---- DEFAULTS & STORAGE KEYS ----

const DEFAULT_CATEGORIES: Category[] = [
  { name: "Rent / Mortgage", type: "expense" },
  { name: "Groceries", type: "expense" },
  { name: "Dining Out", type: "expense" },
  { name: "Transportation", type: "expense" },
  { name: "Utilities", type: "expense" },
  { name: "Debt Payments", type: "expense" },
  { name: "Subscriptions", type: "expense" },
  { name: "Salary / Wages", type: "income" },
  { name: "Side Income", type: "income" },
];

const DEFAULT_CATEGORY_BUDGETS: Record<string, number> = {};

const CATEGORIES_STORAGE_KEY = "ft_categories_v1";
const BUDGETS_STORAGE_KEY = "ft_category_budgets_v1";

// ---- HELPERS ----

function summarize(transactions: Transaction[]) {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const net = income - expenses;
  return { income, expenses, net };
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getSpendingRatio(income: number, expenses: number) {
  if (income <= 0) return 1;
  const ratio = expenses / income;
  return Math.min(Math.max(ratio, 0), 2);
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const isPro = profile?.plan === "pro";

  // ---- TIME WINDOW (FREE vs PRO) ----
  const DAY_OPTIONS = isPro ? [7, 14, 30, 60, 90] : [7, 14, 30];
  const [windowDays, setWindowDays] = useState<number>(isPro ? 90 : 30);

  const today = new Date();
  const windowStart = new Date(today.getTime() - windowDays * 86400000);
  const todayStr = today.toISOString().slice(0, 10);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  // ---- USER & DATA STATE ----
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---- CATEGORY STATE (LEFT BAR) ----
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] =
    useState<TransactionType>("expense");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // ---- INLINE ENTRY FORM (LEFT BAR) ----
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- EDIT TRANSACTION (CENTER) ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);

  // ---- QUICK ADD BAR (CENTER TOP) ----
  const [quickCategory, setQuickCategory] = useState<string>("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDate, setQuickDate] = useState("");
  const [quickDescription, setQuickDescription] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  // ---- SIMPLE BUDGETS (RIGHT SIDEBAR, LOCAL ONLY FOR NOW) ----
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(
    {}
  );

  // Load budgets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ft-budgets");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setCategoryBudgets(parsed);
        }
      }
    } catch (err) {
      console.error("Error loading budgets:", err);
    }
  }, []);

  // Save budgets to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("ft-budgets", JSON.stringify(categoryBudgets));
    } catch (err) {
      console.error("Error saving budgets:", err);
    }
  }, [categoryBudgets]);

  // ---- LOAD / SAVE CATEGORIES & BUDGETS (LEFT BAR ORDER + BUDGETS) ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedCats = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (storedCats) {
        const parsed = JSON.parse(storedCats) as Category[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
        }
      }

      const storedBudgets = window.localStorage.getItem(BUDGETS_STORAGE_KEY);
      if (storedBudgets) {
        const parsedBudgets = JSON.parse(storedBudgets) as Record<
          string,
          number
        >;
        if (parsedBudgets && typeof parsedBudgets === "object") {
          setCategoryBudgets((prev) => ({
            ...prev,
            ...parsedBudgets,
          }));
        }
      }
    } catch {
      // ignore parsing errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        CATEGORIES_STORAGE_KEY,
        JSON.stringify(categories)
      );
    } catch {
      // ignore storage errors
    }
  }, [categories]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        BUDGETS_STORAGE_KEY,
        JSON.stringify(categoryBudgets)
      );
    } catch {
      // ignore storage errors
    }
  }, [categoryBudgets]);

  // ---- LOAD CATEGORY ORDER FROM SUPABASE ----
  useEffect(() => {
    if (!userId) return;

    async function loadCategoryOrder() {
      console.log("Loading category order for user:", userId);

      const { data, error } = await supabase
        .from("users")
        .select("category_order")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("Could not load category order:", error.message);
        // Fall back to defaults
        setCategories(DEFAULT_CATEGORIES);
        setCategoriesLoaded(true);
        return;
      }

      const saved = data?.category_order;

      if (Array.isArray(saved) && saved.length > 0) {
        console.log("Using saved category order from Supabase:", saved);
        const restored: Category[] = saved.map((item: any) => ({
          name: item.name,
          type: item.type as TransactionType,
        }));
        setCategories(restored);
        setCategoriesLoaded(true);
      } else {
        console.log("No saved category order; using defaults");
        setCategories(DEFAULT_CATEGORIES);
        setCategoriesLoaded(true);
      }
    }

    loadCategoryOrder();
  }, [userId]);

  // ---- SAVE CATEGORY ORDER TO SUPABASE ----
  useEffect(() => {
    if (!userId || !categoriesLoaded) {
      if (!categoriesLoaded) {
        console.log("Skip saving categories: not loaded from DB yet");
      }
      return;
    }

    console.log("Saving category order to Supabase:", categories);

    async function saveCategoryOrder() {
      const payload = categories.map((c) => ({
        name: c.name,
        type: c.type,
      }));

      const { error } = await supabase
        .from("users")
        .update({ category_order: payload })
        .eq("id", userId);

      if (error) {
        console.error("Error saving category order:", error.message);
      } else {
        console.log("Successfully saved category order!");
      }
    }

    saveCategoryOrder();
  }, [categories, userId, categoriesLoaded]);

  // ---- LOAD TRANSACTIONS FROM SUPABASE ----
  useEffect(() => {
    async function load() {
      if (authLoading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      setUserEmail(user.email ?? null);
      setUserId(user.id);

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", windowStartStr)
        .order("date", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setTransactions([]);
      } else {
        setTransactions((data ?? []) as Transaction[]);
      }

      setLoading(false);
    }

    load();
  }, [user, authLoading, router, windowStartStr]);

  // ---- LOGOUT ----
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ---- CATEGORY & ENTRY HANDLERS (LEFT BAR + CENTER) ----
  function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.some((c) => c.name === name)) {
      setNewCategoryName("");
      return;
    }
    setCategories((prev) => [...prev, { name, type: newCategoryType }]);
    setNewCategoryName("");
    setNewCategoryType("expense");
  }

  async function handleAddCategoryEntry(e: FormEvent, categoryName: string) {
    e.preventDefault();
    setErrorMessage(null);

    if (!userId) {
      setErrorMessage("You must be logged in to add entries.");
      return;
    }

    const cat = categories.find((c) => c.name === categoryName);
    if (!cat) {
      setErrorMessage("Category not found.");
      return;
    }

    if (!formAmount || !formDate) {
      setErrorMessage("Please fill amount and date.");
      return;
    }

    const amountNumber = Number(formAmount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      setErrorMessage("Amount must be a positive number.");
      return;
    }

    const chosen = new Date(formDate);
    if (chosen < windowStart || chosen > today) {
      setErrorMessage(`Only last ${windowDays} days are allowed for your plan.`);
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type: cat.type,
      amount: amountNumber,
      date: formDate,
      category: categoryName,
      description: formDescription || null,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    const { data, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", windowStartStr)
      .order("date", { ascending: false });

    if (txError) {
      setErrorMessage(txError.message);
    } else {
      setTransactions((data ?? []) as Transaction[]);
    }

    setSaving(false);
    setFormAmount("");
    setFormDescription("");
    setExpandedCategory(null);
  }

  async function handleQuickAdd(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!userId) {
      setErrorMessage("You must be logged in to add entries.");
      return;
    }

    const catName = quickCategory.trim();
    if (!catName) {
      setErrorMessage("Choose a category.");
      return;
    }

    const cat = categories.find((c) => c.name === catName);
    const type: TransactionType = cat ? cat.type : "expense";

    if (!quickAmount || !quickDate) {
      setErrorMessage("Please fill amount and date.");
      return;
    }

    const amountNumber = Number(quickAmount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      setErrorMessage("Amount must be a positive number.");
      return;
    }

    const chosen = new Date(quickDate);
    if (chosen < windowStart || chosen > today) {
      setErrorMessage(`Only last ${windowDays} days are allowed for your plan.`);
      return;
    }

    setQuickSaving(true);

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type,
      amount: amountNumber,
      date: quickDate,
      category: catName,
      description: quickDescription || null,
    });

    if (error) {
      setErrorMessage(error.message);
      setQuickSaving(false);
      return;
    }

    const { data, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", windowStartStr)
      .order("date", { ascending: false });

    if (txError) {
      setErrorMessage(txError.message);
    } else {
      setTransactions((data ?? []) as Transaction[]);
    }

    setQuickAmount("");
    setQuickDescription("");
    setQuickDate(todayStr);
    setQuickSaving(false);
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditAmount(String(t.amount));
    setEditDate(t.date);
    setEditDescription(t.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAmount("");
    setEditDate("");
    setEditDescription("");
    setEditingSaving(false);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!editingId || !userId) return;

    if (!editAmount || !editDate) {
      setErrorMessage("Please fill amount and date.");
      return;
    }

    const amountNumber = Number(editAmount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      setErrorMessage("Amount must be a positive number.");
      return;
    }

    const chosen = new Date(editDate);
    if (chosen < windowStart || chosen > today) {
      setErrorMessage(`Only last ${windowDays} days are allowed for your plan.`);
      return;
    }

    setEditingSaving(true);

    const { error } = await supabase
      .from("transactions")
      .update({
        amount: amountNumber,
        date: editDate,
        description: editDescription || null,
      })
      .eq("id", editingId)
      .eq("user_id", userId);

    if (error) {
      setErrorMessage(error.message);
      setEditingSaving(false);
      return;
    }

    const { data, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", windowStartStr)
      .order("date", { ascending: false });

    if (txError) {
      setErrorMessage(txError.message);
    } else {
      setTransactions((data ?? []) as Transaction[]);
    }

    setEditingSaving(false);
    cancelEdit();
  }

  async function handleDeleteTransaction(id: string) {
    setErrorMessage(null);

    if (!userId) {
      setErrorMessage("You must be logged in to delete entries.");
      return;
    }

    const ok = window.confirm("Delete this entry? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const { data, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", windowStartStr)
      .order("date", { ascending: false });

    if (txError) {
      setErrorMessage(txError.message);
    } else {
      setTransactions((data ?? []) as Transaction[]);
    }
  }

  function handleDeleteCategory(name: string) {
    const ok = window.confirm(
      `Delete category "${name}"? Transactions stay in history.`
    );
    if (!ok) return;

    setCategories((prev) => prev.filter((c) => c.name !== name));
    if (selectedCategory === name) setSelectedCategory(null);
    if (expandedCategory === name) setExpandedCategory(null);
  }

  function moveCategory(name: string, direction: "up" | "down") {
    setCategories((prev) => {
      const index = prev.findIndex((c) => c.name === name);
      if (index === -1) return prev;
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(newIndex, 0, item);
      return copy;
    });
  }

  // ---- DEFAULT DATES & QUICK CATEGORY ----
  useEffect(() => {
    if (!formDate) setFormDate(todayStr);
    if (!quickDate) setQuickDate(todayStr);
  }, [formDate, quickDate, todayStr]);

  useEffect(() => {
    if (!quickCategory && categories.length > 0) {
      setQuickCategory(categories[0].name);
    }
  }, [quickCategory, categories]);

  // ---- DERIVED VALUES ----
  const { income, expenses, net } = summarize(transactions);

  let status: "OK" | "WARNING" | "DANGER" = "OK";
  if (net < 0) status = "DANGER";
  else if (net < 300) status = "WARNING";

  const spendingRatio = getSpendingRatio(income, expenses);
  const spentPct = Math.min(spendingRatio, 1) * 100;
  const remainingPct = 100 - spentPct;

  const categoryTransactions = selectedCategory
    ? transactions.filter((t) => t.category === selectedCategory)
    : [];

  const categoryTotal = categoryTransactions.reduce(
    (sum, t) =>
      sum +
      (t.type === "expense" ? -Number(t.amount) : Number(t.amount)),
    0
  );

  const savingsRate = income > 0 ? Math.round((net / income) * 100) : null;

  const expenseByCategory = transactions.reduce(
    (acc, t) => {
      if (t.type === "expense") {
        acc[t.category] = (acc[t.category] ?? 0) + Number(t.amount);
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const topCategories = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // ---- LOADING / REDIRECT ----
  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-300">Loading your dashboard...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-300">Redirecting to login...</p>
      </main>
    );
  }

  // ---- MAIN LAYOUT ----
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        {/* ========================= */}
        {/* LEFT SIDEBAR             */}
        {/* ========================= */}
        <aside className="w-64 border-r border-slate-800 bg-slate-950/80 flex flex-col">
          <div className="px-4 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold tracking-wide">FlowTrack</h2>
            <p className="text-[11px] text-slate-400">
              See it. Measure it. Control it.
            </p>
          </div>

          <div className="flex-1 px-3 py-3 flex flex-col gap-3 text-xs overflow-y-auto">
            {/* CATEGORIES LIST */}
            <div>
              <div className="text-slate-400 uppercase text-[10px] px-1 mb-1">
                Categories
              </div>

              <div className="space-y-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.name;
                  const isExpanded = expandedCategory === cat.name;
                  const typeColor =
                    cat.type === "income"
                      ? "text-emerald-300"
                      : "text-red-300";

                  return (
                    <div
                      key={cat.name}
                      className={`rounded-lg border ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-600/10"
                          : "border-slate-800 bg-slate-900"
                      }`}
                    >
                      <div
                        className={`group w-full flex items-center justify-between px-3 py-1.5 text-[11px] rounded-t-lg cursor-pointer ${
                          isSelected
                            ? "text-emerald-200"
                            : "text-slate-200 hover:bg-slate-800"
                        }`}
                        onClick={() => {
                          setSelectedCategory(cat.name);
                          setExpandedCategory(isExpanded ? null : cat.name);
                        }}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{cat.name}</span>
                          <span
                            className={`text-[9px] uppercase tracking-wide ${typeColor}`}
                          >
                            {cat.type === "income" ? "Income" : "Expense"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveCategory(cat.name, "up");
                            }}
                            className="text-slate-500 hover:text-slate-200 text-[10px]"
                            aria-label={`Move ${cat.name} up`}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveCategory(cat.name, "down");
                            }}
                            className="text-slate-500 hover:text-slate-200 text-[10px]"
                            aria-label={`Move ${cat.name} down`}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat.name);
                            }}
                            className="ml-1 text-slate-500 hover:text-red-400 text-[10px]"
                            aria-label={`Delete category ${cat.name}`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <form
                          onSubmit={(e) => handleAddCategoryEntry(e, cat.name)}
                          className="px-3 pb-3 pt-2 border-t border-slate-800 space-y-2 text-[11px]"
                        >
                          <div className="text-[10px] text-slate-400 mb-1">
                            Add{" "}
                            {cat.type === "income" ? "income" : "expense"} entry
                          </div>

                          <div>
                            <label className="block mb-1">Amount</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formAmount}
                              onChange={(e) => setFormAmount(e.target.value)}
                              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block mb-1">
                              Date{" "}
                              <span className="text-[10px] text-slate-400">
                                (last {windowDays} days)
                              </span>
                            </label>
                            <input
                              type="date"
                              min={windowStartStr}
                              max={todayStr}
                              value={formDate}
                              onChange={(e) => setFormDate(e.target.value)}
                              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                            />
                          </div>

                          <div>
                            <label className="block mb-1">
                              Description (optional)
                            </label>
                            <input
                              type="text"
                              value={formDescription}
                              onChange={(e) =>
                                setFormDescription(e.target.value)
                              }
                              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                              placeholder="Short note..."
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={saving}
                            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed py-1.5 text-[11px] font-medium mt-1"
                          >
                            {saving ? "Saving..." : `Add to "${cat.name}"`}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ADD CATEGORY FORM */}
            <form
              onSubmit={handleAddCategory}
              className="space-y-1 text-[11px]"
            >
              <label className="block text-slate-400 px-1">Add category</label>
              <div className="flex flex-wrap gap-1">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 min-w-0 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1"
                  placeholder="e.g. Pets, Gym..."
                />
                <select
                  className="w-[90px] rounded-lg bg-slate-950 border border-slate-700 px-2 py-1"
                  value={newCategoryType}
                  onChange={(e) =>
                    setNewCategoryType(e.target.value as TransactionType)
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
                <button
                  type="submit"
                  className="px-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[11px] font-medium"
                >
                  +
                </button>
              </div>
              <p className="text-[10px] text-slate-500 px-1">
                Each category is either Income or Expense.
              </p>
            </form>

            {/* LEFT SIDEBAR FOOTER */}
            <div className="mt-auto pt-3 border-t border-slate-800">
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-900 text-slate-300 text-[11px]"
              >
                Settings
              </button>
            </div>
          </div>

          {/* LEFT SIDEBAR PLAN LABEL */}
          <div className="px-3 py-3 border-t border-slate-800 text-[11px] text-slate-400">
            <p>
              Plan:{" "}
              <span className={isPro ? "text-amber-300 font-semibold" : ""}>
                {isPro ? "Pro" : "Free"}
              </span>
            </p>
            <p className="mt-1 text-emerald-400">
              {isPro
                ? "Pro: tracking the last 90 days. Reports coming soon."
                : "Free: tracking the last 30 days. Upgrade to Pro for 90 days & reports."}
            </p>
          </div>
        </aside>

        {/* ========================= */}
        {/* CENTER AREA               */}
        {/* ========================= */}
        <section className="flex-1 flex flex-col">
          {/* TOP HORIZONTAL BAR / HEADER */}
          <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/80 mb-3">
            {/* Left side */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Live money session</span>
            </div>

            {/* Right side: Plan badge + Time + Dark mode + User + Logout */}
            <div className="flex items-center gap-3 text-xs text-slate-200">
              {/* Plan badge */}
              <span
                className={
                  isPro
                    ? "px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500 text-[11px] uppercase tracking-wide text-emerald-300"
                    : "px-2 py-1 rounded-full bg-slate-800 border border-slate-600 text-[11px] uppercase tracking-wide text-slate-300"
                }
              >
                {isPro ? "PRO" : "FREE"}
              </span>

              {/* Time selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Time:</span>
                <select
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs"
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                >
                  {DAY_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      Last {days} days
                    </option>
                  ))}
                </select>
              </div>

              {/* Dark Mode (placeholder) */}
              <button
                className="px-3 py-1 rounded-full border border-slate-600 text-xs text-slate-300 cursor-not-allowed opacity-60"
                disabled
              >
                Dark mode
              </button>

              {/* Logged in user */}
              {userEmail && (
                <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-700">
                  Welcome,&nbsp;
                  <span className="font-semibold text-slate-50">
                    {userEmail}
                  </span>
                </span>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-500 text-[11px] font-medium"
              >
                Log out
              </button>
            </div>
          </header>

          {/* QUICK ADD BAR */}
          <div className="border-b border-slate-900 bg-slate-950/80 px-4 py-2 text-[11px]">
            <form
              onSubmit={handleQuickAdd}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-slate-400 mr-2">Quick add:</span>

              <select
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                value={quickCategory}
                onChange={(e) => setQuickCategory(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.type === "income" ? "Income" : "Expense"})
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="0"
                step="0.01"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                className="w-24 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                placeholder="Amount"
              />

              <input
                type="date"
                min={windowStartStr}
                max={todayStr}
                value={quickDate}
                onChange={(e) => setQuickDate(e.target.value)}
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
              />

              <input
                type="text"
                value={quickDescription}
                onChange={(e) => setQuickDescription(e.target.value)}
                className="flex-1 min-w-[120px] rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                placeholder="Optional note"
              />

              <button
                type="submit"
                disabled={quickSaving}
                className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-3 py-1 text-[11px] font-medium"
              >
                {quickSaving ? "Adding..." : "Add"}
              </button>
            </form>
          </div>

          {/* ========================= */}
          {/* MAIN GRID (SUMMARY + LISTS) */}
          {/* ========================= */}
          <div className="flex-1 grid grid-rows-[minmax(0,0.25fr),minmax(0,0.75fr)] gap-4 p-4">
            {/* SUMMARY: INCOME / EXPENSES / NET */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-medium mb-1 text-slate-300">
                    Income {windowDays}
                  </h2>
                  <p className="text-xl font-semibold">
                    {formatCurrency(income)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-medium mb-1 text-slate-300">
                    Expenses {windowDays}
                  </h2>
                  <p className="text-xl font-semibold">
                    {formatCurrency(expenses)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-medium mb-1 text-slate-300">
                    Net {windowDays}
                  </h2>
                  <p className="text-xl font-semibold">
                    {formatCurrency(net)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Status:{" "}
                    <span
                      className={
                        status === "OK"
                          ? "text-emerald-400"
                          : status === "WARNING"
                          ? "text-amber-300"
                          : "text-red-400"
                      }
                    >
                      {status}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* BOTTOM: CATEGORY ENTRIES + ALL TRANSACTIONS */}
            <div className="grid md:grid-cols-2 gap-4 min-h-0">
              {/* CATEGORY ENTRIES CARD */}
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col min-h-0">
                <h2 className="text-sm font-medium mb-2">
                  Category Entries {windowDays}
                </h2>

                {errorMessage && (
                  <div className="mb-3 bg-red-500/10 border border-red-500 text-red-200 text-[11px] rounded-lg px-3 py-2">
                    {errorMessage}
                  </div>
                )}

                {!selectedCategory ? (
                  <p className="text-[11px] text-slate-400">
                    Select a category on the left and use its inline form or
                    Quick Add to add entries.
                  </p>
                ) : categoryTransactions.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No entries in{" "}
                    <span className="font-semibold text-slate-200">
                      {selectedCategory}
                    </span>{" "}
                    for the last {windowDays} days yet.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-400">
                      Entries for{" "}
                      <span className="font-semibold text-slate-200">
                        {selectedCategory}
                      </span>
                      :
                    </p>

                    {/* CATEGORY TOTAL LINE */}
                    <p className="text-[11px] mt-1 mb-3">
                      Total:{" "}
                      <span
                        className={
                          categoryTotal < 0
                            ? "text-red-300 font-semibold"
                            : "text-emerald-300 font-semibold"
                        }
                      >
                        {categoryTotal < 0 ? "-$" : "$"}
                        {Math.abs(categoryTotal).toFixed(2)}
                      </span>
                    </p>

                    {editingId && (
                      <form
                        onSubmit={handleSaveEdit}
                        className="mb-3 p-2 rounded-lg border border-slate-700 bg-slate-950 space-y-2 text-[11px]"
                      >
                        <div className="text-[10px] text-slate-400">
                          Editing entry
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block mb-1">Amount</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) =>
                                setEditAmount(e.target.value)
                              }
                              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block mb-1">
                              Date{" "}
                              <span className="text-[10px] text-slate-400">
                                (last {windowDays} days)
                              </span>
                            </label>
                            <input
                              type="date"
                              min={windowStartStr}
                              max={todayStr}
                              value={editDate}
                              onChange={(e) =>
                                setEditDate(e.target.value)
                              }
                              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block mb-1">
                            Description (optional)
                          </label>
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) =>
                              setEditDescription(e.target.value)
                            }
                            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5"
                          />
                        </div>

                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 text-[11px]"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editingSaving}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-[11px] font-medium"
                          >
                            {editingSaving ? "Saving..." : "Save changes"}
                          </button>
                        </div>
                      </form>
                    )}

                    <ul className="text-xs text-slate-200 space-y-2 overflow-auto pr-1 flex-1">
                      {categoryTransactions.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between border-b border-slate-800/80 pb-1"
                        >
                          <div>
                            <div className="font-medium">
                              {t.type === "income" ? "+" : "-"}
                              {formatCurrency(Number(t.amount))}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {t.date}
                              {t.description ? ` • ${t.description}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="px-2 py-1 rounded-md border border-slate-600 text-[10px] text-slate-200 hover:bg-slate-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteTransaction(t.id)
                              }
                              className="px-2 py-1 rounded-md border border-red-500/70 text-[10px] text-red-300 hover:bg-red-500/20"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* ALL TRANSACTIONS CARD */}
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col min-h-0">
                <h2 className="text-sm font-medium mb-3">
                  All transactions {windowDays}
                </h2>

                {transactions.length === 0 ? (
                  <p className="text-xs text-slate-300">
                    No transactions yet in the last {windowDays} days.
                  </p>
                ) : (
                  <ul className="text-xs text-slate-200 space-y-2 overflow-auto pr-1 flex-1 transactions-scroll">
                    {transactions.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between border-b border-slate-800/80 pb-1"
                      >
                        <div>
                          <div className="font-medium">
                            {t.type === "income" ? "+" : "-"}
                            {formatCurrency(Number(t.amount))}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {t.category} • {t.date}
                            {t.description ? ` • ${t.description}` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(t.id)}
                          className="ml-2 px-2 py-1 rounded-md border border-red-500/70 text-[10px] text-red-300 hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================= */}
        {/* RIGHT SIDEBAR             */}
        {/* ========================= */}
        <aside className="w-72 border-l border-slate-800 bg-slate-950/80 flex flex-col">
          <div className="px-4 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold">Preliminary report</h2>
            <p className="text-[11px] text-slate-400">
              Snapshot of your {windowDays}.
            </p>
          </div>

          <div className="flex-1 px-4 py-4 space-y-4 text-[11px] text-slate-300 overflow-auto">
            {/* OVERALL STATUS CARD */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
              <h3 className="font-medium mb-1 text-xs">Overall status</h3>
              <p>
                Your current status is{" "}
                <span
                  className={
                    status === "OK"
                      ? "text-emerald-400"
                      : status === "WARNING"
                      ? "text-amber-300"
                      : "text-red-400"
                  }
                >
                  {status}
                </span>
                .
              </p>
              <p className="mt-1 text-slate-400">
                Based on your net result over the {windowDays}:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1 text-slate-400">
                <li>Income: {formatCurrency(income)}</li>
                <li>Spending: {formatCurrency(expenses)}</li>
                <li>
                  Net:{" "}
                  <span
                    className={
                      net >= 0
                        ? "text-emerald-400 font-semibold"
                        : "text-red-400 font-semibold"
                    }
                  >
                    {formatCurrency(net)}
                  </span>
                </li>
              </ul>
            </div>

            {/* SAVINGS RATE CARD */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
              <h3 className="font-medium mb-1 text-xs">Savings rate</h3>
              {savingsRate === null ? (
                <p className="text-slate-400">
                  We couldn&apos;t calculate a savings rate yet. Add at least
                  one income and one expense entry.
                </p>
              ) : (
                <>
                  <p className="text-lg font-semibold mb-1">
                    {savingsRate}%
                  </p>

                  <p className="text-slate-400">
                    This is how much of your income you&apos;re keeping after
                    expenses in the last {windowDays} days.
                  </p>

                  <p className="mt-1 text-slate-400">
                    A simple reference for many young professionals is{" "}
                    <span className="text-emerald-300 font-medium">
                      10–20% saved
                    </span>
                    . This is not financial advice, just a reference point.
                  </p>
                </>
              )}
            </div>

            {/* TOP EXPENSE CATEGORIES CARD */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
              <h3 className="font-medium mb-1 text-xs">
                Where your money actually goes
              </h3>

              {topCategories.length === 0 ? (
                <p className="text-slate-400">
                  You haven&apos;t added any expenses yet. As you log spending,
                  we&apos;ll show your top categories here.
                </p>
              ) : (
                <>
                  <p className="text-slate-400 mb-2">
                    Biggest expense categories in the last {windowDays} days:
                  </p>
                  <ul className="space-y-1">
                    {topCategories.map(([catName, amount]) => (
                      <li
                        key={catName}
                        className="flex items-center justify-between"
                      >
                        <span className="truncate pr-2">{catName}</span>
                        <span className="font-medium">
                          {formatCurrency(amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-slate-400">
                    These are usually the best places to look first if you want
                    to free up money.
                  </p>
                </>
              )}
            </div>

            {/* BUDGET CARD */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
              <h3 className="font-medium mb-1 text-xs">Budgets (Monthly)</h3>
              <p className="text-slate-400 mb-2">
                Set a simple limit for your key categories. We&apos;ll show how
                much you&apos;ve used so far.
              </p>

              {/* Limited height so this area doesn't grow forever */}
              <div className="space-y-2 pr-1 max-h-56 overflow-y-auto budget-scroll">
                {categories.map((cat) => {
                  const budget = categoryBudgets[cat.name] ?? 0;
                  const spent = expenseByCategory[cat.name] ?? 0;
                  const pct =
                    budget > 0
                      ? Math.min(100, Math.round((spent / budget) * 100))
                      : 0;

                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="truncate pr-2">{cat.name}</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={budget ? String(budget) : ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const num = val === "" ? 0 : Number(val);
                            setCategoryBudgets((prev) => ({
                              ...prev,
                              [cat.name]: Number.isNaN(num) ? 0 : num,
                            }));
                          }}
                          className="w-20 rounded-md bg-slate-950 border border-slate-700 px-1 py-0.5 text-right text-[10px]"
                          placeholder="Budget"
                        />
                      </div>

                      {budget > 0 && (
                        <>
                          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full ${
                                pct < 80
                                  ? "bg-emerald-500"
                                  : pct < 100
                                  ? "bg-amber-400"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>
                              {formatCurrency(spent)} /{" "}
                              {formatCurrency(budget)}
                            </span>
                            <span>{pct}% used</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="mt-2 text-[10px] text-slate-500">
                Tip: Start with just 3–5 key categories. Too many budgets =
                overwhelm.
              </p>
            </div>

            {/* PRO PLAN STATUS CARD */}
            <div className="bg-slate-900 rounded-lg border border-emerald-600/60 p-3">
              <h3 className="font-medium mb-1 text-xs text-emerald-300">
                {isPro ? "Pro plan active" : "Free plan"}
              </h3>

              {isPro ? (
                <>
                  <p className="text-slate-300">
                    You&apos;re currently using the{" "}
                    <span className="font-semibold text-amber-300">Pro</span>{" "}
                    plan.
                  </p>
                  <p className="mt-1 text-slate-400">
                    Tracking the last{" "}
                    <span className="font-semibold text-emerald-300">
                      {windowDays} days
                    </span>{" "}
                    of activity with advanced dashboards.
                  </p>
                  <p className="mt-1 text-slate-500">
                    More Pro features like reports and trends will appear here
                    as we build them.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-300">
                    You&apos;re currently on the{" "}
                    <span className="font-semibold">Free</span> plan.
                  </p>
                  <p className="mt-1 text-slate-400">
                    Free tracks the last{" "}
                    <span className="font-semibold">{windowDays} days</span>{" "}
                    only.
                  </p>
                  <p className="mt-1 text-slate-500">
                    Upgrade to Pro to unlock a longer history window and richer
                    insights here.
                  </p>
                </>
              )}
            </div>

            {/* PIE CHART CARD */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 flex flex-col items-center mt-2">
              <div className="text-[11px] text-slate-400 mb-2">
                Spending vs income {windowDays}
              </div>

              <div className="relative flex items-center justify-center mb-3">
                <svg viewBox="0 0 36 36" className="w-24 h-24">
                  {/* Green ring = total income */}
                  <circle
                    className="text-emerald-500"
                    stroke="currentColor"
                    strokeWidth="7"
                    fill="none"
                    cx="18"
                    cy="18"
                    r="15.915"
                  />
                  {/* Red slice = spending portion */}
                  <circle
                    className="text-red-400"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="butt"
                    fill="none"
                    cx="18"
                    cy="18"
                    r="15.915"
                    strokeDasharray={`${spentPct} ${remainingPct}`}
                    transform="rotate(-90 18 18)"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-xs font-semibold">
                    {income > 0
                      ? `${Math.round(Math.min(spendingRatio, 1) * 100)}%`
                      : "--"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    of income used
                  </div>
                </div>
              </div>

              <div className="w-full flex justify-between text-[11px] mb-2">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Income</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span>Spending</span>
                </div>
              </div>

              <div className="w-full text-[11px] text-slate-300 space-y-1">
                <p>
                  Income:{" "}
                  <span className="font-semibold">
                    {formatCurrency(income)}
                  </span>
                </p>
                <p>
                  Spending:{" "}
                  <span className="font-semibold">
                    {formatCurrency(expenses)}
                  </span>
                </p>
                <p>
                  Net:{" "}
                  <span
                    className={
                      net >= 0
                        ? "text-emerald-400 font-semibold"
                        : "text-red-400 font-semibold"
                    }
                  >
                    {formatCurrency(net)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
