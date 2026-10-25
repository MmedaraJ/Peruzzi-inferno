-- CreateTable
CREATE TABLE "Config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "device" TEXT,
    "props" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notebook" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "ip" TEXT,
    "name" TEXT,
    "city" TEXT,
    "card" BYTEA,
    "backOf" TEXT,
    "tracklistAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "dear" TEXT NOT NULL,
    "thing" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'asked',
    "kind" TEXT,
    "line" TEXT,
    "peruzzi" TEXT,
    "escape" TEXT,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "flags" TEXT[],
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "card" BYTEA,
    "answerCard" BYTEA,
    "model" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "cacheRead" INTEGER NOT NULL DEFAULT 0,
    "cacheWrite" INTEGER NOT NULL DEFAULT 0,
    "ms" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "askedAt" TIMESTAMP(3),

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "marketingAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "device" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ask" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "senderEmail" TEXT,
    "senderName" TEXT NOT NULL,
    "senderDevice" TEXT,
    "recipientName" TEXT,
    "recipientHash" TEXT,
    "recipientMask" TEXT,
    "status" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "backAt" TIMESTAMP(3),
    "backNotebookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "VoiceClip" (
    "key" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceClip_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "VoiceLine" (
    "key" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceLine_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Sound" (
    "key" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sound_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AiUse" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "cacheRead" INTEGER NOT NULL DEFAULT 0,
    "cacheWrite" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_name_at_idx" ON "Event"("name", "at");

-- CreateIndex
CREATE INDEX "Event_at_idx" ON "Event"("at");

-- CreateIndex
CREATE UNIQUE INDEX "Notebook_code_key" ON "Notebook"("code");

-- CreateIndex
CREATE INDEX "Notebook_device_createdAt_idx" ON "Notebook"("device", "createdAt");

-- CreateIndex
CREATE INDEX "Notebook_ip_createdAt_idx" ON "Notebook"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "Notebook_createdAt_idx" ON "Notebook"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Note_seq_key" ON "Note"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "Note_code_key" ON "Note"("code");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE INDEX "Note_kind_idx" ON "Note"("kind");

-- CreateIndex
CREATE INDEX "Note_answer_idx" ON "Note"("answer");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "EmailCode_email_createdAt_idx" ON "EmailCode"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ask_code_key" ON "Ask"("code");

-- CreateIndex
CREATE INDEX "Ask_senderDevice_createdAt_idx" ON "Ask"("senderDevice", "createdAt");

-- CreateIndex
CREATE INDEX "Ask_senderEmail_createdAt_idx" ON "Ask"("senderEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Ask_recipientHash_createdAt_idx" ON "Ask"("recipientHash", "createdAt");

-- CreateIndex
CREATE INDEX "AiUse_at_idx" ON "AiUse"("at");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ask" ADD CONSTRAINT "Ask_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
