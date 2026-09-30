import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { GuideSteps } from "@/components/guide/GuideSteps";
import { loadGuide } from "@/lib/guide-store";

// Split from the shared /guide placeholder on 2026-09-26. The built-in Intra
// steps are still placeholders (src/lib/guide-content.ts); admins can now
// replace them by adding/deleting steps in the app (2026-09-30).
export default async function IntraGuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { steps, customized } = await loadGuide("intra");
  const canEdit = session.role === "Admin" || session.role === "Secondary Admin";

  return (
    <GuideSteps
      guide="intra"
      heading="Intra Guide"
      intro="Step-by-step setup for Intra devices."
      steps={steps}
      canEdit={canEdit}
      customized={customized}
    />
  );
}
