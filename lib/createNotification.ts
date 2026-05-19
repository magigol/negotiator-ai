/*
 * File: lib/createNotification.ts
 * Purpose: Utilidad de librería / helper
 */

import { createClient } from "@supabase/supabase-js";

// Función auxiliar: assertEnv.
function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function createAdminClient() {
  return createClient(
    assertEnv("NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
    }
  );
}

export async function createNotification(params: {
  userId: string;
  dealId?: string | null;
  type: string;
  title: string;
  message?: string | null;
}) {
  const admin = createAdminClient();

  await admin.from("notifications").insert({
    user_id: params.userId,
    deal_id: params.dealId ?? null,
    type: params.type,
    title: params.title,
    message: params.message ?? null,
  });
}