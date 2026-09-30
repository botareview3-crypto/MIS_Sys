import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { GuideSteps } from "@/components/guide/GuideSteps";
import { loadGuide } from "@/lib/guide-store";

// Split from the shared /guide placeholder on 2026-09-26 - Local and Intra
// each have their own guide. Built-in steps live in src/lib/guide-content.ts;
// since 2026-09-30 admins can add/delete steps in the app, and those edits
// (stored in the guide_contents table) take over from the built-in content.
export default async function LocalGuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { steps, customized } = await loadGuide("local");
  const canEdit = session.role === "Admin" || session.role === "Secondary Admin";

  return (
    <GuideSteps
      guide="local"
      heading="Local Guide"
      intro="Step-by-step PC configuration for Local devices. Search for an issue or pick a group below."
      steps={steps}
      canEdit={canEdit}
      customized={customized}
    />
  );
}
