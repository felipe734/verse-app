# 0013 · Finanzas de Verse y de C&C

Cierra los módulos de la entrega 5. Por decisión de Felipe (2026-11-23), Balcony PH y Diseño y compras no se construyen.

## Qué es

Finanzas es un módulo con pestañas. Cada pestaña es una tabla de Airtable que se lee en el momento (`lib/modulos/finanzas.ts`) y solo se lee la pestaña abierta. Usa el mismo motor que los módulos de tabla: un monto sale solo si la persona tiene la casilla de cifras y un tercero solo si tiene la de terceros. Los números de cuenta, las cédulas y las certificaciones bancarias no se piden nunca.

**Verse**
- Arriba va el cierre del último mes de AGREGADO: ingresos, contribución, overhead y margen neto, con el cambio frente al mes anterior. Solo aparece con la casilla de cifras de General.
- Las pestañas son:

| Pestaña | Tabla | Qué muestra |
|---|---|---|
| Movimientos | 1. VL PRIVADO / MOVIMIENTOS | Últimos 45 días |
| Extractos | 1. VL PRIVADO / EXTRACTOS | |
| Cruces | 2. FACTURACION / CRUCES | |
| Overhead | 1. VL PRIVADO / OVERHEAD | |
| Caja menor | 3. ADMIN / CAJA MENOR VERSE | Últimos 60 días |
| Caja global | 4. CAJA MENOR / MOVIMIENTOS VERSE | Últimos 60 días |
| Fondeos | 4. CAJA MENOR / GLOBAL VERSE | |
| Reportes | 1. VL PRIVADO / REPORTES | |

**C&C**

| Pestaña | Tabla | Qué muestra |
|---|---|---|
| Pagos | 2. CONTABILIDAD / BANCOS | |
| Extractos | 2. CONTABILIDAD / EXTRACTOS | |
| Caja | 4. CAJA MENOR / MOVIMIENTOS C&C | |
| Fondeos | 4. CAJA MENOR / GLOBAL C&C | |
| Referencias bancarias | 1. C&C GROUP / REFERENCIAS BANCARIAS | Sin el número de cuenta |

## Pendiente

- El plan habla del cierre "contra la meta". OBJETIVOS no trae una meta de margen por mes que se pueda cruzar sin adivinar, así que por ahora la comparación es contra el mes anterior.
