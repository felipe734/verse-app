# 0030 · Estándar de la app (rediseño R1)

Feedback de Felipe del 2026-11-25: la app tiene que verse y manejarse igual en todas las secciones.

## Reglas

1. **Barra superior** solo para lo transversal: menú, ruta, avisos y asistente. Ningún módulo pone controles ahí (se quitó `AccionesModulo`).
2. **Una sola fila de controles** por módulo (`BarraControles`, components/modulos/barra-controles.tsx), en la misma línea del contenido:
   - a la izquierda, período y filtros;
   - a la derecha, buscar, Mío / Todo, vista, actualizar, exportar y vistas guardadas.

   En el celular, buscar y las acciones bajan a su propia línea.
3. **Barra lateral** con verticales plegables:
   - la vertical de la página abierta siempre está desplegada;
   - General arranca abierta y las demás plegadas;
   - lo que pliegue cada persona se recuerda en su navegador (`verse-menu-plegadas`);
   - con la barra en íconos, todo queda a la vista.
4. **Tableros solo en los embudos comerciales** (Comercial Host y Comercial Living). El resto son tablas tipo Airtable. Contratos ya no tiene calendario.
5. **Estados con color por significado** (lib/vistas/tono.ts, componente `Estado`), con punto y texto, sin fondos:

   | Color | Significado |
   |---|---|
   | Verde | Hecho |
   | Azul | En curso |
   | Ámbar | Pendiente |
   | Rojo | Problema |

6. **Identidad:** los títulos van en Gantari, la tipografía de la marca VERSE (OFL). El cuerpo sigue en Geist.
7. **Sistema** (salud, sincronización, respaldos, corridas) vive en Ajustes › Sistema, por empresa.
   - Ya no va en el menú (`enMenu: false` en el registro).
   - `/sistema` y los avisos de falla llevan ahí.
8. **Alistamiento** queda oculto (`construido: false`) hasta que se retome.
9. El título de la pestaña sale del módulo de la ruta: Unidades Living ya no aparece como "Unidades Host".
