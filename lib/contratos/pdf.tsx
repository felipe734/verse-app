import "server-only";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer, type Styles } from "@react-pdf/renderer";
import { bloques, type Bloque, type ModeloLleno } from "./llenar";

/**
 * PDF del contrato con el formato de empresa de verse-legal: Gantari para la voz, IBM Plex Mono
 * para rótulos, tinta dominante, un punto Señal, márgenes de 20 mm, cláusulas justificadas,
 * firmas a dos columnas y "Página X de Y". Las fuentes (OFL) viven en lib/contratos/fuentes.
 */

const DIR = path.join(process.cwd(), "lib/contratos/fuentes");
let registradas = false;
function registrar() {
  if (registradas) return;
  Font.register({
    family: "Gantari",
    fonts: [
      { src: path.join(DIR, "gantari-latin-400-normal.ttf"), fontWeight: 400 },
      { src: path.join(DIR, "gantari-latin-600-normal.ttf"), fontWeight: 600 },
      { src: path.join(DIR, "gantari-latin-700-normal.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Plex",
    fonts: [
      { src: path.join(DIR, "ibm-plex-mono-latin-400-normal.ttf"), fontWeight: 400 },
      { src: path.join(DIR, "ibm-plex-mono-latin-500-normal.ttf"), fontWeight: 500 },
    ],
  });
  // Sin guiones de división: el texto debe quedar idéntico al modelo para la revisión de verse-docs.
  Font.registerHyphenationCallback((p) => [p]);
  registradas = true;
}

const C = { tinta: "#002448", suave: "#4A5A70", linea: "#D6DAE1", senal: "#FF6501" };
const NOTA =
  "Documento firmado electrónicamente conforme a la Ley 527 de 1999 y al Decreto 2364 de 2012 (compilado en el Decreto 1074 de 2015). La identidad de los firmantes y la fecha y hora de cada firma constan en el certificado de firma electrónica que forma parte integral de este documento.";

const e = StyleSheet.create({
  pagina: { fontFamily: "Gantari", fontSize: 9.5, color: C.tinta, paddingTop: 70, paddingBottom: 60, paddingHorizontal: 57, lineHeight: 1.42 },
  encabezado: { position: "absolute", top: 28, left: 57, right: 57, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: C.linea, paddingBottom: 6 },
  marca: { flexDirection: "row", alignItems: "center", gap: 5 },
  punto: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.senal },
  rotuloMono: { fontFamily: "Plex", fontSize: 7, color: C.suave, letterSpacing: 0.6 },
  pie: { position: "absolute", bottom: 28, left: 57, right: 57, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: C.linea, paddingTop: 6 },
  rotulo: { fontFamily: "Plex", fontSize: 7.5, color: C.suave, letterSpacing: 0.8, marginBottom: 4 },
  titulo: { fontSize: 17, fontWeight: 700, marginBottom: 14 },
  seccion: { fontFamily: "Plex", fontSize: 8, fontWeight: 500, color: C.suave, letterSpacing: 1, marginTop: 10, marginBottom: 8 },
  parrafo: { textAlign: "justify", marginBottom: 7 },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.linea, paddingVertical: 4 },
  grupo: { fontFamily: "Plex", fontSize: 7.5, fontWeight: 500, color: C.suave, letterSpacing: 0.8, paddingTop: 9, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: C.tinta },
  celdaA: { width: "34%", paddingRight: 8, color: C.suave },
  celdaB: { width: "66%" },
  nota: { fontSize: 8, color: C.suave, marginTop: 10, marginBottom: 18, textAlign: "justify" },
  firmas: { flexDirection: "row", gap: 28, marginTop: 6 },
  firma: { flex: 1 },
  lineaFirma: { borderTopWidth: 0.7, borderTopColor: C.tinta, marginTop: 34, paddingTop: 4, fontWeight: 600 },
});

type EstiloTexto = Styles[string];

/** "**PRIMERA. OBJETO.** texto" con negrillas. */
function Rico({ texto, estilo }: { texto: string; estilo: EstiloTexto }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/).filter(Boolean);
  return (
    <Text style={estilo}>
      {partes.map((p, i) => (p.startsWith("**") ? <Text key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</Text> : p))}
    </Text>
  );
}

function Bloques({ lista }: { lista: Bloque[] }) {
  return (
    <>
      {lista.map((b, i) => {
        switch (b.tipo) {
          case "titulo":
            return <Text key={i} style={e.titulo}>{b.texto}</Text>;
          case "seccion":
            return <Text key={i} style={e.seccion} minPresenceAhead={40}>{b.texto}</Text>;
          case "parrafo":
          case "numeral":
            return <Rico key={i} texto={b.texto} estilo={e.parrafo} />;
          case "vineta":
            return <Rico key={i} texto={`•  ${b.texto}`} estilo={{ ...e.parrafo, paddingLeft: 10 }} />;
          case "salto":
            return <View key={i} break />;
          case "nota":
            return <Text key={i} style={e.nota}>{NOTA}</Text>;
          case "tabla":
            return (
              <View key={i} style={{ marginBottom: 12 }}>
                {b.filas.map((f, j) =>
                  "grupo" in f ? (
                    <Text key={j} style={e.grupo} minPresenceAhead={30}>{f.grupo.toUpperCase()}</Text>
                  ) : (
                    <View key={j} style={e.fila} wrap={false}>
                      <Rico texto={f.celdas[0]} estilo={e.celdaA} />
                      <Rico texto={f.celdas[1]} estilo={e.celdaB} />
                    </View>
                  ),
                )}
              </View>
            );
          case "firmas":
            return (
              <View key={i} style={e.firmas} wrap={false}>
                {[0, 1].map((col) => (
                  <View key={col} style={e.firma}>
                    {b.filas.map((f, j) => (
                      <Text key={j} style={j === 0 ? e.rotulo : j === 1 ? e.lineaFirma : { fontSize: 8.5, color: C.suave }}>
                        {f[col]}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            );
        }
      })}
    </>
  );
}

/** `desde` solo sirve para revisar a ojo un tramo del documento en pruebas. */
export async function pdfContrato(m: ModeloLleno, desde = 0): Promise<Buffer> {
  registrar();
  const doc = (
    <Document title={m.meta.titulo} author={m.meta.emisor} creator="Verse App" language="es">
      <Page size="LETTER" style={e.pagina}>
        <View style={e.encabezado} fixed>
          <View style={e.marca}>
            <View style={e.punto} />
            <Text style={e.rotuloMono}>{m.meta.emisor}</Text>
          </View>
          <Text style={e.rotuloMono}>{(m.meta.tipo ?? "").toUpperCase()}</Text>
        </View>
        {m.meta.rotulo && <Text style={e.rotulo}>{m.meta.rotulo.toUpperCase()}</Text>}
        <Bloques lista={bloques(m.texto).slice(desde)} />
        <View style={e.pie} fixed>
          <Text style={e.rotuloMono}>{m.meta.pie}</Text>
          <Text style={e.rotuloMono} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
