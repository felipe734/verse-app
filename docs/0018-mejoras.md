# 0018 · Plan de mejoras (aprobado por Felipe el 2026-11-23)

Regla general: **todo abre en lo actual y en lo tuyo**.

## 1. "Lo mío" por defecto

- Los módulos que tienen un campo de persona lo declaran en `persona` de `DefTabla`: Limpiezas (Funcionario), Equipo (Funcionaria), Comercial Host (SDR) y Caja menor de Verse (Persona).
- Quien tiene alcance "lo suyo" en su plantilla abre en **Mío**. El Maestro y quien tiene alcance "todo" abren en **Todo**. El interruptor cambia entre los dos y deja `?quien=` en la URL solo cuando no es el valor por defecto.
- La persona se reconoce por su Nombre en Airtable, sin tildes ni mayúsculas y por su primer nombre, porque en Airtable el mismo nombre aparece escrito de varias formas (`lib/vistas/mio.ts`).
- Es un filtro de comodidad, no de permisos: quien tiene el módulo puede ver Todo.
