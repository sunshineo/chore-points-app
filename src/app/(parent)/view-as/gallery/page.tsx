import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import ViewAsGalleryClient from "./ViewAsGalleryClient";

export default async function ViewAsGalleryPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "PARENT") {
    redirect("/dashboard");
  }

  if (!session.user.familyId) {
    redirect("/dashboard");
  }

  return <ViewAsGalleryClient />;
}
