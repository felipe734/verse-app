import { getVercelOidcToken } from "@vercel/oidc";
import { crearAcceso } from "@/lib/google/acceso";
import { crearDrive, type Drive } from "@/lib/google/drive";
import { exigir, leerEntorno } from "@/lib/entorno";

/** Drive del respaldo con el token OIDC de Vercel; sin claves guardadas. */
export function driveRespaldo(): { drive: Drive; idUnidad: string } {
  const e = leerEntorno();
  const idUnidad = exigir(e, "RESPALDO_DRIVE_ID");
  const token = crearAcceso({
    config: {
      numeroProyecto: exigir(e, "GCP_PROJECT_NUMBER"),
      pool: exigir(e, "GCP_WORKLOAD_IDENTITY_POOL_ID"),
      proveedor: exigir(e, "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID"),
      cuentaServicio: exigir(e, "GCP_SERVICE_ACCOUNT_EMAIL"),
    },
    tokenOidc: () => getVercelOidcToken(),
  });
  return { drive: crearDrive({ token, idUnidad }), idUnidad };
}
