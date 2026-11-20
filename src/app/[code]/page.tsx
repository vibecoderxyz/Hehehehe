import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLinkByCode } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Secure link /${code}`,
    robots: { index: false, follow: false },
  };
}

export default async function ShortLinkPage({ params }: Props) {
  const { code } = await params;
  const link = await getLinkByCode(code);
  if (!link) notFound();

  // Short URLs open the saved destination directly. No visitor gateway,
  // verification screen, camera/GPS request, or intermediate UI is rendered.
  redirect(link.long_url);
}
