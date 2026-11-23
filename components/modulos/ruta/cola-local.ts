"use client";

/**
 * Cola local de la Ruta de aseo: si no hay señal, el turno y el reporte (con su video) se
 * guardan en el celular (IndexedDB) y se envían cuando vuelve la conexión. Cada envío lleva la
 * hora real del toque. Si el navegador no deja guardar, se avisa y no se pierde en silencio.
 */
export interface Pendiente {
  id: string;
  tipo: "iniciar" | "cerrar" | "reporte";
  cuando: string;
  datos?: Record<string, unknown>;
  archivo?: Blob;
  nombreArchivo?: string;
}

const BASE = "verse-app-ruta";
const ALMACEN = "pendientes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN, { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const tx = db.transaction(ALMACEN, modo);
    const r = f(tx.objectStore(ALMACEN));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

export const guardarPendiente = (p: Pendiente) => operar("readwrite", (s) => s.put(p));
export const borrarPendiente = (id: string) => operar("readwrite", (s) => s.delete(id));
export const listarPendientes = async (): Promise<Pendiente[]> => {
  try {
    const todos = (await operar("readonly", (s) => s.getAll())) as Pendiente[];
    return todos.sort((a, b) => a.cuando.localeCompare(b.cuando));
  } catch {
    return [];
  }
};

/** Un error de red (no un "no" del servidor): la acción del servidor ni siquiera respondió. */
export const esErrorDeRed = (e: unknown) => !navigator.onLine || (e instanceof TypeError && /fetch|network|load/i.test(e.message));
