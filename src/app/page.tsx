import { redirect } from "next/navigation";

/** Keep the supplied index.html as the homepage UI; API routes remain native Next.js routes. */
export default function HomePage() {
  redirect("/index.html");
}
