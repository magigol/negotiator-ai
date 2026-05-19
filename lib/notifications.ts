/*
 * File: lib/notifications.ts
 * Purpose: Utilidad de librería / helper
 */

export function parseNotification(content: string | null) {
  if (!content) return null;

  if (content.startsWith("SYSTEM:NEW_OFFER")) {
    return {
      label: "🟢 Nueva oferta recibida",
      type: "offer",
    };
  }

  if (content.startsWith("SYSTEM:COUNTER_OFFER")) {
    return {
      label: "🟡 Contraoferta disponible",
      type: "counter",
    };
  }

  if (content.startsWith("SYSTEM:ACCEPTED")) {
    return {
      label: "🔵 Oferta aceptada",
      type: "accepted",
    };
  }

  if (content.startsWith("SYSTEM:REJECTED")) {
    return {
      label: "🔴 Oferta rechazada",
      type: "rejected",
    };
  }

  if (content.startsWith("SYSTEM:ARCHIVED")) {
    return {
      label: "🗂️ Producto archivado",
      type: "archived",
    };
  }

  if (content.startsWith("SYSTEM:REACTIVATED")) {
    return {
      label: "♻️ Producto reactivado",
      type: "reactivated",
    };
  }

  return {
    label: content,
    type: "other",
  };
}