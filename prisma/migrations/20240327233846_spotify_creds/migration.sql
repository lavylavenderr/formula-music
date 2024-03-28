-- CreateTable
CREATE TABLE "SpotifyCreds" (
    "discordId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SpotifyCreds_discordId_key" ON "SpotifyCreds"("discordId");

-- AddForeignKey
ALTER TABLE "SpotifyCreds" ADD CONSTRAINT "SpotifyCreds_discordId_fkey" FOREIGN KEY ("discordId") REFERENCES "User"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;
