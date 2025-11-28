// lib/csv.ts

// Adjust this type to match your actual transaction shape if you want stronger typing
export type Transaction = {
  id?: number | string;
  date: string;          // e.g. "2025-11-27" or ISO string
  category?: string;
  description?: string;
  type?: string;         // "income" | "expense"
  amount: number;
};

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If the value contains comma, quote, or newline, wrap it in quotes and escape quotes
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  filename = "transactions.csv"
) {
  if (!transactions || transactions.length === 0) {
    alert("No transactions to export.");
    return;
  }

  // 👉 Adjust these headers + fields to match your DB columns
  const headers = ["Date", "Category", "Description", "Type", "Amount"];

  const rows = transactions.map((t) => [
    t.date,
    t.category ?? "",
    t.description ?? "",
    t.type ?? "",
    t.amount,
  ]);

  const csvLines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];

  const csvContent = csvLines.join("\r\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
