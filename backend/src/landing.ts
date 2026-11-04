import { z } from 'zod'

export const landingSettingsSchema = z.object({
  brandName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(7).max(32),
  years: z.number().int().min(0).max(100),
  projectsCompleted: z.number().int().min(0).max(100000),
  metaTitle: z.string().trim().min(2).max(120),
  metaDescription: z.string().trim().min(10).max(320),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  forestColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).strict()

export const landingSectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  type: z.enum(['hero', 'services', 'calculator', 'projects', 'news', 'about', 'contact', 'custom']),
  enabled: z.boolean(),
  eyebrow: z.string().max(120),
  title: z.string().trim().min(1).max(180),
  subtitle: z.string().max(240),
  body: z.string().max(4000),
  imageUrl: z.string().max(1000),
  ctaLabel: z.string().max(100),
  secondaryLabel: z.string().max(100),
  items: z.array(z.object({ title: z.string().max(120), text: z.string().max(600) }).strict()).max(12),
}).strict()

export const landingPageSchema = z.object({
  settings: landingSettingsSchema,
  sections: z.array(landingSectionSchema).min(1).max(20),
  projectImages: z.array(z.object({ id: z.string().min(1).max(64), title: z.string().max(150), imageUrl: z.string().max(1000) }).strict()).max(200).default([]),
  newsImages: z.array(z.object({ id: z.string().min(1).max(64), title: z.string().max(150), imageUrl: z.string().max(1000) }).strict()).max(200).default([]),
}).strict().superRefine(({ sections }, context) => {
  const ids = new Set<string>()
  for (const section of sections) {
    if (ids.has(section.id)) {
      context.addIssue({ code: 'custom', message: `Повторяется ID блока: ${section.id}`, path: ['sections'] })
      return
    }
    ids.add(section.id)
  }
})

export type LandingSettings = z.infer<typeof landingSettingsSchema>
export type LandingSection = z.infer<typeof landingSectionSchema>

export function getDefaultLandingSettings(): LandingSettings {
  return {
    brandName: 'Чуваш Строй',
    tagline: 'Строим с характером. Отвечаем за результат.',
    city: 'Ногинск и Московская область',
    phone: '+7 (___) ___-__-__',
    years: 12,
    projectsCompleted: 86,
    metaTitle: process.env.SITE_META_TITLE ?? 'Чуваш Строй — строительство домов в Ногинске и области',
    metaDescription: process.env.SITE_META_DESCRIPTION ?? 'Фундамент, стены, кровля и реконструкция частных домов. Одна команда, понятный план и связь с бригадиром на каждом этапе.',
    accentColor: '#e85f31',
    forestColor: '#263d36',
  }
}

export const defaultLandingSections: LandingSection[] = [
  { id: 'hero', type: 'hero', enabled: true, eyebrow: 'СТРОИТЕЛЬСТВО ЧАСТНЫХ ДОМОВ · НОГИНСК И ОБЛАСТЬ', title: 'Строим дома', subtitle: 'На совесть и надолго', body: 'От первого выезда на участок до приемки работ. Одна команда, понятный план и бригадир на связи на каждом этапе.', imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=90', ctaLabel: 'Обсудить строительство', secondaryLabel: 'Посмотреть объекты', items: [] },
  { id: 'services', type: 'services', enabled: true, eyebrow: '01 / ПОЛНЫЙ ЦИКЛ', title: 'Каждый этап', subtitle: 'в одних руках', body: 'Подбираем решение под участок, проект и бюджет. За последовательность работ и качество отвечает одна команда.', imageUrl: '', ctaLabel: '', secondaryLabel: '', items: [
    { title: 'Фундамент', text: 'Учитываем грунт и нагрузки, подбираем основание под ваш проект.' },
    { title: 'Коробка и стены', text: 'Возводим стены, выполняем утепление и подготовку фасада.' },
    { title: 'Кровля', text: 'Монтируем стропильную систему, покрытие и водоотвод.' },
    { title: 'Реконструкция', text: 'Обследуем дом, определяем объем работ и согласуем порядок.' },
  ] },
  { id: 'calculator', type: 'calculator', enabled: true, eyebrow: '02 / ПРЕДВАРИТЕЛЬНЫЙ РАСЧЕТ', title: 'Сколько стоит', subtitle: 'ваш проект', body: 'Укажите тип работ и площадь, чтобы получить ориентир. Точную смету подготовим после изучения проекта и участка.', imageUrl: 'https://images.unsplash.com/photo-1635424710928-7d8d6a819f4a?auto=format&fit=crop&w=1200&q=85', ctaLabel: 'Обсудить расчет', secondaryLabel: '', items: [] },
  { id: 'projects', type: 'projects', enabled: true, eyebrow: '03 / НАШ ОПЫТ В ДЕЛЕ', title: 'Реальные объекты', subtitle: 'и понятный результат', body: '', imageUrl: '', ctaLabel: 'Обсудить ваш объект', secondaryLabel: '', items: [] },
  { id: 'news', type: 'news', enabled: true, eyebrow: '04 / ИЗ РАБОЧЕГО ДНЕВНИКА', title: 'Новости со стройки', subtitle: 'по делу', body: 'Показываем ход работ, делимся решениями и рассказываем о новых объектах.', imageUrl: '', ctaLabel: '', secondaryLabel: '', items: [] },
  { id: 'about', type: 'about', enabled: true, eyebrow: '05 / ОТВЕЧАЕМ ЗА КАЖДЫЙ ЭТАП', title: 'Работаем открыто', subtitle: 'от замера до сдачи', body: 'Вы общаетесь напрямую с бригадиром. До начала работ согласуем этапы и смету, а по ходу строительства держим вас в курсе.', imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1300&q=85', ctaLabel: 'Познакомиться с бригадой', secondaryLabel: '', items: [] },
  { id: 'contact', type: 'contact', enabled: true, eyebrow: '06 / ОБСУДИМ ВАШУ ЗАДАЧУ', title: 'Есть проект?', subtitle: 'Давайте обсудим', body: 'Расскажите, что планируете. Бригадир уточнит детали и предложит удобное время для разговора или встречи на участке.', imageUrl: '', ctaLabel: 'Отправить заявку', secondaryLabel: '', items: [] },
]