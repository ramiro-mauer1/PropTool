-- "Solicitar acceso": requests the owner approves from the app.

-- CreateEnum
CREATE TYPE "AccessRequestEstado" AS ENUM ('pendiente', 'aprobada', 'rechazada');

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "estado" "AccessRequestEstado" NOT NULL DEFAULT 'pendiente',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididaEn" TIMESTAMP(3),
    "decididaPor" TEXT,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_email_key" ON "AccessRequest"("email");

-- CreateIndex
CREATE INDEX "AccessRequest_estado_creadaEn_idx" ON "AccessRequest"("estado", "creadaEn");

-- Same lockdown as every other table (see security_hardening): only Prisma,
-- as the table owner, ever touches it. The default privileges already keep
-- anon/authenticated out; this is explicit so it doesn't hinge on them.
ALTER TABLE "AccessRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AccessRequest" FROM anon, authenticated;
