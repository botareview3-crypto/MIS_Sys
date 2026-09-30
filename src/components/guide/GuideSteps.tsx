"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type GuideStep = {
  /**
   * Stable id used by the in-app editor (add/delete). Built-in steps get
   * "d1", "d2", ... from their position; steps added in the app get "n...".
   * Optional so guide-content.ts doesn't have to spell them out.
   */
  id?: string;
  title: string;
  description: string;
  /**
   * Group this step belongs to (e.g. "Configuration", "Cisco", "SAP",
   * "Applications to be installed"). Optional - a guide whose steps have no
   * category just shows a flat list with search, same as before.
   */
  category?: string;
  /**
   * Path under /public (e.g. "/guide/local-step-1.png"), an uploaded photo
   * ("/api/guide/images/12") or a full URL. Optional - a step with no image
   * just shows title + description.
   */
  image?: string;
  /** Alt text for the image. Falls back to the step title if omitted. */
  imageAlt?: string;
  /**
   * Optional additional images shown under `image` (same path rules). Used
   * when one step needs more than one photo. Alt text is the step title.
   */
  images?: string[];
};

// Static class strings so Tailwind can see them. Unknown categories fall back
// to the neutral style.
const CATEGORY_STYLES: Record<string, { chip: string; badge: string; dot: string }> = {
  Configuration: {
    chip: "border-brand-200 bg-brand-50 text-brand-700",
    badge: "bg-brand-50 text-brand-700",
    dot: "bg-brand-500",
  },
  Cisco: {
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
    badge: "bg-cyan-50 text-cyan-700",
    dot: "bg-pop-cyan",
  },
  SAP: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-pop-amber",
  },
  "Applications to be installed": {
    chip: "border-pink-200 bg-pink-50 text-pink-700",
    badge: "bg-pink-50 text-pink-700",
    dot: "bg-pop-pink",
  },
};
const FALLBACK_STYLE = {
  chip: "border-stone-200 bg-stone-50 text-stone-700",
  badge: "bg-stone-100 text-stone-600",
  dot: "bg-stone-400",
};
const styleFor = (category: string) => CATEGORY_STYLES[category] ?? FALLBACK_STYLE;

type Numbered = { step: GuideStep; number: number };

type NewStepInput = {
  title: string;
  description: string;
  category: string;
  file: File | null;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps every occurrence of any search term in <mark>. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * Phone photos are several MB; shrink to at most 1200px on the long side as
 * JPEG before uploading. Throws if the browser can't decode the file (e.g.
 * HEIC) - the caller then uploads the original and lets the server decide.
 */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.fillStyle = "#ffffff"; // PNGs with transparency would otherwise turn black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image."))), "image/jpeg", 0.82);
  });
}

function StepCard({
  item,
  terms,
  showBadge,
  onDelete,
  deleting,
}: {
  item: Numbered;
  terms: string[];
  showBadge: boolean;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const { step, number } = item;
  return (
    <li id={`step-${number}`} className="card flex gap-3 p-4 sm:gap-4 sm:p-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-stone-900">
            <Highlight text={step.title} terms={terms} />
          </h3>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
        {showBadge && step.category ? (
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${styleFor(step.category).badge}`}
          >
            {step.category}
          </span>
        ) : null}
        {step.description ? (
          <p className="mt-1 text-sm text-stone-500">
            <Highlight text={step.description} terms={terms} />
          </p>
        ) : null}
        {step.image && (
          // eslint-disable-next-line @next/next/no-img-element -- plain
          // <img> deliberately: these are static files under /public
          // authored per-step in guide-content.ts, not user uploads,
          // so next/image's remote-domain config isn't relevant here.
          <img
            src={step.image}
            alt={step.imageAlt ?? step.title}
            loading="lazy"
            className="mt-3 w-full max-w-md rounded-lg border border-stone-200"
          />
        )}
        {step.images?.map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element -- see above
          <img
            key={k}
            src={src}
            alt={`${step.title} (photo ${k + 2})`}
            loading="lazy"
            className="mt-3 w-full max-w-md rounded-lg border border-stone-200"
          />
        ))}
      </div>
    </li>
  );
}

/** The dashed "+ Add step here" divider shown between steps in edit mode. */
function InsertRow({ onClick }: { onClick: () => void }) {
  return (
    <li className="flex items-center gap-3 py-0.5">
      <span className="h-px flex-1 bg-stone-200" aria-hidden />
      <button
        type="button"
        onClick={onClick}
        className="rounded-full border border-dashed border-brand-300 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
      >
        + Add step here
      </button>
      <span className="h-px flex-1 bg-stone-200" aria-hidden />
    </li>
  );
}

function AddStepForm({
  categories,
  defaultCategory,
  onCancel,
  onSubmit,
}: {
  categories: string[];
  defaultCategory: string;
  onCancel: () => void;
  onSubmit: (input: NewStepInput) => Promise<string | null>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const message = await onSubmit({ title, description, category, file });
    // On success the parent closes this form; only stay busy-free on error.
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <li>
      <form onSubmit={handleSubmit} className="card space-y-3 border-2 border-dashed border-brand-300 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-stone-900">New step</h3>
        {error ? <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Title
            <input
              className="input mt-1.5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              autoFocus
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Description <span className="font-normal text-stone-400">(optional)</span>
            <textarea
              className="input mt-1.5 min-h-[5rem]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            Group
            <input
              className="input mt-1.5"
              list="guide-category-options"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={60}
              placeholder="Pick one or type a new group"
            />
            <datalist id="guide-category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Photo <span className="font-normal text-stone-400">(optional)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input mt-1.5 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-700"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Add step"}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

export function GuideSteps({
  guide,
  heading,
  intro,
  steps,
  canEdit = false,
  customized = false,
}: {
  /** Which guide this is ("local" | "intra"); used by the edit API. */
  guide: string;
  heading: string;
  intro?: string;
  steps: GuideStep[];
  /** Admin / Secondary Admin only: shows the "Edit guide" button. */
  canEdit?: boolean;
  /** True once the guide has been edited in the app (enables "Reset"). */
  customized?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(true);
  // Groups start collapsed so the page opens as a short overview of the
  // groups; click a group (or "Expand all") to see its steps.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [editMode, setEditMode] = useState(false);
  // Where the "new step" form is open: the id of the step to insert after,
  // "__start" for the very top, or null when closed.
  const [insertKey, setInsertKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  // Numbers come from the original order and never change with filtering or
  // grouping, so "step 45" always means the same step. Add/delete simply
  // changes the list, so every later number follows automatically.
  const numbered: Numbered[] = useMemo(
    () => steps.map((step, i) => ({ step, number: i + 1 })),
    [steps],
  );

  // Categories in order of first appearance, with counts.
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const { step } of numbered) {
      if (step.category) map.set(step.category, (map.get(step.category) ?? 0) + 1);
    }
    return Array.from(map, ([name, count]) => ({ name, count }));
  }, [numbered]);
  const hasCategories = categories.length > 0;

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );

  const matches = useMemo(() => {
    return numbered.filter(({ step, number }) => {
      if (activeCategory && step.category !== activeCategory) return false;
      if (terms.length === 0) return true;
      const haystack = `${step.title} ${step.description} ${step.category ?? ""} step ${number}`.toLowerCase();
      // Every word must match (AND), so "cisco install" narrows down.
      return terms.every((t) => haystack.includes(t));
    });
  }, [numbered, activeCategory, terms]);

  const filtering = terms.length > 0 || activeCategory !== null;
  // Editing always uses the plain in-order list so "between steps" is unambiguous.
  const showGroups = hasCategories && grouped && !editMode;

  const sections = useMemo(() => {
    if (!showGroups) return [];
    return categories
      .map(({ name }) => ({ name, items: matches.filter((m) => m.step.category === name) }))
      .filter((s) => s.items.length > 0);
  }, [showGroups, categories, matches]);
  const uncategorized = showGroups ? matches.filter((m) => !m.step.category) : [];

  function toggleSection(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const expandAll = () => setExpanded(new Set(categories.map((c) => c.name)));
  const collapseAll = () => setExpanded(new Set());

  function clearAll() {
    setQuery("");
    setActiveCategory(null);
  }

  function toggleEditMode() {
    setEditMode((on) => !on);
    setInsertKey(null);
    setNotice("");
    setActionError("");
  }

  async function postAction(body: unknown): Promise<{ ok: boolean; data: { error?: string; number?: number } }> {
    const res = await fetch(`/api/guide/${guide}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  /** Returns an error message, or null when the step was added. */
  async function addStep(afterId: string | null, input: NewStepInput): Promise<string | null> {
    setNotice("");
    setActionError("");
    try {
      let image: string | undefined;
      if (input.file) {
        let blob: Blob = input.file;
        try {
          blob = await shrinkImage(input.file);
        } catch {
          // Could not decode in the browser; send the original and let the server validate it.
        }
        const fd = new FormData();
        fd.append("image", blob, "step.jpg");
        const up = await fetch("/api/guide/images", { method: "POST", body: fd });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok || !upData.url) return upData.error ?? "The photo could not be uploaded.";
        image = upData.url as string;
      }

      const { ok, data } = await postAction({
        action: "insert",
        afterId,
        step: {
          title: input.title,
          description: input.description,
          category: input.category.trim() || undefined,
          image,
        },
      });
      if (!ok) return data.error ?? "The step could not be added.";

      setInsertKey(null);
      setNotice(`Step added as step ${data.number}. Later steps were renumbered.`);
      router.refresh();
      return null;
    } catch {
      return "Could not reach the server. Please try again.";
    }
  }

  async function deleteStep(item: Numbered) {
    const id = item.step.id;
    if (!id) return;
    const ok = window.confirm(
      `Delete step ${item.number} "${item.step.title}"?\n\nLater steps will be renumbered.`,
    );
    if (!ok) return;

    setNotice("");
    setActionError("");
    setDeletingId(id);
    try {
      const result = await postAction({ action: "delete", id });
      if (!result.ok) {
        setActionError(result.data.error ?? "The step could not be deleted.");
        return;
      }
      setNotice(`Step ${item.number} deleted. Later steps were renumbered.`);
      router.refresh();
    } catch {
      setActionError("Could not reach the server. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function resetGuide() {
    const ok = window.confirm(
      "Reset this guide to its built-in content?\n\nEvery step you added or deleted in the app, and any photos you uploaded, will be lost.",
    );
    if (!ok) return;
    setNotice("");
    setActionError("");
    try {
      const result = await postAction({ action: "reset" });
      if (!result.ok) {
        setActionError(result.data.error ?? "The guide could not be reset.");
        return;
      }
      setInsertKey(null);
      setNotice("The guide was reset to its built-in content.");
      router.refresh();
    } catch {
      setActionError("Could not reach the server. Please try again.");
    }
  }

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition";

  const categoryNames = categories.map((c) => c.name);

  /** The form (if open at this spot) or the "+ Add step here" divider. */
  function renderInsertSpot(afterId: string | null, defaultCategory: string) {
    const key = afterId ?? "__start";
    if (insertKey === key) {
      return (
        <AddStepForm
          key={`form-${key}`}
          categories={categoryNames}
          defaultCategory={defaultCategory}
          onCancel={() => setInsertKey(null)}
          onSubmit={(input) => addStep(afterId, input)}
        />
      );
    }
    return <InsertRow key={`insert-${key}`} onClick={() => setInsertKey(key)} />;
  }

  return (
    <main className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Guide</p>
          <h1 className="mt-1 text-lg font-semibold text-stone-900">{heading}</h1>
          {intro ? <p className="mt-1 max-w-xl text-sm text-stone-500">{intro}</p> : null}
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={toggleEditMode}
            className={editMode ? "btn-primary" : "btn-secondary"}
          >
            {editMode ? "Done editing" : "Edit guide"}
          </button>
        ) : null}
      </div>

      {editMode ? (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/80 px-4 py-3 text-sm text-brand-700">
          <strong className="font-semibold">Editing.</strong> Use “+ Add step here” between steps to insert a new
          one, or “Delete” on a step to remove it. Step numbers update automatically.
          {customized ? (
            <>
              {" "}
              <button
                type="button"
                onClick={resetGuide}
                className="font-semibold text-red-600 underline underline-offset-2"
              >
                Reset to built-in content
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="mt-3 rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {actionError ? (
        <div role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className="card mt-6 space-y-3 p-4">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the guide — e.g. ISE posture, SAP installer, Windows Update, step 45…"
            aria-label="Search the guide"
            className="input pr-10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              ×
            </button>
          ) : null}
        </div>

        {hasCategories ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              aria-pressed={activeCategory === null}
              className={`${chipBase} ${
                activeCategory === null
                  ? "border-stone-800 bg-stone-800 text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
              }`}
            >
              All <span className="opacity-70">{steps.length}</span>
            </button>
            {categories.map(({ name, count }) => {
              const active = activeCategory === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveCategory(active ? null : name)}
                  aria-pressed={active}
                  className={`${chipBase} ${
                    active
                      ? `${styleFor(name).chip} ring-2 ring-offset-1 ring-brand-300`
                      : `${styleFor(name).chip} opacity-80 hover:opacity-100`
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${styleFor(name).dot}`} />
                  {name} <span className="opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <span aria-live="polite">
            {filtering
              ? `${matches.length} of ${steps.length} steps`
              : `${steps.length} ${steps.length === 1 ? "step" : "steps"}`}
            {filtering ? (
              <button
                type="button"
                onClick={clearAll}
                className="ml-2 font-semibold text-brand-600 hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </span>
          {hasCategories && !editMode ? (
            <div className="flex flex-wrap items-center gap-2">
              {showGroups && !filtering ? (
                <>
                  <button
                    type="button"
                    onClick={expandAll}
                    className="rounded-full px-2 py-1 font-semibold text-brand-600 hover:underline"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="rounded-full px-2 py-1 font-semibold text-brand-600 hover:underline"
                  >
                    Collapse all
                  </button>
                </>
              ) : null}
              <div className="inline-flex rounded-full border border-stone-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setGrouped(true)}
                  aria-pressed={grouped}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    grouped ? "bg-stone-800 text-white" : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  Grouped
                </button>
                <button
                  type="button"
                  onClick={() => setGrouped(false)}
                  aria-pressed={!grouped}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    !grouped ? "bg-stone-800 text-white" : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  In order
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {editMode ? (
        matches.length === 0 && filtering ? (
          <div className="card mt-4 p-6 text-center text-sm text-stone-500">
            No steps match{query ? ` “${query.trim()}”` : ""}.
            <div className="mt-3">
              <button type="button" onClick={clearAll} className="btn-secondary">
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {/* Top of the guide. With a search/filter on, the list is partial, so only offer spots after a shown step. */}
            {!filtering ? renderInsertSpot(null, numbered[0]?.step.category ?? "") : null}
            {matches.map((item) => (
              <Fragment key={item.step.id ?? item.number}>
                <StepCard
                  item={item}
                  terms={terms}
                  showBadge
                  onDelete={item.step.id ? () => deleteStep(item) : undefined}
                  deleting={deletingId === item.step.id}
                />
                {item.step.id ? renderInsertSpot(item.step.id, item.step.category ?? "") : null}
              </Fragment>
            ))}
          </ol>
        )
      ) : matches.length === 0 ? (
        <div className="card mt-4 p-6 text-center text-sm text-stone-500">
          {steps.length === 0 ? (
            "This guide has no steps yet."
          ) : (
            <>
              No steps match{query ? ` “${query.trim()}”` : ""}. Try fewer or different words.
              <div className="mt-3">
                <button type="button" onClick={clearAll} className="btn-secondary">
                  Clear filters
                </button>
              </div>
            </>
          )}
        </div>
      ) : showGroups ? (
        <div className="mt-4 space-y-3">
          {sections.map(({ name, items }) => {
            // While searching or filtering, always show the matches.
            const isOpen = filtering || expanded.has(name);
            return (
              <section key={name}>
                <button
                  type="button"
                  onClick={() => toggleSection(name)}
                  aria-expanded={isOpen}
                  disabled={filtering}
                  className="card flex w-full items-center gap-3 px-4 py-3 text-left transition hover:border-brand-200 disabled:cursor-default"
                >
                  <svg
                    className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M7.05 4.55a1 1 0 0 1 1.4 0l4.75 4.75a1 1 0 0 1 0 1.4l-4.75 4.75a1 1 0 1 1-1.4-1.4L11.1 10 7.05 5.95a1 1 0 0 1 0-1.4Z" />
                  </svg>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styleFor(name).dot}`} />
                  <h2 className="min-w-0 flex-1 text-sm font-semibold text-stone-900">{name}</h2>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                    {items.length} {items.length === 1 ? "step" : "steps"}
                  </span>
                </button>
                {isOpen ? (
                  <ol className="mt-3 space-y-3">
                    {items.map((item) => (
                      <StepCard key={item.step.id ?? item.number} item={item} terms={terms} showBadge={false} />
                    ))}
                  </ol>
                ) : null}
              </section>
            );
          })}
          {uncategorized.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-stone-900">Other</h2>
              <ol className="mt-3 space-y-3">
                {uncategorized.map((item) => (
                  <StepCard key={item.step.id ?? item.number} item={item} terms={terms} showBadge={false} />
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {matches.map((item) => (
            <StepCard key={item.step.id ?? item.number} item={item} terms={terms} showBadge />
          ))}
        </ol>
      )}
    </main>
  );
}
