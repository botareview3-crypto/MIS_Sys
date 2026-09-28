import { redirect } from "next/navigation";

/**
 * Superseded by /repairs/[id]/follow-up, which handles Received, Ready and
 * Delivered. Kept only so old links and bookmarks keep working.
 */
export default async function HandoverRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/repairs/${id}/follow-up`);
}
