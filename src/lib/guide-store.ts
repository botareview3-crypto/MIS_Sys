import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localGuideSteps, intraGuideSteps } from "@/lib/guide-content";
import type { GuideStep } from "@/components/guide/GuideSteps";

/**
 * Guide content storage (2026-09-30). The built-in steps live in
 * src/lib/guide-content.ts. The first time an admin edits a guide in the app,
 * the whole step list is copied into the guide_contents table and from then on
 * the table wins ("customized"). "Reset to built-in" deletes that row again.
 *
 * Every step has a stable string id so add/delete requests refer to the step
 * itself, not to a position that may have shifted under someone else's edit.
 * Step numbers are never stored - they are just the position in the list.
 */
export type GuideKey = "local" | "intra";

export function isGuideKey(value: string): value is GuideKey {
  return value === "local" || value === "intra";
}

const DEFAULTS: Record<GuideKey, GuideStep[]> = {
  local: localGuideSteps,
  intra: intraGuideSteps,
};

const GUIDE_IMAGE_URL = /^\/api\/guide\/images\/(\d+)$/;

export class GuideError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

function withIds(steps: GuideStep[]): GuideStep[] {
  return steps.map((s, i) => ({ ...s, id: s.id ?? `d${i + 1}` }));
}

async function readCurrent(guide: GuideKey): Promise<{ steps: GuideStep[]; customized: boolean }> {
  const row = await prisma.guideContent.findUnique({ where: { guide } });
  if (row && Array.isArray(row.steps)) {
    return { steps: row.steps as unknown as GuideStep[], customized: true };
  }
  return { steps: withIds(DEFAULTS[guide]), customized: false };
}

/** For the guide pages. Falls back to the built-in content if the table is missing. */
export async function loadGuide(guide: GuideKey): Promise<{ steps: GuideStep[]; customized: boolean }> {
  try {
    return await readCurrent(guide);
  } catch (e) {
    console.error("guide_contents unavailable, using built-in guide content:", e);
    return { steps: withIds(DEFAULTS[guide]), customized: false };
  }
}

async function save(guide: GuideKey, steps: GuideStep[], userId: number) {
  const json = steps as unknown as Prisma.InputJsonValue;
  await prisma.guideContent.upsert({
    where: { guide },
    create: { guide, steps: json, updatedBy: userId },
    update: { steps: json, updatedBy: userId, updatedAt: new Date() },
  });
}

function imageIdsOf(steps: GuideStep[]): number[] {
  const ids: number[] = [];
  for (const step of steps) {
    for (const url of [step.image, ...(step.images ?? [])]) {
      const m = url ? GUIDE_IMAGE_URL.exec(url) : null;
      if (m) ids.push(Number(m[1]));
    }
  }
  return ids;
}

export function isGuideImageUrl(url: string): boolean {
  return GUIDE_IMAGE_URL.test(url);
}

export type NewStepInput = {
  title: string;
  description: string;
  category?: string;
  image?: string;
};

/** Inserts right after the step with id `afterId` (or at the very top when null). Returns the new step's number. */
export async function insertStep(
  guide: GuideKey,
  afterId: string | null,
  input: NewStepInput,
  userId: number,
): Promise<{ id: string; number: number }> {
  const { steps } = await readCurrent(guide);

  let index = 0;
  if (afterId !== null) {
    const found = steps.findIndex((s) => s.id === afterId);
    if (found === -1) {
      throw new GuideError(409, "That step no longer exists - the guide was changed. Refresh the page and try again.");
    }
    index = found + 1;
  }

  const id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const step: GuideStep = { id, title: input.title, description: input.description };
  if (input.category) step.category = input.category;
  if (input.image) step.image = input.image;

  const next = [...steps.slice(0, index), step, ...steps.slice(index)];
  await save(guide, next, userId);
  return { id, number: index + 1 };
}

export async function deleteStep(guide: GuideKey, id: string, userId: number): Promise<void> {
  const { steps } = await readCurrent(guide);
  const target = steps.find((s) => s.id === id);
  if (!target) {
    throw new GuideError(404, "That step was already deleted. Refresh the page.");
  }
  await save(
    guide,
    steps.filter((s) => s.id !== id),
    userId,
  );
  // Photos uploaded through the app die with their step; photos that ship
  // with the code (/guide/...) are not touched.
  const imageIds = imageIdsOf([target]);
  if (imageIds.length > 0) {
    await prisma.guideImage.deleteMany({ where: { id: { in: imageIds } } });
  }
}

/** Throws the customized copy away; the guide goes back to src/lib/guide-content.ts. */
export async function resetGuide(guide: GuideKey): Promise<void> {
  const row = await prisma.guideContent.findUnique({ where: { guide } });
  if (!row) return;
  const imageIds = Array.isArray(row.steps) ? imageIdsOf(row.steps as unknown as GuideStep[]) : [];
  await prisma.guideContent.delete({ where: { guide } });
  if (imageIds.length > 0) {
    await prisma.guideImage.deleteMany({ where: { id: { in: imageIds } } });
  }
}
