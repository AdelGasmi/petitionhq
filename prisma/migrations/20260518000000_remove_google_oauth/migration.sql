-- Remove Google OAuth: drop the unique constraint and the googleId column.
-- Dropping the column would cascade-drop the constraint, but being explicit
-- makes the intent clear.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_googleId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "googleId";
