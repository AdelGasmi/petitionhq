-- Add phone column to User table (was in schema but missing from initial migration)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
