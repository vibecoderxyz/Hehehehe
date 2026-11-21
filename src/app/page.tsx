import { redirect } from "next/navigation";

/**
 * Serve the supplied standalone index.html as the homepage.
 * The HTML/CSS/JS asset is kept byte-for-byte identical to deploy/index.html.
 * Backend API routes remain available under /api/*.
 */
export default function HomePage() {
  redirect("/index.html");
}
