/*
 * File: lib/requireAuth.ts
 * Purpose: Utilidad de librería / helper
 *
 * Comentarios añadidos para ayudar a otro desarrollador a entender el flujo de datos y la lógica.
 */

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