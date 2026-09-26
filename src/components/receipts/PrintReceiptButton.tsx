"use client";

import { useState } from "react";

/**
 * Ported from the inline <script> on app/pages/receipts/receipt-preview.php.
 * Behavior matches exactly: clicking records the print (increments
 * print_count server-side, writes an audit log) BEFORE opening the browser
 * print dialog, and the label reflects the updated count on success. No
 * CSRF token, consistent with the CSRF-drop decision already made for this
 * codebase (docs/status.md deviation #3).
 */
export function PrintReceiptButton({
  receiptId,
  initialPrintCount,
}: {
  receiptId: number;
  initialPrintCount: number;
}) {
  const [printCount, setPrintCount] = useState(initialPrintCount);
  const [label, setLabel] = useState(
    initialPrintCount > 0 ? `Print Receipt · Count ${initialPrintCount}` : "Print Receipt",
  );
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setLabel("Preparing Print...");
    try {
      const res = await fetch(`/api/receipts/${receiptId}/print`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "The print could not be recorded.");
      }
      setPrintCount(data.printCount);
      setLabel(`Print Receipt · Count ${data.printCount}`);
      window.print();
    } catch (err) {
      alert(err instanceof Error ? err.message : "The receipt print could not be recorded.");
      setLabel(printCount > 0 ? `Print Receipt · Count ${printCount}` : "Print Receipt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className="btn-primary">
      {label}
    </button>
  );
}
