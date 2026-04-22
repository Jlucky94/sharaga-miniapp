import { PrismaClient } from './generated/client/index.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.project.upsert({
    where: { kind: 'notes' },
    create: {
      kind: 'notes',
      title: 'Общие конспекты',
      description: 'Соберите общий архив конспектов, чтобы своим было проще готовиться к зачетам и экзаменам.',
      threshold: 5,
      affinity: 'botan'
    },
    update: {
      title: 'Общие конспекты',
      description: 'Соберите общий архив конспектов, чтобы своим было проще готовиться к зачетам и экзаменам.',
      threshold: 5,
      affinity: 'botan'
    }
  });

  await prisma.project.upsert({
    where: { kind: 'gym' },
    create: {
      kind: 'gym',
      title: 'Кампусная качалка',
      description: 'Прокачайте зал, чтобы всем было проще держать форму, восстанавливаться и не сыпаться перед общими делами.',
      threshold: 5,
      affinity: 'sportsman'
    },
    update: {
      title: 'Кампусная качалка',
      description: 'Прокачайте зал, чтобы всем было проще держать форму, восстанавливаться и не сыпаться перед общими делами.',
      threshold: 5,
      affinity: 'sportsman'
    }
  });

  await prisma.project.upsert({
    where: { kind: 'festival' },
    create: {
      kind: 'festival',
      title: 'Сцена для движа',
      description: 'Соберите сцену для движа, чтобы у всех появилось место, где можно собраться, пошуметь и словить общий вайб.',
      threshold: 4,
      affinity: 'partygoer'
    },
    update: {
      title: 'Сцена для движа',
      description: 'Соберите сцену для движа, чтобы у всех появилось место, где можно собраться, пошуметь и словить общий вайб.',
      threshold: 4,
      affinity: 'partygoer'
    }
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
