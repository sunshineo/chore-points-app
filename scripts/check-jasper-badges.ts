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

async function main() {
  // Find Jasper
  const jasper = await prisma.user.findFirst({
    where: { name: { contains: 'Jasper', mode: 'insensitive' } }
  });

  if (!jasper) {
    console.log('Jasper not found');
    return;
  }

  console.log('Found Jasper:', jasper.id, jasper.name);
  console.log('Family ID:', jasper.familyId);

  // Get his point entries
  const entries = await prisma.pointEntry.findMany({
    where: { kidId: jasper.id },
    include: { chore: true },
    orderBy: { date: 'desc' }
  });

  console.log('\nTotal point entries:', entries.length);

  // Calculate total points
  const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);
  console.log('Total points:', totalPoints);

  // Get unique chores completed
  const uniqueChores = new Set(entries.filter(e => e.choreId && e.points > 0).map(e => e.choreId));
  console.log('Unique chores completed:', uniqueChores.size);

  // Count chore completions (positive points with choreId)
  const choreCompletions = entries.filter(e => e.choreId && e.points > 0).length;
  console.log('Total chore completions:', choreCompletions);

  // Get daily totals
  const dailyTotals: Record<string, number> = {};
  entries.forEach(e => {
    const dateKey = e.date.toISOString().split('T')[0];
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + e.points;
  });

  console.log('\nDaily totals:');
  Object.entries(dailyTotals).sort().forEach(([date, pts]) => {
    console.log('  ', date, ':', pts, 'pts', pts >= 10 ? '✓' : '');
  });

  // Check for streaks (days with 10+ points)
  const daysWithTenPlus = Object.entries(dailyTotals)
    .filter(([_, pts]) => pts >= 10)
    .map(([date, _]) => date)
    .sort();

  console.log('\nDays with 10+ points:', daysWithTenPlus.length);

  // Calculate longest streak
  let longestStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of daysWithTenPlus) {
    const currentDate = new Date(dateStr);
    if (prevDate) {
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
    prevDate = currentDate;
  }

  console.log('Longest streak of 10+ pts/day:', longestStreak, 'days');

  // Check existing badges
  const choreBadges = await prisma.badge.findMany({
    where: { kidId: jasper.id },
    include: { chore: true }
  });
  console.log('\nExisting chore badges:', choreBadges.length);
  choreBadges.forEach(b => console.log('  -', b.chore.title, '- Level', b.level, '(', b.count, 'times)'));

  const achievementBadges = await prisma.achievementBadge.findMany({
    where: { kidId: jasper.id }
  });
  console.log('\nExisting achievement badges:', achievementBadges.length);
  achievementBadges.forEach(b => console.log('  -', b.badgeId));

  // Determine which badges Jasper SHOULD have
  console.log('\n=== Badge Eligibility ===');
  console.log('Getting Started (first chore):', choreCompletions >= 1 ? 'YES' : 'NO');
  console.log('Century Club (100 pts):', totalPoints >= 100 ? 'YES' : 'NO');
  console.log('High Achiever (500 pts):', totalPoints >= 500 ? 'YES' : 'NO');
  console.log('Superstar (1000 pts):', totalPoints >= 1000 ? 'YES' : 'NO');
  console.log('Jack of All Trades (5 chore types):', uniqueChores.size >= 5 ? 'YES' : 'NO');
  console.log('Master of Many (10 chore types):', uniqueChores.size >= 10 ? 'YES' : 'NO');
  console.log('Week Warrior (7-day streak):', longestStreak >= 7 ? 'YES' : 'NO');
  console.log('Fortnight Champion (14-day streak):', longestStreak >= 14 ? 'YES' : 'NO');
  console.log('Monthly Master (30-day streak):', longestStreak >= 30 ? 'YES' : 'NO');
}

main().catch(console.error).finally(() => prisma.$disconnect());
