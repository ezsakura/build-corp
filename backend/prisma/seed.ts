import { Prisma, PrismaClient } from '@prisma/client'
import { defaultLandingSections, getDefaultLandingSettings } from '../src/landing.js'

const prisma = new PrismaClient()

try {
  if (await prisma.project.count() === 0) {
    await prisma.project.createMany({ data: [
      { title: 'Дом в Репино', category: 'Кровля и фасад', location: 'Курортный район', area: 214, imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=85', sortOrder: 1 },
      { title: 'Семейный дом', category: 'Фундамент и коробка', location: 'Всеволожский район', area: 186, imageUrl: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=85', sortOrder: 2 },
      { title: 'Реконструкция дачи', category: 'Кровля', location: 'Выборгский район', area: 132, imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85', sortOrder: 3 },
    ] })
  }
  if (await prisma.workType.count() === 0) {
    await prisma.workType.createMany({ data: [
      { id: 'roof', title: 'Кровля', unit: 'м²', pricePerUnit: 7316, sortOrder: 1 },
      { id: 'walls', title: 'Стены и фасады', unit: 'м²', pricePerUnit: 4800, sortOrder: 2 },
      { id: 'foundation', title: 'Фундамент', unit: 'м³', pricePerUnit: 9968, sortOrder: 3 },
    ] })
  }
  if (await prisma.newsPost.count() === 0) {
    await prisma.newsPost.createMany({ data: [
      { title: 'Как мы готовим участок к зимнему сезону', summary: 'Разбираем этапы консервации стройки и защиты материалов.', isPublished: true },
      { title: 'Новый объект: кровля в Репино', summary: 'Завершили монтаж фальцевой кровли на доме у залива.', isPublished: true },
    ] })
  }
  if (!await prisma.landingPage.findUnique({ where: { id: 'main' } })) {
    await prisma.landingPage.create({
      data: {
        id: 'main',
        settings: getDefaultLandingSettings() as Prisma.InputJsonValue,
        sections: defaultLandingSections as Prisma.InputJsonValue,
      },
    })
  }
  console.log('Demo content is ready')
} finally {
  await prisma.$disconnect()
}