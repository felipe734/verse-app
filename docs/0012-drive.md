# 0012 · Drive para adjuntar en el correo

Último pedazo de la entrega 4.

## Decisión

- Drive entra por Composio, igual que Gmail. Es una sola cuenta conectada con alias `verse-drive`.
- Busca y adjunta todo el que envía correo desde al menos una cuenta (`puedeDrive`). Lo decidió Felipe el 2026-11-23.
- Solo lectura: la app nunca crea, mueve ni comparte archivos en Drive.

## Cómo funciona

1. El asistente busca con `buscar_drive`. La búsqueda va por nombre o contenido, sin carpetas ni papelera, y trae máximo 10 resultados.
2. `proponer_correo` recibe `adjuntos: [{ id, nombre }]`, hasta 5, y la tarjeta muestra los nombres.
3. Cuando la persona confirma:
   1. Se descarga el archivo con `GOOGLEDRIVE_DOWNLOAD_FILE`.
   2. Se bajan los bytes del almacenamiento de Composio. Solo se acepta un s3url de ese almacenamiento.
   3. Se pide la subida con `POST /api/v3.1/files/upload/request`, que lleva toolkit gmail, la herramienta exacta, el nombre, el mimetype y el md5.
   4. Se hace PUT al enlace firmado.
   5. El correo sale con el `s3key` en `attachment`.
4. Si algo falla, el archivo va como enlace de Drive al final del texto y el resultado lo dice ("con 1 como enlace de Drive"). Eso pasa si Drive no está conectado, si el archivo supera los 18 MB en total o si hay un error. Así el correo nunca sale sin el archivo y nunca adjunta uno distinto al pedido.
5. AUDITORIA guarda los nombres de lo que fue adjunto y de lo que fue enlace.

## Para activarlo

Conectar Google Drive en Composio, en el mismo proyecto de la API key, con alias `verse-drive`. Mientras no esté conectado, `buscar_drive` responde que falta la cuenta.
