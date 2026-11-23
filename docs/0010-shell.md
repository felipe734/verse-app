# 0010 · Shell de SaaS neutra y registro de módulos

Fecha: 2026-11-23

Decisión de Felipe: la app se ve y funciona como una SaaS profesional y neutra (referencias: Linear, Attio, Stripe, Vercel), una plataforma sobre la que corren Verse, C&C o cualquier empresa nueva. La marca Verse queda solo en los correos.

Diseño: shadcn/ui con el tema zinc, fuente Geist, radio de 8 px, claro y oscuro (next-themes) desde el inicio. Cada empresa aporta logo, nombre y un color de acento (`empresas.acento`) que se usa en el selector de empresa, el ítem activo de la barra y los botones primarios. Nada más cambia por empresa. El nombre de la plataforma sale de `PLATFORM_NAME`.

Rutas: `/[empresa]/[vertical]/[modulo]`, con la empresa activa en la URL. La vertical es su id sin el prefijo de la empresa (`verse-host` → `host`). `/todas/general/hoy` junta las empresas en Hoy y Para aprobar. Las rutas de antes (`/hoy`, `/aprobar`) redirigen.

Registro de módulos (`lib/modulos/registro.ts`): cada tipo de pantalla declara nombre, icono de lucide, segmento, fuentes de datos, si está construido y su contador. Empresas, verticales y módulos se leen de la base; cada módulo tiene un `tipo` que lo enlaza al registro. La barra lateral es registro ∩ estructura ∩ permisos: sin acceso o sin construir, no aparece. Ajustes muestra los no construidos como no disponibles.

Shell: barra lateral de 240 px que se colapsa a iconos (selector de empresa, búsqueda, módulos por vertical con contadores, Ajustes y usuario), barra superior (ruta, acciones del módulo, avisos, asistente), paleta ⌘K (módulos, pendientes, unidades, reservas, empresas) y asistente en panel derecho con ⌘J. En celular, menú deslizable y barra inferior con Hoy, Correo, Asistente, el módulo más usado y Más.

Patrones: listas densas agrupadas, acciones al pasar el mouse y deslizar en celular, detalle en panel lateral (sheet), estados vacíos con una acción, esqueletos y avisos (toast). Foco visible y navegación con teclado.

Vitrina de Playwright: con `APP_E2E=1`, fuera de Vercel y sin `DATABASE_URL`, el servidor usa Postgres en memoria (PGlite) con la estructura real y datos inventados, y la cookie `vitrina_usuario` elige el usuario de prueba. Sirve para las pruebas de permisos en el navegador y las capturas de cada PR (`CAPTURAS=nombre pnpm exec playwright test tests/e2e/capturas.spec.ts`). Nunca corre en producción.

Sin cambios en la capa de datos, la sincronización, la cola ni los permisos. La migración 0008 solo agrega `empresas.acento`, `empresas.logo` y `modulos.tipo` en Postgres.
