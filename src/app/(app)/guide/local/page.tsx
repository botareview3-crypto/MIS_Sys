import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { GuideSteps } from "@/components/guide/GuideSteps";
import { localGuideSteps } from "@/lib/guide-content";

// Split from the shared /guide placeholder on 2026-09-26 — Local and Intra
// are meant to get their own guide content later; this is the Local half.
// Steps are placeholder data in src/lib/guide-content.ts until the project
// owner supplies the real content.
export default async function LocalGuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <GuideSteps
      heading="Local Guide"
      intro="Step-by-step setup for Local devices. Content below is a placeholder."
      steps={localGuideSteps}
    />
  );
}
