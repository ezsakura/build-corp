import { createHash, timingSafeEqual } from 'node:crypto'
import { mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import cookieParser from 'cookie-parser'
import express, { type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { fileTypeFromFile } from 'file-type'
import { z } from 'zod'
import { prisma } from './db.js'
import { defaultLandingSections, getDefaultLandingSettings, landingPageSchema } from './landing.js'

const app = express()
const port = Number(process.env.PORT ?? 3002)
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR ?? './uploads')
const jwtSecret = process.env.JWT_SECRET ?? ''
const adminUsername = process.env.ADMIN_USERNAME ?? ''
const adminPassword = process.env.ADMIN_PASSWORD ?? ''
const leadStatuses = ['NEW', 'UNDER_REVIEW', 'IN_WORK', 'REJECTED', 'COMPLETED'] as const
type LeadStatus = typeof leadStatuses[number]
const leadTransitions: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ['UNDER_REVIEW', 'IN_WORK', 'REJECTED'],
  UNDER_REVIEW: ['IN_WORK', 'REJECTED'],
  IN_WORK: ['COMPLETED'],
  REJECTED: [],
  COMPLETED: [],
}
const completedWorkSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().min(2).max(2000),
  location: z.string().trim().min(2).max(150),
  duration: z.string().trim().min(1).max(100),
  imageUrl: z.string().trim().min(1).max(500),
}).strict()

if (!jwtSecret || !adminUsername || !adminPassword) {
  throw new Error('JWT_SECRET, ADMIN_USERNAME and ADMIN_PASSWORD must be configured')
}

mkdirSync(uploadDirectory, { recursive: true })
app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(uploadDirectory, { maxAge: '7d', immutable: true }))

type AuthRequest = Request & { admin?: string }
function requireAdmin(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const token = request.cookies.admin_session
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload
    if (payload.sub !== adminUsername) throw new Error('Invalid session')
    request.admin = payload.sub
    next()
  } catch {
    response.status(401).json({ error: 'Требуется вход в панель' })
  }
}

function constantTimeEqual(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false })
const leadLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))

app.get('/api/public/content', async (_request, response, next) => {
  try {
    const [projects, completedProjects, news, landingPage, workTypes] = await Promise.all([
      prisma.project.findMany({ where: { isPublished: true, leadId: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], take: 12 }),
      prisma.project.findMany({ where: { isPublished: true, leadId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 6 }),
      prisma.newsPost.findMany({ where: { isPublished: true }, orderBy: { publishedAt: 'desc' }, take: 8 }),
      prisma.landingPage.findUnique({ where: { id: 'main' } }),
      prisma.workType.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    ])
    const settings = landingPage?.settings ?? getDefaultLandingSettings()
    response.json({
      ...settings as Record<string, unknown>,
      settings,
      sections: landingPage?.sections ?? defaultLandingSections,
      workTypes,
      projects: projects.map((project) => ({ ...project, image_url: project.imageUrl })),
      completedProjects: completedProjects.map((project) => ({ ...project, image_url: project.imageUrl })),
      news: news.map((item) => ({ ...item, published_at: item.publishedAt.toISOString() })),
    })
  } catch (error) { next(error) }
})

const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/),
  service: z.string().trim().min(1).max(64),
  quantity: z.number().positive().max(100000).optional(),
  complexity: z.number().refine((value) => [0.9, 1, 1.25].includes(value)).default(1),
  message: z.string().trim().max(2000).optional().default(''),
  consent: z.literal(true),
})

app.post('/api/leads', leadLimiter, async (request, response, next) => {
  const parsed = leadSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Проверьте имя, телефон и описание заявки' })
  try {
    const workType = await prisma.workType.findFirst({ where: { id: parsed.data.service, enabled: true } })
    if (!workType) return response.status(400).json({ error: 'Выбранный тип работ больше недоступен' })
    const quantity = parsed.data.quantity ?? null
    const estimate = quantity === null ? null : Math.round(quantity * workType.pricePerUnit * parsed.data.complexity)
    const { consent: _consent, service: _service, quantity: _quantity, complexity: _complexity, ...leadData } = parsed.data
    const lead = await prisma.lead.create({
      data: {
        ...leadData,
        service: workType.title,
        quantity,
        unit: quantity === null ? null : workType.unit,
        estimate,
      },
    })
    response.status(201).json({ id: lead.id, status: 'new' })
  } catch (error) { next(error) }
})

app.post('/api/admin/login', loginLimiter, (request, response) => {
  const body = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).safeParse(request.body)
  if (!body.success || !constantTimeEqual(body.data.username, adminUsername) || !constantTimeEqual(body.data.password, adminPassword)) {
    return response.status(401).json({ error: 'Неверный логин или пароль' })
  }
  const token = jwt.sign({ sub: adminUsername }, jwtSecret, { expiresIn: '12h' })
  response.cookie('admin_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  })
  response.json({ username: adminUsername })
})

app.post('/api/admin/logout', requireAdmin, (_request, response) => {
  response.clearCookie('admin_session', { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', path: '/' })
  response.status(204).end()
})

app.get('/api/admin/session', requireAdmin, (request: AuthRequest, response) => response.json({ username: request.admin }))

app.get('/api/admin/landing', requireAdmin, async (_request, response, next) => {
  try {
    const [page, projects, news] = await Promise.all([
      prisma.landingPage.findUnique({ where: { id: 'main' } }),
      prisma.project.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], select: { id: true, title: true, imageUrl: true } }),
      prisma.newsPost.findMany({ orderBy: { publishedAt: 'desc' }, select: { id: true, title: true, imageUrl: true } }),
    ])
    response.json({
      settings: page?.settings ?? getDefaultLandingSettings(),
      sections: page?.sections ?? defaultLandingSections,
      projectImages: projects,
      newsImages: news.map((item) => ({ ...item, imageUrl: item.imageUrl ?? '' })),
    })
  } catch (error) { next(error) }
})

app.put('/api/admin/landing', requireAdmin, async (request, response, next) => {
  const body = landingPageSchema.safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Проверьте настройки и блоки лендинга' })
  try {
    const page = await prisma.$transaction(async (transaction) => {
      for (const project of body.data.projectImages) {
        const updated = await transaction.project.updateMany({ where: { id: project.id }, data: { imageUrl: project.imageUrl } })
        if (!updated.count) throw new Error('Портфолио изменилось во время редактирования. Обновите страницу конструктора.')
      }
      for (const news of body.data.newsImages) {
        const updated = await transaction.newsPost.updateMany({ where: { id: news.id }, data: { imageUrl: news.imageUrl || null } })
        if (!updated.count) throw new Error('Список новостей изменился во время редактирования. Обновите страницу конструктора.')
      }
      return transaction.landingPage.upsert({
        where: { id: 'main' },
        create: { id: 'main', settings: body.data.settings, sections: body.data.sections },
        update: { settings: body.data.settings, sections: body.data.sections },
      })
    })
    response.json({ settings: page.settings, sections: page.sections, updatedAt: page.updatedAt })
  } catch (error) { next(error) }
})

app.get('/api/admin/leads', requireAdmin, async (request, response, next) => {
  try {
    const page = Math.max(1, Number(request.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(request.query.pageSize) || 20))
    const status = leadStatuses.includes(String(request.query.status) as typeof leadStatuses[number]) ? String(request.query.status) as typeof leadStatuses[number] : undefined
    const search = String(request.query.q ?? '').trim().slice(0, 100)
    const where = {
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }, { message: { contains: search, mode: 'insensitive' as const } }] } : {}),
    }
    const [items, total] = await Promise.all([
      prisma.lead.findMany({ where, include: { completedProject: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.lead.count({ where }),
    ])
    response.json({ items, total, page, pageSize })
  } catch (error) { next(error) }
})

app.get('/api/admin/summary', requireAdmin, async (_request, response, next) => {
  try {
    const groups = await prisma.lead.groupBy({ by: ['status'], _count: { _all: true } })
    const counts = { total: 0, NEW: 0, UNDER_REVIEW: 0, IN_WORK: 0, REJECTED: 0, COMPLETED: 0 }
    for (const group of groups) {
      counts[group.status] = group._count._all
      counts.total += group._count._all
    }
    response.json(counts)
  } catch (error) { next(error) }
})

const workTypeSchema = z.object({
  title: z.string().trim().min(2).max(100),
  unit: z.string().trim().min(1).max(20),
  pricePerUnit: z.number().min(0).max(100000000),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  enabled: z.boolean().optional(),
}).strict()

app.get('/api/admin/work-types', requireAdmin, async (_request, response, next) => {
  try { response.json(await prisma.workType.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })) }
  catch (error) { next(error) }
})
app.post('/api/admin/work-types', requireAdmin, async (request, response, next) => {
  const body = workTypeSchema.safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Проверьте название, единицу и цену типа работ' })
  try { response.status(201).json(await prisma.workType.create({ data: body.data })) }
  catch (error) { next(error) }
})
app.patch('/api/admin/work-types/:id', requireAdmin, async (request, response, next) => {
  const body = workTypeSchema.partial().safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Проверьте поля типа работ' })
  const id = String(request.params.id ?? '')
  try { response.json(await prisma.workType.update({ where: { id }, data: body.data })) }
  catch (error) { next(error) }
})
app.delete('/api/admin/work-types/:id', requireAdmin, async (request, response, next) => {
  const id = String(request.params.id ?? '')
  try { await prisma.workType.delete({ where: { id } }); response.status(204).end() }
  catch (error) { next(error) }
})

app.delete('/api/admin/leads/:id', requireAdmin, async (request, response, next) => {
  const id = String(request.params.id ?? '')
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.lead.findUnique({ where: { id }, select: { status: true } })
      if (!current) return 'missing'
      const deleted = await transaction.lead.deleteMany({ where: { id, status: current.status } })
      return deleted.count ? 'deleted' : 'changed'
    })
    if (result === 'missing') return response.status(404).json({ error: 'Заявка не найдена' })
    if (result === 'changed') return response.status(409).json({ error: 'Статус заявки изменился. Обновите список и повторите действие.' })
    response.status(204).end()
  } catch (error) { next(error) }
})

app.patch('/api/admin/leads/:id/status', requireAdmin, async (request, response, next) => {
  const body = z.object({ status: z.enum(leadStatuses), completedWork: completedWorkSchema.optional() }).strict().safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Недопустимый статус' })
  if (body.data.status === 'COMPLETED' && !body.data.completedWork) {
    return response.status(400).json({ error: 'Для завершения добавьте фото, описание, место и срок работ' })
  }
  const id = String(request.params.id ?? '')
  try {
    const lead = await prisma.$transaction(async (transaction) => {
      const current = await transaction.lead.findUnique({ where: { id } })
      if (!current) return { kind: 'missing' as const }
      if (!leadTransitions[current.status].includes(body.data.status)) return { kind: 'invalid' as const }
      const updated = await transaction.lead.updateMany({ where: { id, status: current.status }, data: { status: body.data.status } })
      if (!updated.count) return { kind: 'conflict' as const }
      if (body.data.status === 'COMPLETED' && body.data.completedWork) {
        const work = body.data.completedWork
        await transaction.project.upsert({
          where: { leadId: id },
          create: { ...work, category: current.service, area: current.quantity ? Math.round(current.quantity) : null, leadId: id, isPublished: true },
          update: { ...work, category: current.service, area: current.quantity ? Math.round(current.quantity) : null, isPublished: true },
        })
      }
      return { kind: 'updated' as const, lead: await transaction.lead.findUniqueOrThrow({ where: { id } }) }
    })
    if (lead.kind === 'missing') return response.status(404).json({ error: 'Заявка не найдена' })
    if (lead.kind === 'invalid') return response.status(409).json({ error: 'Недопустимый переход статуса. Отклоненные и завершенные заявки закрыты.' })
    if (lead.kind === 'conflict') return response.status(409).json({ error: 'Статус заявки уже изменился. Обновите список.' })
    response.json(lead.lead)
  } catch (error) { next(error) }
})

app.patch('/api/admin/leads/:id/completed-work', requireAdmin, async (request, response, next) => {
  const body = completedWorkSchema.safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Проверьте фото, описание, место и срок работ' })
  const id = String(request.params.id ?? '')
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const lead = await transaction.lead.findUnique({ where: { id } })
      if (!lead) return { kind: 'missing' as const }
      if (lead.status !== 'COMPLETED') return { kind: 'not-completed' as const }
      const project = await transaction.project.upsert({
        where: { leadId: id },
        create: { ...body.data, category: lead.service, area: lead.quantity ? Math.round(lead.quantity) : null, leadId: id, isPublished: true },
        update: { ...body.data, category: lead.service, area: lead.quantity ? Math.round(lead.quantity) : null, isPublished: true },
      })
      return { kind: 'updated' as const, project }
    })
    if (result.kind === 'missing') return response.status(404).json({ error: 'Заявка не найдена' })
    if (result.kind === 'not-completed') return response.status(409).json({ error: 'Редактировать данные можно только у завершенной заявки' })
    response.json(result.project)
  } catch (error) { next(error) }
})

const projectSchema = z.object({
  title: z.string().trim().min(2).max(150), category: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(150), area: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().trim().min(1).max(500), description: z.string().max(2000).optional(), duration: z.string().max(100).nullable().optional(), sortOrder: z.number().int().min(0).max(10000).optional(),
  isPublished: z.boolean().optional(),
})
const newsSchema = z.object({
  title: z.string().trim().min(2).max(150), summary: z.string().trim().min(2).max(500),
  body: z.string().max(10000).optional(), imageUrl: z.string().max(500).nullable().optional(),
  publishedAt: z.string().datetime().optional(), isPublished: z.boolean().optional(),
})

app.get('/api/admin/projects', requireAdmin, async (_request, response, next) => {
  try { response.json(await prisma.project.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] })) }
  catch (error) { next(error) }
})
app.post('/api/admin/projects', requireAdmin, async (request, response, next) => {
  const body = projectSchema.safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Проверьте поля проекта' })
  try { response.status(201).json(await prisma.project.create({ data: body.data })) }
  catch (error) { next(error) }
})
app.patch('/api/admin/projects/:id', requireAdmin, async (request, response, next) => {
  const body = projectSchema.partial().safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Проверьте поля проекта' })
  const id = String(request.params.id ?? '')
  try { response.json(await prisma.project.update({ where: { id }, data: body.data })) }
  catch (error) { next(error) }
})
app.delete('/api/admin/projects/:id', requireAdmin, async (request, response, next) => {
  const id = String(request.params.id ?? '')
  try { await prisma.project.delete({ where: { id } }); response.status(204).end() }
  catch (error) { next(error) }
})

app.get('/api/admin/news', requireAdmin, async (_request, response, next) => {
  try { response.json(await prisma.newsPost.findMany({ orderBy: { publishedAt: 'desc' } })) }
  catch (error) { next(error) }
})
app.post('/api/admin/news', requireAdmin, async (request, response, next) => {
  const body = newsSchema.safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Проверьте поля новости' })
  try {
    const { publishedAt, ...data } = body.data
    response.status(201).json(await prisma.newsPost.create({ data: { ...data, ...(publishedAt ? { publishedAt: new Date(publishedAt) } : {}) } }))
  } catch (error) { next(error) }
})
app.patch('/api/admin/news/:id', requireAdmin, async (request, response, next) => {
  const body = newsSchema.partial().safeParse(request.body)
  if (!body.success) return response.status(400).json({ error: 'Проверьте поля новости' })
  const id = String(request.params.id ?? '')
  try {
    const { publishedAt, ...data } = body.data
    response.json(await prisma.newsPost.update({ where: { id }, data: { ...data, ...(publishedAt ? { publishedAt: new Date(publishedAt) } : {}) } }))
  } catch (error) { next(error) }
})
app.delete('/api/admin/news/:id', requireAdmin, async (request, response, next) => {
  const id = String(request.params.id ?? '')
  try { await prisma.newsPost.delete({ where: { id } }); response.status(204).end() }
  catch (error) { next(error) }
})

const upload = multer({
  storage: multer.diskStorage({ destination: uploadDirectory, filename: (_request, _file, callback) => callback(null, randomUUID()) }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)),
})
app.post('/api/admin/uploads', requireAdmin, upload.single('image'), async (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Выберите изображение JPG, PNG, WebP или AVIF до 8 МБ' })
  const detected = await fileTypeFromFile(request.file.path).catch(() => undefined)
  if (!detected || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(detected.mime)) {
    unlinkSync(request.file.path)
    return response.status(400).json({ error: 'Файл не является поддерживаемым изображением' })
  }
  const filename = `${request.file.filename}.${detected.ext}`
  renameSync(request.file.path, path.join(uploadDirectory, filename))
  response.status(201).json({ url: `/uploads/${filename}` })
})

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error)
  if (error instanceof multer.MulterError) return response.status(400).json({ error: 'Не удалось загрузить файл: проверьте его размер и формат' })
  response.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

const server = app.listen(port, '0.0.0.0', () => console.log(`API listening on ${port}`))
async function shutdown() { server.close(); await prisma.$disconnect(); process.exit(0) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)