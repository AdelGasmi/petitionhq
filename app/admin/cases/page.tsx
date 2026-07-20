import { redirect } from "next/navigation";

// CTO alignment: /admin/cases redirects to /admin/clients (same page, renamed heading)
export default function AdminCasesRedirect() {
  redirect("/admin/clients");
}
