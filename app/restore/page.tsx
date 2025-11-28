// app/restore/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseclient";

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

  // Date window (free plan: 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const todayStr = today.toISOString().slice(0, 10);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  // User & data
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Categories
  const [categories, setCategories] = useState<Category[]>([
    { name: "Rent / Mortgage", type: "expense" },
    { name: "Groceries", type: "expense" },
    { name: "Dining Out", type: "expense" },
    { name: "Transportation", type: "expense" },
    { name: "Utilities", type: "expense" },
    { name: "Debt Payments", type: "expense" },
    { name: "Subscriptions", type: "expense" },
    { name: "Salary / Wages", type: "income" },
    { name: "Side Income", type: "income" },
  ]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] =
    useState<TransactionType>("expense");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Inline category form
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit transaction
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);

  // Quick Add bar
  const [quickCategory, setQuickCategory] = useState<string>("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDate, setQuickDate] = useState("");
  const [quickDescription, setQuickDescription] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  // Simple budgets per category (local-only for now)
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({
    "Rent / Mortgage": 2000,
    Groceries: 400,
    "Dining Out": 200,
    Transportation: 250,
    Utilities: 300,
  });

  // Load user + transactions
  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        router.push("/login");
        return;
      }

      const user = userData.user;
      setUserEmail(user.email ?? null);
      setUserId(user.id);

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", thirtyDaysAgoStr)
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
  }, [router, thirtyDaysAgoStr]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ----- CATEGORY & ENTRY HANDLERS -----

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
    if (chosen < thirtyDaysAgo || chosen > today) {
      setErrorMessage("Free version: only last 30 days allowed.");
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
      .gte("date", thirtyDaysAgoStr)
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
    if (chosen < thirtyDaysAgo || chosen > today) {
      setErrorMessage("Free version: only last 30 days allowed.");
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
      .gte("date", thirtyDaysAgoStr)
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
    if (chosen < thirtyDaysAgo || chosen > today) {
      setErrorMessage("Free version: only last 30 days allowed.");
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
      .gte("date", thirtyDaysAgoStr)
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
      .gte("date", thirtyDaysAgoStr)
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

  // Defaults for dates & quick category
  useEffect(() => {
    if (!formDate) setFormDate(todayStr);
    if (!quickDate) setQuickDate(todayStr);
  }, [formDate, quickDate, todayStr]);

  useEffect(() => {
    if (!quickCategory && categories.length > 0) {
      setQuickCategory(categories[0].name);
    }
  }, [quickCategory, categories]);

  // Derived values
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

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-300">Loading your dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        {/* LEFT SIDEBAR */}
        <aside className="w-64 border-r border-slate-800 bg-slate-950/80 flex flex-col">
          <div className="px-4 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold tracking-wide">
              MoneyControl
            </h2>
            <p className="text-[11px] text-slate-400">
              See it. Measure it. Control it.
            </p>
          </div>

          <div className="flex-1 px-3 py-3 flex flex-col gap-3 text-xs overflow-y-auto">
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
                          setExpandedCategory(
                            isExpanded ? null : cat.name
                          );
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
                          onSubmit={(e) =>
                            handleAddCategoryEntry(e, cat.name)
                          }
                          className="px-3 pb-3 pt-2 border-t border-slate-800 space-y-2 text-[11px]"
                        >
                          <div className="text-[10px] text-slate-400 mb-1">
                            Add{" "}
                            {cat.type === "income"
                              ? "income"
                              : "expense"}{" "}
                            entry
                          </div>

                          <div>
                            <label className="block mb-1">Amount</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formAmount}
                              onChange={(e) =>
                                setFormAmount(e.target.value)
                              }
                              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5"
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block mb-1">
                              Date{" "}
                              <span className="text-[10px] text-slate-400">
                                (last 30 days)
                              </span>
                            </label>
                            <input
                              type="date"
                              min={thirtyDaysAgoStr}
                              max={todayStr}
                              value={formDate}
                              onChange={(e) =>
                                setFormDate(e.target.value)
                              }
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
                            {saving
                              ? "Saving..."
                              : `Add to "${cat.name}"`}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-1 text-[11px]">
              <label className="block text-slate-400 px-1">
                Add category
              </label>
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
                    setNewCategoryType(
                      e.target.value as TransactionType
                    )
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

            <div className="mt-auto pt-3 border-t border-slate-800">
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-900 text-slate-300 text-[11px]"
              >
                Settings
              </button>
            </div>
          </div>

          <div className="px-3 py-3 border-t border-slate-800 text-[11px] text-slate-400">
            <p>Free plan: last 30 days only.</p>
            <p className="mt-1 text-emerald-400">
              Pro: unlock 90 days & reports.
            </p>
          </div>
        </aside>

        {/* CENTER AREA */}
        <section className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/80">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Live money session</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-200">
              <button className="px-2 py-1 rounded-md border border-slate-700 bg-slate-900 text-[11px]">
                Dark / Light (soon)
              </button>
              {userEmail && (
                <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-700">
                  {userEmail}
                </span>
              )}
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
                min={thirtyDaysAgoStr}
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

          {/* MAIN GRID */}
          <div className="flex-1 grid grid-rows-[minmax(0,0.25fr),minmax(0,0.75fr)] gap-4 p-4">
            {/* SUMMARY */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-medium mb-1 text-slate-300">
                    Income (last 30 days)
                  </h2>
                  <p className="text-xl font-semibold">
                    {formatCurrency(income)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-medium mb-1 text-slate-300">
                    Expenses (last 30 days)
                  </h2>
                  <p className="text-xl font-semibold">
                    {formatCurrency(expenses)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-medium mb-1 text-slate-300">
                    Net (last 30 days)
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
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col min-h-0">
                <h2 className="text-sm font-medium mb-2">
                  Category entries (last 30 days)
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
                    for the last 30 days yet.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Entries for{" "}
                      <span className="font-semibold text-slate-200">
                        {selectedCategory}
                      </span>
                      :
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
                                (last 30 days)
                              </span>
                            </label>
                            <input
                              type="date"
                              min={thirtyDaysAgoStr}
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
                              {t.description
                                ? ` • ${t.description}`
                                : ""}
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

              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col min-h-0">
                <h2 className="text-sm font-medium mb-3">
                  All transactions (last 30 days)
                </h2>

                {transactions.length === 0 ? (
                  <p className="text-xs text-slate-300">
                    No transactions yet in the last 30 days.
                  </p>
                ) : (
                  <ul className="text-xs text-slate-200 space-y-2 overflow-auto pr-1 flex-1">
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
                            {t.description
                              ? ` • ${t.description}`
                              : ""}
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

        {/* RIGHT SIDEBAR – PRELIM REPORT + BUDGETS + PIE */}
        <aside className="w-72 border-l border-slate-800 bg-slate-950/80 flex flex-col">
          <div className="px-4 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold">Preliminary report</h2>
            <p className="text-[11px] text-slate-400">
              Snapshot of your last 30 days.
            </p>
          </div>

          <div className="flex-1 px-4 py-4 space-y-4 text-[11px] text-slate-300 overflow-auto">
            {/* Status card */}
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
                Based on your net result over the last 30 days:
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

            {/* Savings rate */}
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
                    expenses in the last 30 days.
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

            {/* Top expense categories */}
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
                    Biggest expense categories in the last 30 days:
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

            {/* Budgets */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
              <h3 className="font-medium mb-1 text-xs">Budgets (per month)</h3>
              <p className="text-slate-400 mb-2">
                Set a simple limit for your key categories. We&apos;ll show how
                much you&apos;ve used so far.
              </p>

              <div className="space-y-2 pr-1">
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

            {/* Coming soon */}
            <div className="bg-slate-900 rounded-lg border border-emerald-600/60 p-3">
              <h3 className="font-medium mb-1 text-xs text-emerald-300">
                Coming soon: 90-day Pro view
              </h3>
              <p>
                Upgrade will unlock a 90-day report, trends over time, and
                deeper breakdown by category type (fixed vs variable).
              </p>
            </div>

            {/* PIE CHART */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 flex flex-col items-center mt-2">
              <div className="text-[11px] text-slate-400 mb-2">
                Spending vs income (last 30 days)
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
                      ? `${Math.round(
                          Math.min(spendingRatio, 1) * 100
                        )}%`
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
