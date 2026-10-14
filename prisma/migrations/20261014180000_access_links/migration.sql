-- Own one-time links for /acceso (see AccessLink in schema.prisma).

-- CreateTable
CREATE TABLE "AccessLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),

    CONSTRAINT "AccessLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessLink_tokenHash_key" ON "AccessLink"("tokenHash");

-- CreateIndex
CREATE INDEX "AccessLink_email_idx" ON "AccessLink"("email");


-- Same lockdown as every other table (see security_hardening): only Prisma,
-- as the table owner, ever touches it.
ALTER TABLE "AccessLink" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AccessLink" FROM anon, authenticated;
