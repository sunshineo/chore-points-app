import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { evaluateAndAwardBadges } from '../src/lib/badge-evaluator';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find Jasper
  const jasper = await prisma.user.findFirst({
    where: { name: { contains: 'Jasper', mode: 'insensitive' } }
  });

  if (!jasper || !jasper.familyId) {
    console.log('Jasper not found');
    return;
  }

  console.log('Found Jasper:', jasper.id, jasper.name);
  console.log('Family ID:', jasper.familyId);

  // Run the badge evaluator to award any earned badges
  console.log('\nEvaluating badges...');
  const newBadges = await evaluateAndAwardBadges(prisma, jasper.id, jasper.familyId);

  if (newBadges.length === 0) {
    console.log('No new badges to award (might already have them all)');
  } else {
    console.log('\nAwarded badges:');
    newBadges.forEach(b => {
      console.log(`  ${b.icon} ${b.name} - ${b.description}`);
    });
  }

  // Also backfill chore badges based on point entries
  console.log('\nBackfilling chore badges...');

  const choreCompletions = await prisma.pointEntry.groupBy({
    by: ['choreId'],
    where: {
      kidId: jasper.id,
      choreId: { not: null },
      points: { gt: 0 },
    },
    _count: { id: true },
  });

  for (const completion of choreCompletions) {
    if (!completion.choreId) continue;

    const count = completion._count.id;

    // Calculate level based on count
    let level = 0;
    if (count >= 50) level = 6;
    else if (count >= 40) level = 5;
    else if (count >= 30) level = 4;
    else if (count >= 20) level = 3;
    else if (count >= 10) level = 2;
    else if (count >= 1) level = 1;

    // Upsert the badge
    const badge = await prisma.badge.upsert({
      where: {
        kidId_choreId: { kidId: jasper.id, choreId: completion.choreId },
      },
      create: {
        familyId: jasper.familyId,
        kidId: jasper.id,
        choreId: completion.choreId,
        count,
        level,
        firstEarnedAt: new Date(),
        lastLevelUpAt: new Date(),
      },
      update: {
        count,
        level,
      },
      include: { chore: true },
    });

    console.log(`  ${badge.chore.icon || '✨'} ${badge.chore.title}: Level ${level} (${count} times)`);
  }

  console.log('\nDone!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
