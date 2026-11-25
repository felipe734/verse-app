-- Rediseño R7: Contratos de Living pasa a "Generación de contratos" (lo que hay que elaborar y firmar).
-- Solo si nadie lo renombró en Ajustes.
UPDATE "modulos" SET "nombre" = 'Generación de contratos', "descripcion" = 'Contratos por elaborar, firmar y firmados' WHERE "id" = 'living-contratos' AND "nombre" = 'Contratos';
