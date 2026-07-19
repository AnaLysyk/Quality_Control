ALTER TABLE "users"
ADD COLUMN "created_by_company_id" TEXT,
ADD COLUMN "home_company_id" TEXT,
ADD COLUMN "user_origin" TEXT NOT NULL DEFAULT 'testing_company',
ADD COLUMN "user_scope" TEXT NOT NULL DEFAULT 'shared',
ADD COLUMN "allow_multi_company_link" BOOLEAN NOT NULL DEFAULT true;
