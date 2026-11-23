import type { Metadata } from "next";
import Link from "next/link";
import { Marco } from "@/components/marco";

export const metadata: Metadata = {
  title: "Política de privacidad · Verse App",
  description: "Qué datos recoge Verse App, para qué los usa, dónde se guardan y cómo ejercer tus derechos",
};

const ACTUALIZADA = "22 de noviembre de 2026";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium text-foreground">{titulo}</h2>
      {children}
    </section>
  );
}

/** Página pública: la enlaza la pantalla de consentimiento de Google. No requiere entrar. */
export default function Privacidad() {
  return (
    <Marco rotulo={`ACTUALIZADA EL ${ACTUALIZADA.toUpperCase()}`} titulo="Política de privacidad">
      <p>
        Esta política explica qué datos recoge Verse App, para qué los usa, dónde se guardan, cuánto tiempo se conservan y cómo
        puedes ejercer tus derechos. Verse App es una aplicación interna de Verse Group y C&amp;C Group, en Bogotá, Colombia. Solo
        pueden usarla las personas que la empresa invita.
      </p>

      <Seccion titulo="1. Responsable">
        <p>
          El responsable del tratamiento es Verse Group, en Bogotá, Colombia. Para cualquier pregunta o solicitud sobre tus datos
          escribe a{" "}
          <a className="underline underline-offset-2 hover:text-foreground" href="mailto:contacto@verseliving.com">
            contacto@verseliving.com
          </a>
          .
        </p>
      </Seccion>

      <Seccion titulo="2. Datos que recogemos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>De tu cuenta de Google</b>, al entrar con Google: nombre, dirección de correo y foto de perfil. Usamos solo los
            permisos básicos de identidad (openid, email y profile).
          </li>
          <li>
            <b>Datos que registra la empresa al invitarte</b>: nombre, correo, celular, empresas y módulos a los que tienes acceso.
          </li>
          <li>
            <b>Registro de uso</b>: cada cambio que haces en la app (qué, cuándo, valor antes y después) y la fecha de tu último
            ingreso.
          </li>
          <li>
            <b>Datos técnicos</b>: registros del servidor (fecha, ruta, resultado) necesarios para operar y proteger la app.
          </li>
        </ul>
        <p>No accedemos a tu Gmail, tus archivos de Drive, tu calendario ni tus contactos.</p>
      </Seccion>

      <Seccion titulo="3. Para qué los usamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Confirmar que tienes una invitación activa y darte acceso solo a lo que tu rol permite.</li>
          <li>Mostrar tu nombre en la app y asignarte tus pendientes.</li>
          <li>Dejar rastro de quién hizo cada acción, como control interno de la operación.</li>
          <li>Proteger la app contra accesos no autorizados.</li>
        </ul>
        <p>No usamos tus datos para publicidad, no los vendemos y no creamos perfiles comerciales.</p>
      </Seccion>

      <Seccion titulo="4. Datos de Google">
        <p>
          El uso que Verse App hace de la información recibida de las API de Google cumple la{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            rel="noreferrer"
            target="_blank"
          >
            Política de datos de usuario de los servicios de API de Google
          </a>
          , incluidos los requisitos de uso limitado. Los datos de Google solo se usan para identificarte dentro de la app y no se
          transfieren a terceros salvo a los proveedores que la hacen funcionar.
        </p>
      </Seccion>

      <Seccion titulo="5. Dónde se guardan y con quién se comparten">
        <p>Los datos se guardan en proveedores que procesan información por cuenta de la empresa:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Vercel: alojamiento de la app.</li>
          <li>Neon: base de datos de la app.</li>
          <li>Airtable: datos del negocio.</li>
          <li>Google: entrada con Google y respaldos en Google Drive.</li>
        </ul>
        <p>Algunos de estos proveedores guardan datos fuera de Colombia, con medidas de seguridad equivalentes.</p>
      </Seccion>

      <Seccion titulo="6. Cuánto tiempo los conservamos">
        <p>
          Tus datos de cuenta se conservan mientras tengas acceso. Si tu acceso se suspende, el registro de lo que hiciste se
          conserva como soporte de la operación de la empresa. Los respaldos se guardan 30 días (diarios) y 12 meses (mensuales).
        </p>
      </Seccion>

      <Seccion titulo="7. Seguridad">
        <p>
          El acceso se decide en el servidor según tu rol, las conexiones van cifradas y las claves se guardan fuera del código. Solo
          entran personas invitadas, y la empresa puede suspender un acceso en cualquier momento.
        </p>
      </Seccion>

      <Seccion titulo="8. Tus derechos">
        <p>
          Conforme a la Ley 1581 de 2012 de Colombia puedes conocer, actualizar, corregir y pedir la eliminación de tus datos
          personales, y revocar la autorización. También puedes quitar el acceso de Verse App a tu cuenta desde la configuración de
          seguridad de Google. Escribe a{" "}
          <a className="underline underline-offset-2 hover:text-foreground" href="mailto:contacto@verseliving.com">
            contacto@verseliving.com
          </a>{" "}
          y responderemos en los plazos de la ley.
        </p>
      </Seccion>

      <Seccion titulo="9. Cambios">
        <p>Si esta política cambia, actualizaremos la fecha de arriba y avisaremos a las personas con acceso.</p>
      </Seccion>

      <p className="pt-2">
        <Link className="underline underline-offset-2 hover:text-foreground" href="/">
          Volver al inicio
        </Link>
      </p>
    </Marco>
  );
}
