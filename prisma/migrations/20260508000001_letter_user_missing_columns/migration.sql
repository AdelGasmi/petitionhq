-- Letter: review flow columns
ALTER TABLE "Letter"
  ADD COLUMN IF NOT EXISTS "reviewToken"       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "reviewTokenExpiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewerViewed"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewerSubmitted" TIMESTAMP(3);

-- User: verification, plan, OAuth, Stripe, invite columns
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "verified"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verifyCode"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifyExpiry"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "plan"              TEXT,
  ADD COLUMN IF NOT EXISTS "draftBudget"       INTEGER,
  ADD COLUMN IF NOT EXISTS "inviteToken"       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "inviteExpiry"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "googleId"          TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId"  TEXT UNIQUE;
