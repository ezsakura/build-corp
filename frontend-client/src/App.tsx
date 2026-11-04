import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, HardHat,
  Hammer, House, Menu, Ruler, ShieldCheck, X,
} from 'lucide-react'
import { calculateEstimate, type WorkType } from './calculator'

type Project = { id: string; title: string; category: string; location: string; image_url: string; area?: number; description?: string; duration?: string | null }
type NewsItem = { id: string; title: string; summary: string; body?: string; published_at: string; image_url?: string }
type LandingSection = { id: string; type: 'hero' | 'services' | 'calculator' | 'projects' | 'news' | 'about' | 'contact' | 'custom'; enabled: boolean; eyebrow: string; title: string; subtitle: string; body: string; imageUrl: string; ctaLabel: string; secondaryLabel: string; items: Array<{ title: string; text: string }> }
type ContactForm = { name: string; phone: string; service: string; message: string; consent: boolean; quantity?: number; complexity?: number }
type Content = { brandName: string; tagline: string; projects: Project[]; completedProjects: Project[]; news: NewsItem[]; workTypes: WorkType[]; years: number; projectsCompleted: number; city: string; phone: string; metaTitle: string; metaDescription: string; accentColor: string; forestColor: string; sections: LandingSection[] }

const fallbackContent: Content = {
  brandName: 'Чуваш Строй',
  tagline: 'Строим с характером. Отвечаем за результат.',
  years: 12,
  projectsCompleted: 86,
  city: 'Ногинск и Московская область',
  phone: '+7 (906) 701-27-66',
  metaTitle: 'Чуваш Строй — строим надолго',
  metaDescription: 'Строительная бригада полного цикла: фундамент, стены, кровля и реконструкция.',
  accentColor: '#e85f31',
  forestColor: '#263d36',
  workTypes: [
    { id: 'roof', title: 'Кровля', unit: 'м²', pricePerUnit: 7316 },
    { id: 'walls', title: 'Стены и фасады', unit: 'м²', pricePerUnit: 4800 },
    { id: 'foundation', title: 'Фундамент', unit: 'м³', pricePerUnit: 9968 },
  ],
  sections: [
    { id: 'hero', type: 'hero', enabled: true, eyebrow: 'СТРОИТЕЛЬСТВО ЧАСТНЫХ ДОМОВ · НОГИНСК И ОБЛАСТЬ', title: 'Строим дома', subtitle: 'На совесть и надолго', body: 'От первого выезда на участок до приемки работ. Одна команда, понятный план и бригадир на связи на каждом этапе.', imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=90', ctaLabel: 'Обсудить строительство', secondaryLabel: 'Посмотреть объекты', items: [] },
    { id: 'services', type: 'services', enabled: true, eyebrow: '01 / ПОЛНЫЙ ЦИКЛ', title: 'Каждый этап', subtitle: 'в одних руках', body: 'Подбираем решение под участок, проект и бюджет. За последовательность работ и качество отвечает одна команда.', imageUrl: '', ctaLabel: '', secondaryLabel: '', items: [{ title: 'Фундамент', text: 'Учитываем грунт и нагрузки, подбираем основание под ваш проект.' }, { title: 'Коробка и стены', text: 'Возводим стены, выполняем утепление и подготовку фасада.' }, { title: 'Кровля', text: 'Монтируем стропильную систему, покрытие и водоотвод.' }, { title: 'Реконструкция', text: 'Обследуем дом, определяем объем работ и согласуем порядок.' }] },
    { id: 'calculator', type: 'calculator', enabled: true, eyebrow: '02 / ПРЕДВАРИТЕЛЬНЫЙ РАСЧЕТ', title: 'Сколько стоит', subtitle: 'ваш проект', body: 'Укажите тип работ и объем, чтобы получить ориентир. Точную смету подготовим после изучения проекта и участка.', imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85', ctaLabel: 'Обсудить расчет', secondaryLabel: '', items: [] },
    { id: 'projects', type: 'projects', enabled: true, eyebrow: '03 / НАШ ОПЫТ В ДЕЛЕ', title: 'Реальные объекты', subtitle: 'и понятный результат', body: '', imageUrl: '', ctaLabel: 'Обсудить ваш объект', secondaryLabel: '', items: [] },
    { id: 'news', type: 'news', enabled: true, eyebrow: '04 / ИЗ РАБОЧЕГО ДНЕВНИКА', title: 'Новости со стройки', subtitle: 'по делу', body: 'Показываем ход работ, делимся решениями и рассказываем о новых объектах.', imageUrl: '', ctaLabel: '', secondaryLabel: '', items: [] },
    { id: 'about', type: 'about', enabled: true, eyebrow: '05 / ОТВЕЧАЕМ ЗА КАЖДЫЙ ЭТАП', title: 'Работаем открыто', subtitle: 'от замера до сдачи', body: 'Вы общаетесь напрямую с бригадиром. До начала работ согласуем этапы и смету, а по ходу строительства держим вас в курсе.', imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1300&q=85', ctaLabel: 'Познакомиться с бригадой', secondaryLabel: '', items: [] },
    { id: 'contact', type: 'contact', enabled: true, eyebrow: '06 / ОБСУДИМ ВАШУ ЗАДАЧУ', title: 'Есть проект?', subtitle: 'Давайте обсудим', body: 'Расскажите, что планируете. Бригадир уточнит детали и предложит удобное время для разговора или встречи на участке.', imageUrl: '', ctaLabel: 'Отправить заявку', secondaryLabel: '', items: [] },
  ],
  projects: [
    { id: '1', title: 'Дом в Репино', category: 'Кровля и фасад', location: 'Курортный район', area: 214, image_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=85' },
    { id: '2', title: 'Семейный дом', category: 'Фундамент и коробка', location: 'Всеволожский район', area: 186, image_url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=85' },
    { id: '3', title: 'Реконструкция дачи', category: 'Кровля', location: 'Выборгский район', area: 132, image_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85' },
  ],
  completedProjects: [],
  news: [
    { id: '1', title: 'Как мы готовим участок к зимнему сезону', summary: 'Разбираем этапы консервации стройки и защиты материалов.', published_at: '2026-10-12' },
    { id: '2', title: 'Новый объект: кровля в Репино', summary: 'Завершили монтаж фальцевой кровли на доме у залива.', published_at: '2026-09-28' },
  ],
}

const api = (path: string) => fetch(`/api${path}`)
const money = new Intl.NumberFormat('ru-RU')

function App() {
  const [content, setContent] = useState(fallbackContent)
  const [activeService, setActiveService] = useState('roof')
  const [area, setArea] = useState(120)
  const [complexity, setComplexity] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const newsCloseButton = useRef<HTMLButtonElement>(null)
  const [formState, setFormState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [formMessage, setFormMessage] = useState('')
  const [form, setForm] = useState<ContactForm>({ name: '', phone: '+7 (', service: 'roof', message: '', consent: false })

  useEffect(() => {
    api('/public/content')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: Partial<Content>) => {
        const nextContent = { ...fallbackContent, ...data }
        setContent(nextContent)
        setActiveService((current) => nextContent.workTypes.some((workType) => workType.id === current) ? current : nextContent.workTypes[0]?.id ?? '')
        setForm((current) => ({ ...current, service: nextContent.workTypes.some((workType) => workType.id === current.service) ? current.service : nextContent.workTypes[0]?.id ?? '' }))
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    document.title = content.metaTitle
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.append(description)
    }
    description.content = content.metaDescription
    document.documentElement.style.setProperty('--orange', content.accentColor)
    document.documentElement.style.setProperty('--forest', content.forestColor)
  }, [content.metaTitle, content.metaDescription, content.accentColor, content.forestColor])

  useEffect(() => {
    if (!selectedNews) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    newsCloseButton.current?.focus()

    function handleModalKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedNews(null)
      } else if (event.key === 'Tab') {
        event.preventDefault()
        newsCloseButton.current?.focus()
      }
    }

    window.addEventListener('keydown', handleModalKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleModalKeyDown)
      previousFocus?.focus()
    }
  }, [selectedNews])

  useEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const targets = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        currentObserver.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' })

    document.documentElement.classList.add('motion-ready')
    targets.forEach((target) => {
      target.classList.add('reveal-on-scroll')
      observer.observe(target)
    })

    return () => {
      observer.disconnect()
      document.documentElement.classList.remove('motion-ready')
    }
  }, [content])

  const activeWorkType = content.workTypes.find((workType) => workType.id === activeService) ?? content.workTypes[0]
  const estimate = activeWorkType ? calculateEstimate(activeWorkType.pricePerUnit, area, complexity) : 0

  function formatRussianPhone(value: string) {
    const digits = value.replace(/\D/g, '').replace(/^[78]/, '').slice(0, 10)
    let formatted = `+7 (${digits.slice(0, 3)}`
    if (digits.length >= 3) formatted += ')'
    if (digits.length > 3) formatted += ` ${digits.slice(3, 6)}`
    if (digits.length > 6) formatted += `-${digits.slice(6, 8)}`
    if (digits.length > 8) formatted += `-${digits.slice(8, 10)}`
    return formatted
  }

  function attachEstimate() {
    if (!activeWorkType) return
    setForm((current) => ({ ...current, service: activeWorkType.id, quantity: area, complexity, message: `Предварительный расчет: ${money.format(estimate)} ₽ за ${area} ${activeWorkType.unit}. ${current.message}`.trim() }))
    document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormState('sending')
    setFormMessage('')
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Не удалось отправить заявку. Попробуйте еще раз.')
      setFormState('sent')
      setFormMessage('Заявка отправлена. Бригадир скоро свяжется с вами.')
    } catch (error) {
      setFormState('error')
      setFormMessage(error instanceof Error ? error.message : 'Не удалось отправить заявку. Попробуйте еще раз.')
    }
  }

  const sectionHref = (type: LandingSection['type']) => {
    const section = content.sections.find((item) => item.type === type && item.enabled)
    return section ? `#${section.id}` : '#contact'
  }

  function renderSection(section: LandingSection, order: number): ReactNode {
    const sectionStyle = { order }
    const sectionLabel = <div className={`section-label ${section.type === 'contact' ? 'section-label-inverse' : ''}`}><span>{section.eyebrow}</span><i /></div>

    switch (section.type) {
      case 'hero':
        return <section className="hero" id={section.id} style={sectionStyle} key={section.id}>
          <div className="hero-image" role="img" aria-label={section.title} style={section.imageUrl ? { backgroundImage: `url("${section.imageUrl}")` } : undefined} />
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow eyebrow-light"><span /> {section.eyebrow} · {content.city}</p>
            <h1>{section.title}<br /><span>{section.subtitle}</span></h1>
            <p className="hero-copy">{section.body}</p>
            <div className="hero-actions">
              <a className="button button-accent" href={sectionHref('calculator')}>{section.ctaLabel || 'Обсудить проект'} <ArrowRight size={17} /></a>
              {section.secondaryLabel && <a className="text-link light-link" href={sectionHref('projects')}>{section.secondaryLabel} <ArrowDown size={16} /></a>}
            </div>
            <div className="hero-footnote"><span className="status-dot" /> Открыты к новым проектам</div>
          </div>
          <div className="hero-index"><span>01</span><i /> {String(content.sections.filter((item) => item.enabled).length).padStart(2, '0')}</div>
          <div className="hero-caption">Работаем в {content.city} · {content.years} лет опыта</div>
        </section>

      case 'services':
        return <section className="intro-band" id={section.id} style={sectionStyle} key={section.id}>
          {sectionLabel}
          <div className="intro-heading" data-reveal><h2>{section.title}<br /><em>{section.subtitle}</em></h2><p>{section.body}</p></div>
          <div className="service-grid">{section.items.map((item, index) => {
            const Icon = [House, Hammer, Ruler, ShieldCheck][index % 4]
            const normalizedTitle = item.title.toLocaleLowerCase('ru-RU')
            const matchingWorkType = content.workTypes.find((workType) => normalizedTitle.includes(workType.title.toLocaleLowerCase('ru-RU')) || workType.title.toLocaleLowerCase('ru-RU').includes(normalizedTitle))
            const href = matchingWorkType ? sectionHref('calculator') : sectionHref('contact')
            return <article className="service-item" data-reveal key={`${section.id}-${index}`}><span className="service-number">{String(index + 1).padStart(2, '0')}</span><div className="service-icon"><Icon size={21} /></div><h3>{item.title}</h3><p>{item.text}</p><a href={href} onClick={() => matchingWorkType && setActiveService(matchingWorkType.id)}>Обсудить услугу <ArrowUpRight size={15} /></a></article>
          })}</div>
        </section>

      case 'calculator':
        return <section className="calculator-section" id={section.id} style={sectionStyle} key={section.id}>
          <div className="calculator-photo" data-reveal role="img" aria-label={section.title} style={section.imageUrl ? { backgroundImage: `url("${section.imageUrl}")` } : undefined} />
          <div className="calculator-panel" data-reveal>{sectionLabel}<h2>{section.title}<br /><em>{section.subtitle}</em></h2><p className="calculator-lead">{section.body}</p>
            <div className="service-switch" role="tablist" aria-label="Тип работ">{content.workTypes.map((workType) => <button key={workType.id} role="tab" aria-selected={activeService === workType.id} className={activeService === workType.id ? 'switch-option active' : 'switch-option'} onClick={() => setActiveService(workType.id)}>{workType.title}</button>)}</div>
            <label className="field-label" htmlFor="area">Объем, {activeWorkType?.unit ?? ''}</label>
            <div className="range-line"><input id="area" type="range" min="20" max="500" step="5" value={area} onChange={(event) => setArea(Number(event.target.value))} /><input className="number-input" type="number" min="1" max="5000" value={area} aria-label="Площадь в квадратных метрах" onChange={(event) => setArea(Number(event.target.value))} /></div>
            <label className="field-label" htmlFor="complexity">Сложность проекта</label>
            <div className="select-wrap"><select id="complexity" value={complexity} onChange={(event) => setComplexity(Number(event.target.value))}><option value="0.9">Простая</option><option value="1">Стандартная</option><option value="1.25">Сложная</option></select><ChevronDown size={17} /></div>
            <div className="estimate-result"><div><span>Предварительно</span><strong>{money.format(estimate)} <small>₽</small></strong></div><button className="button button-dark" onClick={attachEstimate}>{section.ctaLabel || 'Обсудить расчет'} <ArrowRight size={16} /></button></div><p className="fine-print">Демо-коэффициенты. Итог зависит от проекта, материалов и условий участка.</p>
          </div>
        </section>

      case 'projects':
        return <section className="projects-section" id={section.id} style={sectionStyle} key={section.id}>
          {sectionLabel}<div className="section-heading-row" data-reveal><h2>{section.title}<br /><em>{section.subtitle}</em></h2><a className="text-link dark-link" href={sectionHref('contact')}>{section.ctaLabel} <ArrowUpRight size={16} /></a></div>
          <div className="project-grid">{content.projects.slice(0, 3).map((project, index) => <article className={`project-card project-${index + 1}`} data-reveal key={project.id}><a className="project-image" href={sectionHref('contact')} style={{ backgroundImage: `url("${project.image_url}")` }} aria-label={`Обсудить проект: ${project.title}`}><span className="project-open"><ArrowUpRight size={19} /></span></a><div className="project-meta"><span>{project.category}</span><span>{project.location}</span></div><h3>{project.title}</h3><p>{project.area ? `${project.area} м²` : 'Частный дом'} · Выполнено под ключ</p></article>)}</div>
          {content.completedProjects.length > 0 && <div className="completed-work-block" data-reveal><div className="completed-work-heading"><span>НОВЫЕ РЕЗУЛЬТАТЫ</span><h3>Наши недавно завершённые работы</h3></div><div className="completed-work-grid">{content.completedProjects.map((project) => <article className="completed-work-card" key={project.id}><div className="completed-work-image" role="img" aria-label={project.title} style={{ backgroundImage: `url("${project.image_url}")` }} /><div className="completed-work-copy"><div className="project-meta"><span>{project.category}</span><span>{project.location}</span></div><h4>{project.title}</h4><p>{project.description}</p>{project.duration && <span className="completed-work-duration">Срок: {project.duration}</span>}</div></article>)}</div></div>}
        </section>

      case 'news':
        return <section className="news-section" id={section.id} style={sectionStyle} key={section.id}>
          {sectionLabel}<div className="section-heading-row" data-reveal><h2>{section.title}<br /><em>{section.subtitle}</em></h2><span className="news-aside">{section.body}</span></div>
          <div className="news-list">{content.news.slice(0, 3).map((item, index) => <button className="news-item" data-reveal type="button" key={item.id} onClick={() => setSelectedNews(item)} aria-label={`Открыть новость: ${item.title}`}><span className="news-number">0{index + 1}</span><time>{new Date(item.published_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}</time><span className="news-item-copy"><strong>{item.title}</strong><span>{item.summary}</span></span><ArrowUpRight size={19} aria-hidden="true" /></button>)}</div>
        </section>

      case 'about':
        return <section className="about-section" id={section.id} style={sectionStyle} key={section.id}>
          <div className="about-image" data-reveal role="img" aria-label={section.title} style={section.imageUrl ? { backgroundImage: `url("${section.imageUrl}")` } : undefined}><span>НА ОБЪЕКТЕ<br />КАЖДЫЙ ДЕНЬ</span></div>
          <div className="about-copy" data-reveal>{sectionLabel}<h2>{section.title}<br /><em>{section.subtitle}</em></h2><p>{section.body}</p><div className="stats-row"><div><strong>{content.years}<small>+</small></strong><span>лет в строительстве</span></div><div><strong>{content.projectsCompleted}</strong><span>объектов сданы</span></div><div><strong>1</strong><span>ответственный бригадир</span></div></div><a className="text-link dark-link" href={sectionHref('contact')}>{section.ctaLabel} <ArrowRight size={16} /></a></div>
        </section>

      case 'contact':
        return <section className="contact-section" id={section.id} style={sectionStyle} key={section.id}>
          <div className="contact-copy" data-reveal>{sectionLabel}<h2>{section.title}<br /><em>{section.subtitle}</em></h2><p>{section.body}</p><a className="contact-phone" href={`tel:${content.phone.replace(/[\s()-]/g, '')}`}>{content.phone}<ArrowUpRight size={19} /></a><span className="contact-location">{content.city} · Пн–Сб, 09:00–19:00</span></div>
          <form className="contact-form" data-reveal onSubmit={submitForm}><label>Как к вам обращаться<input required minLength={2} maxLength={100} autoComplete="name" placeholder="Имя" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Номер телефона<input required type="tel" inputMode="tel" autoComplete="tel" pattern="\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}" maxLength={18} placeholder="+7 (___) ___-__-__" value={form.phone} onChange={(event) => setForm({ ...form, phone: formatRussianPhone(event.target.value) })} /></label><label>Что планируете строить?<select value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value, quantity: undefined, complexity: undefined })}>{content.workTypes.map((workType) => <option value={workType.id} key={workType.id}>{workType.title}</option>)}</select></label><label>Пара слов о задаче<textarea rows={2} maxLength={2000} placeholder="Участок, сроки, что уже известно" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label><label className="consent-field"><input required type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>Согласен на обработку персональных данных для ответа на обращение.</span></label><div className="form-bottom"><button className="button button-accent" disabled={formState === 'sending'}>{formState === 'sending' ? 'Отправляем…' : section.ctaLabel || 'Отправить заявку'} {formState === 'sent' ? <Check size={17} /> : <ArrowRight size={17} />}</button><p>Данные используются только для связи по вашему запросу.</p></div>{formMessage && <p className={`form-message ${formState}`} role="status">{formMessage}</p>}</form>
        </section>

      case 'custom':
        return <section className="custom-landing-section" id={section.id} style={sectionStyle} key={section.id} data-reveal>
          {section.imageUrl && <div className="custom-landing-image" role="img" aria-label={section.title} style={{ backgroundImage: `url("${section.imageUrl}")` }} />}
          <div className="custom-landing-copy">{sectionLabel}<h2>{section.title}{section.subtitle && <><br /><em>{section.subtitle}</em></>}</h2><p>{section.body}</p>{section.ctaLabel && <a className="text-link dark-link" href={sectionHref('contact')}>{section.ctaLabel} <ArrowRight size={16} /></a>}</div>
        </section>
    }
  }

  const sectionTarget = (type: LandingSection['type']) => `#${content.sections.find((section) => section.type === type && section.enabled)?.id ?? 'contact'}`

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Чуваш Строй — главная">
          <span className="brand-mark"><HardHat size={20} strokeWidth={2.2} /></span>
          <span>{content.brandName}<small>{content.tagline}</small></span>
        </a>
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Основная навигация">
          {([{ type: 'services', label: 'Услуги' }, { type: 'projects', label: 'Работы' }, { type: 'about', label: 'О бригаде' }, { type: 'news', label: 'Новости' }] as const).map(({ type, label }) => content.sections.some((section) => section.type === type && section.enabled) && <a key={type} onClick={() => setMenuOpen(false)} href={sectionTarget(type)}>{label}</a>)}
        </nav>
        <div className="header-contact">
          <a href={`tel:${content.phone.replace(/[\s()-]/g, '')}`}>{content.phone}</a>
          <a className="header-cta" href={sectionTarget('contact')}>Обсудить проект <ArrowUpRight size={16} /></a>
        </div>
        <button className="menu-toggle" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      <main id="top" className="landing-page">
        {content.sections.filter((section) => section.enabled).map((section, index) => renderSection(section, index))}
      </main>

      <footer className="site-footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><HardHat size={19} /></span><span>{content.brandName}<small>{content.tagline}</small></span></a><span>Строительная бригада · {content.city}</span><a href={`tel:${content.phone.replace(/[\s()-]/g, '')}`}>{content.phone}</a><span>© {new Date().getFullYear()} {content.brandName}</span></footer>

      {selectedNews && <div className="news-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedNews(null) }}>
        <article className="news-modal" role="dialog" aria-modal="true" aria-labelledby="news-modal-title" aria-describedby="news-modal-summary">
          <header className="news-modal-header"><span>НОВОСТИ БРИГАДЫ</span><button ref={newsCloseButton} type="button" className="news-modal-close" aria-label="Закрыть новость" onClick={() => setSelectedNews(null)}><X size={20} /></button></header>
          {selectedNews.image_url && <div className="news-modal-image" role="img" aria-label={selectedNews.title} style={{ backgroundImage: `url("${selectedNews.image_url}")` }} />}
          <time>{new Date(selectedNews.published_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}</time>
          <h2 id="news-modal-title">{selectedNews.title}</h2>
          <p id="news-modal-summary" className="news-modal-summary">{selectedNews.summary}</p>
          {selectedNews.body && <div className="news-modal-body">{selectedNews.body}</div>}
        </article>
      </div>}
    </>
  )
}

export default App