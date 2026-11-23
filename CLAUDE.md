# Verse App

App de Verse Group y C&C Group sobre Airtable. El plan vive en el doc "Verse App · plan" (https://claude.ai/artifact/LBRrnBMfPSvfYKLenhVk1d). Si el código y el doc no coinciden, gana el doc y se avisa a Felipe.

## Reglas

1. Airtable es la verdad del negocio: la app lee de Postgres y escribe en Airtable solo por la cola.
2. Ninguna consulta sin la función de permisos; cada ruta nueva entra con su prueba por plantilla.
3. IDs de Airtable solo desde el mapeo, nunca escritos a mano.
4. Rama claude/, PR pequeño, lint, tipos y pruebas en verde. Nada se fusiona sin OK de Felipe.
5. Sin secretos en código ni logs; sin datos reales de propietarios, contratistas o huéspedes en pruebas.
6. Cambios en Airtable o en skills van en su propio PR en verse-plugins, con plan y OK antes de escribir.
7. Español, sin signos de admiración; celular primero. Interfaz de SaaS neutra (shadcn zinc, Geist, claro y oscuro): cada empresa solo aporta logo, nombre y color de acento. La marca Verse queda para los correos. Módulos nuevos se declaran en lib/modulos/registro.ts.

## Rutina de cada PR

1. Leer la entrega en el doc y proponer el plan del PR en cinco líneas.
2. Construir con pruebas primero en datos y permisos.
3. Correr todo en verde (`pnpm verificar`) y abrir el PR con qué cambia, cómo probarlo y capturas de celular.
4. Felipe prueba la vista previa y aprueba; Claude Code fusiona y verifica producción.
5. Al cerrar la entrega, marcar sus casillas en el doc y dejar una Corrida "App" en TRAZABILIDAD.

## Estructura

- `app/` pantallas por módulo y rutas de API
- `lib/airtable/` cliente, mapeo de IDs y cola de escrituras
- `lib/sync/` carga completa, webhooks y reconciliación
- `lib/acceso/` función única de permisos y sus pruebas
- `lib/asistente/` herramientas y prompt del asistente
- `lib/respaldo/` exportación y restauración
- `db/` esquema Drizzle y migraciones
- `tests/` unitarias (`tests/unit`), de permisos y flujos (`tests/e2e`)
- `docs/` decisiones de arquitectura, una por archivo

## Comandos

- `pnpm dev` servidor local
- `pnpm verificar` lint, tipos, pruebas unitarias y build
- `pnpm test` Vitest · `pnpm test:e2e` Playwright
- Node 22 (`.nvmrc`), pnpm

@AGENTS.md
