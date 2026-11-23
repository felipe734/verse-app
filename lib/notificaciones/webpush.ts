import { sendNotification, setVapidDetails } from "web-push";
import type { Enviar } from "./avisos";

/**
 * Envío Web Push con las claves VAPID de Vercel. Sin claves, los avisos se apagan
 * (devuelve null) y la app sigue funcionando.
 */
export function enviarWebPush(): Enviar | null {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const sujeto = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !sujeto) return null;
  setVapidDetails(sujeto, publica, privada);
  return async (sub, carga) => {
    try {
      const r = await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(carga), { TTL: 24 * 3600 });
      return r.statusCode;
    } catch (e) {
      const estado = (e as { statusCode?: number }).statusCode;
      return typeof estado === "number" ? estado : 0;
    }
  };
}
