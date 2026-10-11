-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('nuevo', 'contactado', 'indeciso', 'interesado', 'negociacion', 'cerrado_ganado', 'cerrado_perdido');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('baja', 'media', 'alta');

-- CreateEnum
CREATE TYPE "InteractionOrigin" AS ENUM ('texto', 'voz');

-- CreateEnum
CREATE TYPE "FollowupStatus" AS ENUM ('pendiente', 'hecho');

-- CreateEnum
CREATE TYPE "FollowupChannel" AS ENUM ('whatsapp', 'llamada', 'email');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "leadStatus" "LeadStatus" NOT NULL DEFAULT 'nuevo',
    "temperatureScore" INTEGER NOT NULL DEFAULT 0,
    "lastContactAt" TIMESTAMP(3),
    "assignedAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "addressOrZone" TEXT NOT NULL,
    "type" TEXT,
    "price" DOUBLE PRECISION,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "contactId" TEXT,
    "propertyId" TEXT,
    "origin" "InteractionOrigin" NOT NULL,
    "rawText" TEXT NOT NULL,
    "extractedJson" JSONB NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "summary" TEXT NOT NULL,
    "agent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowupTask" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "FollowupStatus" NOT NULL DEFAULT 'pendiente',
    "suggestedMessage" TEXT NOT NULL,
    "channel" "FollowupChannel" NOT NULL DEFAULT 'whatsapp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowupTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "Property_addressOrZone_idx" ON "Property"("addressOrZone");

-- CreateIndex
CREATE UNIQUE INDEX "Interaction_idempotencyKey_key" ON "Interaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Interaction_contactId_idx" ON "Interaction"("contactId");

-- CreateIndex
CREATE INDEX "Interaction_propertyId_idx" ON "Interaction"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowupTask_interactionId_key" ON "FollowupTask"("interactionId");

-- CreateIndex
CREATE INDEX "FollowupTask_contactId_idx" ON "FollowupTask"("contactId");

-- CreateIndex
CREATE INDEX "FollowupTask_status_dueAt_idx" ON "FollowupTask"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupTask" ADD CONSTRAINT "FollowupTask_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupTask" ADD CONSTRAINT "FollowupTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
