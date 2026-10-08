-- AlterTable
ALTER TABLE "Captacion" ADD COLUMN     "abiertoACorredores" BOOLEAN,
ADD COLUMN     "analizadoPor" TEXT,
ADD COLUMN     "anguloEnviado" TEXT,
ADD COLUMN     "captadoEn" TIMESTAMP(3),
ADD COLUMN     "enviadoEn" TIMESTAMP(3),
ADD COLUMN     "mensajeEnviado" TEXT,
ADD COLUMN     "otrosPortales" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rechazaInmobiliarias" BOOLEAN,
ADD COLUMN     "republicado" BOOLEAN,
ADD COLUMN     "respondioEn" TIMESTAMP(3),
ADD COLUMN     "senalesFuertes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Captacion_anguloEnviado_idx" ON "Captacion"("anguloEnviado");


-- Backfill: captaciones that already advanced keep their milestone.
UPDATE "Captacion" SET "respondioEn" = "estadoActualizadoEn" WHERE "estado" IN ('respondio', 'tasacion', 'captado');
UPDATE "Captacion" SET "captadoEn" = "estadoActualizadoEn" WHERE "estado" = 'captado';
