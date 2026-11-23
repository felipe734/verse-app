import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/db/cliente";
import { decidirEntrada } from "@/lib/acceso/entrada";
import { auditar } from "@/lib/auditoria";

/**
 * Entrada con Google (Auth.js). Solo entran usuarios activos de la app; los permisos
 * se leen de Postgres en cada petición (lib/acceso/actual.ts), no del token.
 * Variables en Vercel: AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET y AUTH_SECRET.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/entrar", error: "/entrar" },
  callbacks: {
    async signIn({ profile }) {
      const correo = typeof profile?.email === "string" ? profile.email : null;
      const r = await decidirEntrada(db(), correo, profile?.email_verified === true);
      if (!r.ok) return `/entrar?error=${r.motivo}`;
      await auditar(db(), { autor: correo!.toLowerCase(), accion: "acceso.entrada" });
      return true;
    },
    async jwt({ token, profile }) {
      if (typeof profile?.email === "string") token.email = profile.email.toLowerCase();
      return token;
    },
    async session({ session, token }) {
      if (typeof token.email === "string") session.user.email = token.email;
      return session;
    },
  },
});
