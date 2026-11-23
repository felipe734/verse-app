import { useSyncExternalStore } from "react";

const nada = () => () => {};

/** true solo en el navegador, después de hidratar. */
export function useMontado(): boolean {
  return useSyncExternalStore(nada, () => true, () => false);
}
