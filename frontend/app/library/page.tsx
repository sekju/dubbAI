import { fetchLibrary } from "@/lib/api";
import { LibraryShell } from "@/components/library/library-shell";

export default async function LibraryPage() {
  const initialData = await fetchLibrary();

  return <LibraryShell initialData={initialData} />;
}
