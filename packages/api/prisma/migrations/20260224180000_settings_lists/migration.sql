-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "allowAnyone" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "Settings" ADD COLUMN "whitelistJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Settings" ADD COLUMN "blacklistJson" TEXT NOT NULL DEFAULT '[]';
