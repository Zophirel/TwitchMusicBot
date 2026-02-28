-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TwitchAuth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TwitchAuth" ("accessToken", "expiresAt", "id", "refreshToken", "scope", "updatedAt") SELECT "accessToken", "expiresAt", "id", "refreshToken", "scope", "updatedAt" FROM "TwitchAuth";
DROP TABLE "TwitchAuth";
ALTER TABLE "new_TwitchAuth" RENAME TO "TwitchAuth";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
