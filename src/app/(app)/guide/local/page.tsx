import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { GuideSteps } from "@/components/guide/GuideSteps";
import { localGuideSteps } from "@/lib/guide-content";

// Split from the shared /guide placeholder on 2026-09-26 — Local and Intra
// are meant to get their own guide content later; this is the Local half.
// Steps live in src/lib/guide-content.ts (real content added 2026-09-29).
export default async function LocalGuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <GuideSteps
      heading="Local Guide"
      intro="Step-by-step PC configuration for Local devices."
      steps={localGuideSteps}
    />
  );
}
