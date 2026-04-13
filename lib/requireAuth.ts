import { supabase } from "@/lib/supabaseClient";

export async function requireAuthOrRedirect(
  router: { push: (path: string) => void },
  nextPath: string
) {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    router.push(`/login?next=${encodeURIComponent(nextPath)}`);
    return null;
  }

  return auth.user;
}