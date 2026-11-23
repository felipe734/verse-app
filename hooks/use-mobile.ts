import * as React from "react"

const MOBILE_BREAKPOINT = 768
const consulta = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function suscribir(cambio: () => void) {
  const mql = window.matchMedia(consulta)
  mql.addEventListener("change", cambio)
  return () => mql.removeEventListener("change", cambio)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    suscribir,
    () => window.matchMedia(consulta).matches,
    () => false,
  )
}
