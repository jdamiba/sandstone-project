import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SearchPage from "@/components/SearchPage";

export default async function Search() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  return <SearchPage />;
}
