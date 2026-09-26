import { redirect } from "next/navigation";

// Nav now points Local/Intra at /guide/local and /guide/intra separately
// (2026-09-26). This route is kept only so any old bookmark/link to the
// original shared /guide still lands somewhere sensible.
export default function GuidePage() {
  redirect("/guide/local");
}
