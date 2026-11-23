/** Al arrancar el servidor: en modo vitrina (solo Playwright, nunca en Vercel) prepara la base en memoria. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { esVitrina } = await import("./lib/vitrina/activa");
  if (!esVitrina()) return;
  const { iniciarVitrina } = await import("./lib/vitrina/sembrar");
  (globalThis as { __dbVitrina?: unknown }).__dbVitrina = await iniciarVitrina();
}
