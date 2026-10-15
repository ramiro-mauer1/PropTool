-- Historial de cambios de una captación (ver CaptacionEvento en schema.prisma).
-- Solo agrega: una tabla nueva, sus índices y su FK. No toca datos existentes.

-- CreateTable
CREATE TABLE "CaptacionEvento" (
    "id" TEXT NOT NULL,
    "captacionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estadoAnterior" "CaptacionEstado",
    "estadoNuevo" "CaptacionEstado",
    "notasCambiaron" BOOLEAN NOT NULL DEFAULT false,
    "usuarioId" TEXT,
    "usuarioEmail" TEXT,
    "usuarioNombre" TEXT,
    "origen" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptacionEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaptacionEvento_captacionId_creadoEn_idx" ON "CaptacionEvento"("captacionId", "creadoEn");

-- CreateIndex
CREATE INDEX "CaptacionEvento_usuarioId_idx" ON "CaptacionEvento"("usuarioId");

-- AddForeignKey
ALTER TABLE "CaptacionEvento" ADD CONSTRAINT "CaptacionEvento_captacionId_fkey" FOREIGN KEY ("captacionId") REFERENCES "Captacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Same lockdown as every other table (see security_hardening): only Prisma,
-- as the table owner, ever touches it.
ALTER TABLE "CaptacionEvento" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CaptacionEvento" FROM anon, authenticated;
