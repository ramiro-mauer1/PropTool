-- CreateEnum
CREATE TYPE "CaptacionEstado" AS ENUM ('nuevo', 'contactado', 'respondio', 'tasacion', 'captado', 'descartado', 'cerrado');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "currency" TEXT;

-- CreateTable
CREATE TABLE "Captacion" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "portal" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "precio" DOUBLE PRECISION,
    "moneda" TEXT,
    "m2Cubiertos" DOUBLE PRECISION,
    "m2Total" DOUBLE PRECISION,
    "ambientes" DOUBLE PRECISION,
    "direccion" TEXT,
    "localidad" TEXT NOT NULL,
    "partido" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "anunciante" TEXT,
    "telefono" TEXT,
    "tieneWhatsappEnPortal" BOOLEAN,
    "fotoUrl" TEXT,
    "score" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "senales" TEXT[],
    "barrioPrivado" BOOLEAN NOT NULL DEFAULT false,
    "problemasAviso" TEXT[],
    "borradorMensaje" TEXT,
    "diasPublicado" INTEGER,
    "visitas" INTEGER,
    "fechaPublicacion" DATE,
    "descripcion" TEXT,
    "estado" "CaptacionEstado" NOT NULL DEFAULT 'nuevo',
    "notas" TEXT,
    "estadoActualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "telefonoAdquiridoEn" TIMESTAMP(3),
    "telefonoIntentadoEn" TIMESTAMP(3),
    "telefonoCompraIniciadaEn" TIMESTAMP(3),
    "primeraVezVista" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVezVista" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corridaId" TEXT NOT NULL,
    "contactId" TEXT,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Captacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Captacion_clave_key" ON "Captacion"("clave");

-- CreateIndex
CREATE INDEX "Captacion_estado_score_idx" ON "Captacion"("estado", "score");

-- CreateIndex
CREATE INDEX "Captacion_estadoActualizadoEn_idx" ON "Captacion"("estadoActualizadoEn");

-- CreateIndex
CREATE INDEX "Captacion_partido_idx" ON "Captacion"("partido");

-- CreateIndex
CREATE INDEX "Captacion_contactId_idx" ON "Captacion"("contactId");

-- CreateIndex
CREATE INDEX "Captacion_propertyId_idx" ON "Captacion"("propertyId");

-- AddForeignKey
ALTER TABLE "Captacion" ADD CONSTRAINT "Captacion_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Captacion" ADD CONSTRAINT "Captacion_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Keep the table out of Supabase's public Data API (anon/authenticated keys).
-- With RLS on and no policies those roles get nothing; Prisma connects as the
-- table owner, which bypasses RLS, so the app is unaffected.
ALTER TABLE "Captacion" ENABLE ROW LEVEL SECURITY;
