-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "hueAccessToken" TEXT;
ALTER TABLE "Family" ADD COLUMN     "hueRefreshToken" TEXT;
ALTER TABLE "Family" ADD COLUMN     "hueTokenExpiry" TIMESTAMP(3);
ALTER TABLE "Family" ADD COLUMN     "hueUsername" TEXT;
