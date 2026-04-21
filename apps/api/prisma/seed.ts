import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.project.upsert({
    where: { kind: 'notes' },
    create: {
      kind: 'notes',
      title: 'Shared Notes',
      description: 'Build a shared notes archive that helps everyone prepare for exams.',
      threshold: 5,
      affinity: 'botan'
    },
    update: {}
  });

  await prisma.project.upsert({
    where: { kind: 'gym' },
    create: {
      kind: 'gym',
      title: 'Campus Gym',
      description: 'Upgrade the campus gym so everyone can train harder and recover faster.',
      threshold: 5,
      affinity: 'sportsman'
    },
    update: {}
  });

  await prisma.project.upsert({
    where: { kind: 'festival' },
    create: {
      kind: 'festival',
      title: 'Festival Stage',
      description: 'Set up the festival stage so the campus has a place to gather and celebrate.',
      threshold: 4,
      affinity: 'partygoer'
    },
    update: {}
  });

  console.log('Seed complete: 3 campus projects upserted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
