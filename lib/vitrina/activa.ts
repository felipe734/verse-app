/**
 * Modo vitrina: solo para las pruebas y capturas de Playwright. Postgres en memoria con datos
 * inventados y una sesión de prueba. Nunca corre en Vercel ni donde haya una base real.
 */
export const esVitrina = () => process.env.APP_E2E === "1" && !process.env.VERCEL && !process.env.DATABASE_URL;

export const COOKIE_VITRINA = "vitrina_usuario";
export const MAESTRO_VITRINA = "maestro@vitrina.test";
