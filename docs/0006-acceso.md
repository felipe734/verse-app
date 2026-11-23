# 0006 · Empresas, plantillas y función única de permisos

Fecha: 2026-11-22

Felipe adelantó la entrega 2 sin esperar la semana de uso de la 0 y la 1. Las noches de prueba de esas entregas siguen corriendo; la 2 no toca lo que ya funciona y hasta la entrega 5 solo entra Felipe.

Estructura: `lib/acceso/estructura.ts` trae las empresas Verse Group y C&C Group, sus verticales y módulos y sus cuentas de correo, tal como la tabla del doc. Se siembran en Postgres (`empresas`, `verticales`, `modulos`) en el build, solo lo que falta, para que lo editado en Ajustes no se pise.

Casillas (`lib/acceso/casillas.ts`): por módulo (sin, ver, editar), alcance en Hoy (todo, suyo), aprobar, correo por cuenta (sin, leer, redactar, enviar), cifras, códigos (nunca, turno, siempre) y terceros por vertical, descargar y asistente. Un acceso es usuario × empresa (`accesos`).

Plantillas (`lib/acceso/plantillas.ts`): las 6 del doc. Donde el doc no fija un nivel:
- Correo: "enviar" para Administrador Verse; "redactar" para las demás.
- Aprobar, Descargar y Asistente: apagados; solo el Maestro.
- Hoy: "editar", con alcance según la plantilla.
Todo se ajusta por persona en Ajustes.

Función única (`lib/acceso/permisos.ts`): `nivel`, `puede`, `exigir`, `empresasVisibles`, `modulosVisibles`, `alcanceHoy`, `puedeAprobar`, `nivelCorreo`, `sensibles`, `limpiar` y `filtrarSuyo`. Usuario suspendido o invitado no ve nada, ni siendo Maestro. Un módulo solo cuenta dentro de su empresa. `limpiar` borra del objeto los montos, datos de terceros y códigos antes de responder; no viajan ocultos.

Sesión: `sesionDe` la arma desde Postgres en cada petición, así un cambio de casillas o una suspensión aplica en la siguiente acción.

Maestro: sale de `MAESTRO_CORREO` en Vercel; el correo no va en el repo.

Prueba por plantilla (`tests/unit/permisos.test.ts`): cada plantilla contra cada módulo, con el nivel exacto del doc; Aseo no ve nada fuera de su ruta; nadie sin C&C ve algo de C&C.
