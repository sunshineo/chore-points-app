import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Define interesting badge levels for visual variety
const badgeUpdates = [
  { choreTitle: 'Brush teeth', count: 55, level: 6 },      // Super ⭐
  { choreTitle: 'Clean toys', count: 35, level: 4 },       // Gold 🥇
  { choreTitle: 'Take shower', count: 22, level: 3 },      // Silver 🥈
  { choreTitle: 'Wear pajama', count: 15, level: 2 },      // Bronze 🥉
  { choreTitle: 'Wear your own clothes', count: 8, level: 1 },  // Starter 🌱
  { choreTitle: 'Great art', count: 42, level: 5 },        // Platinum 💎
];

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

  // Get all chores for reference
  const chores = await prisma.chore.findMany({
    where: { familyId: jasper.familyId }
  });

  console.log('\nUpdating badge levels for visual variety...\n');

  for (const update of badgeUpdates) {
    const chore = chores.find(c =>
      c.title.toLowerCase().includes(update.choreTitle.toLowerCase())
    );

    if (!chore) {
      console.log(`  Chore "${update.choreTitle}" not found, skipping`);
      continue;
    }

    const badge = await prisma.badge.upsert({
      where: {
        kidId_choreId: { kidId: jasper.id, choreId: chore.id },
      },
      create: {
        familyId: jasper.familyId,
        kidId: jasper.id,
        choreId: chore.id,
        count: update.count,
        level: update.level,
        firstEarnedAt: new Date(),
        lastLevelUpAt: new Date(),
      },
      update: {
        count: update.count,
        level: update.level,
        lastLevelUpAt: new Date(),
      },
    });

    const levelNames = ['', 'Starter 🌱', 'Bronze 🥉', 'Silver 🥈', 'Gold 🥇', 'Platinum 💎', 'Super ⭐'];
    console.log(`  ${chore.icon || '✨'} ${chore.title}: ${levelNames[update.level]} (${update.count} times)`);
  }

  console.log('\nDone! Refresh the page to see the updated badges.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
