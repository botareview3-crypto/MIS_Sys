import type { GuideStep } from "@/components/guide/GuideSteps";

/**
 * Placeholder content for the Local/Intra guide pages (2026-09-26).
 * Project owner is still gathering the real steps — this is a template so
 * the page has real structure to render. To fill in for real: replace the
 * title/description text below with the actual steps; no other file needs
 * to change.
 *
 * Image + description steps (2026-09-26): each step can optionally carry
 * an `image` — a path under /public/guide/ (e.g. "/guide/local-step-1.png")
 * or a full URL — shown under that step's description. To add a real step
 * image: drop the file in public/guide/ and set `image` to its path, as
 * shown commented-out below. A step with no `image` just renders title +
 * description as before; images are optional per step, not all-or-nothing.
 */

export const localGuideSteps: GuideStep[] = [
  {
    title: "Step 1",
    description: "Placeholder — replace with the first Local step.",
    // image: "/guide/local-step-1.png",
  },
  { title: "Step 2", description: "Placeholder — replace with the second Local step." },
  { title: "Step 3", description: "Placeholder — replace with the third Local step." },
];

export const intraGuideSteps: GuideStep[] = [
  {
    title: "Step 1",
    description: "Placeholder — replace with the first Intra step.",
    // image: "/guide/intra-step-1.png",
  },
  { title: "Step 2", description: "Placeholder — replace with the second Intra step." },
  { title: "Step 3", description: "Placeholder — replace with the third Intra step." },
];
