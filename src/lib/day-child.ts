import { prisma } from "@/lib/db";

export function getDayKid() {
  return prisma.user.findFirst({
    select: { id: true, name: true },
  });
}
