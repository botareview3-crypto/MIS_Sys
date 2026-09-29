"use client";

import { useMemo, useState } from "react";

export type GuideStep = {
  title: string;
  description: string;
  /**
   * Group this step belongs to (e.g. "Configuration", "Cisco", "SAP",
   * "Applications to be installed"). Optional — a guide whose steps have no
   * category just shows a flat list with search, same as before.
   */
  category?: string;
  /**
   * Path under /public (e.g. "/guide/local-step-1.png") or a full URL.
   * Optional — a step with no image just shows title + description, same
   * as before this field existed.
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

function StepCard({ item, terms, showBadge }: { item: Numbered; terms: string[]; showBadge: boolean }) {
  const { step, number } = item;
  return (
    <li id={`step-${number}`} className="card flex gap-3 p-4 sm:gap-4 sm:p-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-stone-900">
          <Highlight text={step.title} terms={terms} />
        </h3>
        {showBadge && step.category ? (
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${styleFor(step.category).badge}`}
          >
            {step.category}
          </span>
        ) : null}
        <p className="mt-1 text-sm text-stone-500">
          <Highlight text={step.description} terms={terms} />
        </p>
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

export function GuideSteps({
  heading,
  intro,
  steps,
}: {
  heading: string;
  intro?: string;
  steps: GuideStep[];
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Numbers come from the original order and never change with filtering or
  // grouping, so "step 45" always means the same step.
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
  const showGroups = hasCategories && grouped;

  const sections = useMemo(() => {
    if (!showGroups) return [];
    return categories
      .map(({ name }) => ({ name, items: matches.filter((m) => m.step.category === name) }))
      .filter((s) => s.items.length > 0);
  }, [showGroups, categories, matches]);
  const uncategorized = showGroups ? matches.filter((m) => !m.step.category) : [];

  function toggleSection(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearAll() {
    setQuery("");
    setActiveCategory(null);
  }

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition";

  return (
    <main className="p-4 sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Guide</p>
        <h1 className="mt-1 text-lg font-semibold text-stone-900">{heading}</h1>
        {intro ? <p className="mt-1 max-w-xl text-sm text-stone-500">{intro}</p> : null}
      </div>

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
              : `${steps.length} steps`}
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
          {hasCategories ? (
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
          ) : null}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="card mt-4 p-6 text-center text-sm text-stone-500">
          No steps match{query ? ` “${query.trim()}”` : ""}. Try fewer or different words.
          <div className="mt-3">
            <button type="button" onClick={clearAll} className="btn-secondary">
              Clear filters
            </button>
          </div>
        </div>
      ) : showGroups ? (
        <div className="mt-4 space-y-6">
          {sections.map(({ name, items }) => {
            // While searching or filtering, always show the matches.
            const isOpen = filtering || !collapsed.has(name);
            return (
              <section key={name}>
                <button
                  type="button"
                  onClick={() => toggleSection(name)}
                  aria-expanded={isOpen}
                  disabled={filtering}
                  className="flex w-full items-center gap-2 text-left disabled:cursor-default"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${styleFor(name).dot}`} />
                  <h2 className="text-sm font-semibold text-stone-900">{name}</h2>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                    {items.length}
                  </span>
                  {!filtering ? (
                    <span className="ml-auto text-xs text-stone-400">{isOpen ? "Hide" : "Show"}</span>
                  ) : null}
                </button>
                {isOpen ? (
                  <ol className="mt-3 space-y-3">
                    {items.map((item) => (
                      <StepCard key={item.number} item={item} terms={terms} showBadge={false} />
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
                  <StepCard key={item.number} item={item} terms={terms} showBadge={false} />
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {matches.map((item) => (
            <StepCard key={item.number} item={item} terms={terms} showBadge />
          ))}
        </ol>
      )}
    </main>
  );
}
