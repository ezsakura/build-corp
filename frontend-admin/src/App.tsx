import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ClipboardList,
  FileImage, FileText, HardHat, LayoutDashboard, LoaderCircle, LogOut, Menu, Pencil, Plus, Search, ShieldCheck,
  ToggleLeft, ToggleRight, Trash2, Wrench, X,
} from 'lucide-react'
import LandingBuilder from './LandingBuilder'
import type { LandingPageDraft } from './landingTypes'

type View = 'leads' | 'projects' | 'news' | 'workTypes' | 'builder'
type Status = 'NEW' | 'UNDER_REVIEW' | 'IN_WORK' | 'REJECTED' | 'COMPLETED'
type CompletedWork = { title: string; description: string; location: string; duration: string; imageUrl: string }
type Lead = { id: string; name: string; phone: string; service: string; quantity: number | null; unit: string | null; estimate: number | null; message: string; status: Status; createdAt: string; completedProject: CompletedWork | null }
type Project = { id: string; title: string; category: string; location: string; area: number | null; imageUrl: string; description: string; duration: string | null; sortOrder: number; isPublished: boolean }
type NewsPost = { id: string; title: string; summary: string; body: string; imageUrl: string | null; publishedAt: string; isPublished: boolean }
type WorkType = { id: string; title: string; unit: string; pricePerUnit: number; sortOrder: number; enabled: boolean }
type Summary = Record<Status, number> & { total: number }

const statusNames: Record<Status, string> = { NEW: 'Новая', UNDER_REVIEW: 'На рассмотрении', IN_WORK: 'В работе', REJECTED: 'Отклонена', COMPLETED: 'Завершена' }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...init, headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init?.headers } })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Не удалось выполнить запрос')
  return data as T
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function App() {
  const [session, setSession] = useState<'checking' | 'signed' | 'guest'>('checking')
  const [view, setView] = useState<View>('leads')
  const [menuOpen, setMenuOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [news, setNews] = useState<NewsPost[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [landing, setLanding] = useState<LandingPageDraft | null>(null)
  const [summary, setSummary] = useState<Summary>({ total: 0, NEW: 0, UNDER_REVIEW: 0, IN_WORK: 0, REJECTED: 0, COMPLETED: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [completionLead, setCompletionLead] = useState<Lead | null>(null)
  const [projectEditor, setProjectEditor] = useState<Project | null | false>(false)
  const [newsEditor, setNewsEditor] = useState<NewsPost | null | false>(false)
  const [workTypeEditor, setWorkTypeEditor] = useState<WorkType | null | false>(false)

  useEffect(() => {
    request('/admin/session').then(() => setSession('signed')).catch(() => setSession('guest'))
  }, [])

  const loadData = useCallback(async () => {
    if (session !== 'signed') return
    setBusy(true)
    setNotice('')
    try {
      if (view === 'leads') {
        const params = new URLSearchParams({ page: String(page), pageSize: '50' })
        if (statusFilter !== 'ALL') params.set('status', statusFilter)
        if (search.trim()) params.set('q', search.trim())
        const [result, counts] = await Promise.all([
          request<{ items: Lead[]; total: number }>(`/admin/leads?${params}`),
          request<Summary>('/admin/summary'),
        ])
        setLeads(result.items)
        setTotal(result.total)
        setPage((current) => Math.min(current, Math.max(1, Math.ceil(result.total / 50))))
        setSummary(counts)
      } else if (view === 'projects') {
        setProjects(await request<Project[]>('/admin/projects'))
      } else if (view === 'news') {
        setNews(await request<NewsPost[]>('/admin/news'))
      } else if (view === 'workTypes') {
        setWorkTypes(await request<WorkType[]>('/admin/work-types'))
      } else {
        setLanding(await request<LandingPageDraft>('/admin/landing'))
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ошибка загрузки данных')
    } finally { setBusy(false) }
  }, [session, view, statusFilter, search, page])

  useEffect(() => { void loadData() }, [loadData])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setLoginError('')
    try {
      await request('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      setPassword('')
      setSession('signed')
    } catch (error) { setLoginError(error instanceof Error ? error.message : 'Не удалось войти') }
    finally { setBusy(false) }
  }

  async function logout() {
    await request('/admin/logout', { method: 'POST' }).catch(() => undefined)
    setSession('guest')
  }

  async function changeStatus(lead: Lead, status: Status, completedWork?: CompletedWork) {
    try {
      await request(`/admin/leads/${lead.id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...(completedWork ? { completedWork } : {}) }) })
      setSelectedLead(null)
      setCompletionLead(null)
      await loadData()
      setNotice(`Статус заявки обновлен: ${statusNames[status].toLowerCase()}`)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось изменить статус'
      setNotice(message)
      return false
    }
  }

  async function saveCompletedWork(lead: Lead, completedWork: CompletedWork) {
    try {
      await request(`/admin/leads/${lead.id}/completed-work`, { method: 'PATCH', body: JSON.stringify(completedWork) })
      setSelectedLead(null)
      setCompletionLead(null)
      await loadData()
      setNotice('Данные завершенной заявки обновлены')
      return true
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить данные работы')
      return false
    }
  }

  async function removeLead(lead: Lead) {
    if (!window.confirm(`Удалить заявку от ${lead.name}?`)) return
    try {
      await request(`/admin/leads/${lead.id}`, { method: 'DELETE' })
      setSelectedLead(null)
      await loadData()
      setNotice('Заявка удалена')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось удалить заявку') }
  }

  async function removeItem(kind: 'projects' | 'news', id: string) {
    if (!window.confirm('Удалить эту запись?')) return
    try {
      await request(`/admin/${kind}/${id}`, { method: 'DELETE' })
      await loadData()
      setNotice('Запись удалена')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось удалить запись') }
  }

  async function removeWorkType(workType: WorkType) {
    if (!window.confirm(`Удалить тип работ «${workType.title}»? Существующие заявки сохранят название и расчет.`)) return
    try {
      await request(`/admin/work-types/${workType.id}`, { method: 'DELETE' })
      await loadData()
      setNotice('Тип работ удален')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось удалить тип работ') }
  }

  async function toggleWorkType(workType: WorkType) {
    try {
      await request(`/admin/work-types/${workType.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !workType.enabled }) })
      await loadData()
      setNotice(workType.enabled ? 'Тип работ скрыт с лендинга' : 'Тип работ опубликован')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось изменить видимость типа работ') }
  }

  if (session === 'checking') return <div className="screen-loading"><LoaderCircle className="spin" size={24} /></div>
  if (session === 'guest') return <LoginScreen username={username} password={password} setUsername={setUsername} setPassword={setPassword} onSubmit={login} error={loginError} busy={busy} />

  const currentTitle = view === 'leads' ? 'Заявки' : view === 'projects' ? 'Портфолио' : view === 'news' ? 'Новости' : view === 'workTypes' ? 'Типы работ' : 'Конструктор сайта'
  const currentCount = view === 'leads' ? total : view === 'projects' ? projects.length : view === 'news' ? news.length : view === 'workTypes' ? workTypes.length : landing?.sections.length ?? 0
  return (
    <div className="admin-shell">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <a className="admin-brand" href="#dashboard"><span className="brand-symbol"><HardHat size={20} /></span><span>ЧУВАШ<span>СТРОЙ</span><small>ПАНЕЛЬ УПРАВЛЕНИЯ</small></span></a>
        <div className="side-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav className="side-nav" aria-label="Разделы панели">
          <button className={view === 'leads' ? 'active' : ''} onClick={() => { setView('leads'); setMenuOpen(false) }}><ClipboardList size={18} /><span>Заявки</span><b>{summary.NEW}</b></button>
          <button className={view === 'projects' ? 'active' : ''} onClick={() => { setView('projects'); setMenuOpen(false) }}><FileImage size={18} /><span>Портфолио</span></button>
          <button className={view === 'news' ? 'active' : ''} onClick={() => { setView('news'); setMenuOpen(false) }}><FileText size={18} /><span>Новости</span></button>
          <button className={view === 'workTypes' ? 'active' : ''} onClick={() => { setView('workTypes'); setMenuOpen(false) }}><Wrench size={18} /><span>Типы работ</span></button>
          <button className={view === 'builder' ? 'active' : ''} onClick={() => { setView('builder'); setMenuOpen(false) }}><LayoutDashboard size={18} /><span>Конструктор сайта</span></button>
        </nav>
        <div className="sidebar-bottom"><span className="online-indicator" /><div><strong>Система работает</strong><small>Данные хранятся в PostgreSQL</small></div></div>
        <button className="logout-button" onClick={logout}><LogOut size={17} />Выйти из панели</button>
      </aside>

      <main className="admin-main" id="dashboard">
        <header className="topbar"><button className="mobile-menu" aria-label="Открыть меню" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button><div className="breadcrumbs">Чуваш Строй <ArrowRight size={14} /> <strong>{currentTitle}</strong></div><div className="topbar-right"><span className="today-date">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span className="admin-avatar">{username.slice(0, 1).toUpperCase() || 'А'}</span></div></header>
        <div className="page-content">
          <div className="page-heading"><div><span className="page-kicker">{view === 'leads' ? 'ОБЗОР / ОБРАЩЕНИЯ' : view === 'projects' ? 'КОНТЕНТ / ОБЪЕКТЫ' : view === 'news' ? 'КОНТЕНТ / ПУБЛИКАЦИИ' : view === 'workTypes' ? 'КАТАЛОГ / ТАРИФЫ' : 'НАСТРОЙКА САЙТА / СТРУКТУРА'}</span><h1>{currentTitle}<span className="heading-count">{currentCount}</span></h1></div>{(view === 'projects' || view === 'news' || view === 'workTypes') && <button className="primary-button" onClick={() => view === 'projects' ? setProjectEditor(null) : view === 'news' ? setNewsEditor(null) : setWorkTypeEditor(null)}><Plus size={17} />{view === 'projects' ? 'Добавить объект' : view === 'news' ? 'Новая новость' : 'Добавить тип работ'}</button>}</div>
          {notice && <div className="notice" role="status">{notice}<button aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={15} /></button></div>}

          {view === 'builder' && landing && <LandingBuilder initial={landing} onSaved={async () => { await loadData(); setNotice('Настройки лендинга сохранены') }} />}

          {view === 'leads' && <>
            <section className="summary-grid" aria-label="Сводка заявок">
              <SummaryCard label="Всего заявок" value={summary.total} icon={<ClipboardList size={17} />} tone="neutral" />
              <SummaryCard label="Новые" value={summary.NEW} icon={<ArrowDownLeft size={17} />} tone="orange" />
              <SummaryCard label="На рассмотрении" value={summary.UNDER_REVIEW} icon={<Search size={17} />} tone="blue" />
              <SummaryCard label="В работе" value={summary.IN_WORK} icon={<Check size={17} />} tone="green" />
              <SummaryCard label="Завершены" value={summary.COMPLETED} icon={<Check size={17} />} tone="neutral" />
            </section>
            <section className="data-section">
              <div className="toolbar"><div><h2>Входящие обращения</h2><p>Последние заявки с сайта и калькуляторов</p></div><button className="icon-button" onClick={() => void loadData()} title="Обновить список"><ArrowRight size={17} /></button></div>
              <div className="filters"><label className="search-box"><Search size={17} /><input placeholder="Имя, телефон или сообщение" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /><kbd>⌕</kbd></label><div className="filter-select"><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} aria-label="Фильтр по статусу"><option value="ALL">Все статусы</option>{Object.entries(statusNames).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><ChevronDown size={16} /></div></div>
              <div className="table-wrap"><table><thead><tr><th>ЗАЯВКА</th><th>УСЛУГА</th><th>СТАТУС</th><th>ДАТА</th><th></th></tr></thead><tbody>
                {busy ? <tr><td colSpan={5} className="table-state"><LoaderCircle className="spin" size={22} />Загружаем заявки</td></tr> : leads.length ? leads.map((lead) => <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="clickable-row"><td><strong>{lead.name}</strong><a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`} onClick={(event) => event.stopPropagation()}>{lead.phone}</a></td><td>{lead.service}{lead.quantity !== null && lead.unit ? <small className="lead-volume">{lead.quantity} {lead.unit}</small> : null}</td><td><StatusBadge status={lead.status} /></td><td>{formatDate(lead.createdAt)}</td><td><div className="lead-row-actions"><button className="delete-action" title="Удалить заявку" aria-label={`Удалить заявку от ${lead.name}`} onClick={(event) => { event.stopPropagation(); void removeLead(lead) }}><Trash2 size={16} /></button><ArrowUpRight size={16} /></div></td></tr>) : <tr><td colSpan={5} className="empty-state"><ClipboardList size={27} /><strong>Здесь пока пусто</strong><span>Новые обращения появятся в этом списке</span></td></tr>}
              </tbody></table></div>
              <div className="table-footer"><span>Показано {total ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, total)} из {total}</span><div className="pagination"><button disabled={page <= 1 || busy} onClick={() => setPage(page - 1)} aria-label="Предыдущая страница"><ArrowLeft size={15} /></button><span>{page} / {Math.max(1, Math.ceil(total / 50))}</span><button disabled={page >= Math.ceil(total / 50) || busy} onClick={() => setPage(page + 1)} aria-label="Следующая страница"><ArrowRight size={15} /></button></div></div>
            </section>
          </>}

          {view === 'projects' && <section className="content-grid">{busy ? <div className="panel-loading"><LoaderCircle className="spin" /></div> : projects.length ? projects.map((project) => <article className="content-card" key={project.id}><div className="content-cover" style={{ backgroundImage: `url("${project.imageUrl}")` }}><span className={project.isPublished ? 'publish-tag live' : 'publish-tag'}>{project.isPublished ? 'Опубликован' : 'Черновик'}</span></div><div className="content-card-body"><span>{project.category} · {project.location}</span><h2>{project.title}</h2><p>{project.duration || (project.area ? `${project.area} м²` : 'Площадь не указана')}</p>{project.description && <p>{project.description}</p>}<div className="card-actions"><button onClick={() => setProjectEditor(project)}>Изменить <ArrowUpRight size={14} /></button><button className="delete-action" onClick={() => void removeItem('projects', project.id)} aria-label={`Удалить ${project.title}`}><X size={16} /></button></div></div></article>) : <EmptyContent title="Работы еще не добавлены" action="Добавить первый объект" onClick={() => setProjectEditor(null)} />}</section>}

          {view === 'news' && <section className="news-admin-list">{busy ? <div className="panel-loading"><LoaderCircle className="spin" /></div> : news.length ? news.map((item) => <article className="news-admin-row" key={item.id}><div className="news-date-block"><span>{new Date(item.publishedAt).toLocaleDateString('ru-RU', { day: '2-digit' })}</span><small>{new Date(item.publishedAt).toLocaleDateString('ru-RU', { month: 'short' })}</small></div><div className="news-admin-copy"><div><span className={item.isPublished ? 'publish-tag live' : 'publish-tag'}>{item.isPublished ? 'Опубликована' : 'Черновик'}</span><h2>{item.title}</h2><p>{item.summary}</p></div></div><button className="row-edit" onClick={() => setNewsEditor(item)}>Редактировать <ArrowUpRight size={15} /></button><button className="delete-action" onClick={() => void removeItem('news', item.id)} aria-label={`Удалить ${item.title}`}><X size={16} /></button></article>) : <EmptyContent title="Публикаций пока нет" action="Создать первую новость" onClick={() => setNewsEditor(null)} />}</section>}

          {view === 'workTypes' && <section className="worktype-list">{busy ? <div className="panel-loading"><LoaderCircle className="spin" /></div> : workTypes.length ? workTypes.map((workType) => <article className={`worktype-row ${workType.enabled ? '' : 'is-disabled'}`} key={workType.id}><div><span className={workType.enabled ? 'publish-tag live' : 'publish-tag'}>{workType.enabled ? 'На лендинге' : 'Скрыт'}</span><h2>{workType.title}</h2><p>{new Intl.NumberFormat('ru-RU').format(workType.pricePerUnit)} ₽ за {workType.unit}</p></div><div className="worktype-actions"><button className="row-edit" onClick={() => setWorkTypeEditor(workType)}>Изменить <ArrowUpRight size={15} /></button><button className="secondary-button" onClick={() => void toggleWorkType(workType)}>{workType.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}{workType.enabled ? 'Скрыть' : 'Опубликовать'}</button><button className="delete-action" title="Удалить тип работ" aria-label={`Удалить ${workType.title}`} onClick={() => void removeWorkType(workType)}><Trash2 size={16} /></button></div></article>) : <EmptyContent title="Типы работ не настроены" action="Добавить тип работ" onClick={() => setWorkTypeEditor(null)} />}</section>}
        </div>
      </main>

      {selectedLead && <LeadDetails lead={selectedLead} onClose={() => setSelectedLead(null)} onStatus={changeStatus} onComplete={() => setCompletionLead(selectedLead)} onEditCompleted={() => setCompletionLead(selectedLead)} onDelete={removeLead} />}
      {completionLead && <CompletionEditor lead={completionLead} editing={completionLead.status === 'COMPLETED'} onClose={() => setCompletionLead(null)} onSaved={(work) => completionLead.status === 'COMPLETED' ? saveCompletedWork(completionLead, work) : changeStatus(completionLead, 'COMPLETED', work)} />}
      {projectEditor !== false && <ProjectEditor project={projectEditor} onClose={() => setProjectEditor(false)} onSaved={async () => { setProjectEditor(false); await loadData(); setNotice('Объект сохранен') }} />}
      {newsEditor !== false && <NewsEditor item={newsEditor} onClose={() => setNewsEditor(false)} onSaved={async () => { setNewsEditor(false); await loadData(); setNotice('Новость сохранена') }} />}
      {workTypeEditor !== false && <WorkTypeEditor workType={workTypeEditor} onClose={() => setWorkTypeEditor(false)} onSaved={async () => { setWorkTypeEditor(false); await loadData(); setNotice('Тип работ сохранен') }} />}
    </div>
  )
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return <article className="summary-card"><span className={`summary-icon ${tone}`}>{icon}</span><span className="summary-label">{label}</span><strong>{value}</strong><span className="summary-foot">за все время</span></article>
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><i />{statusNames[status]}</span>
}

function LoginScreen({ username, password, setUsername, setPassword, onSubmit, error, busy }: {
  username: string; password: string; setUsername: (value: string) => void; setPassword: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string; busy: boolean
}) {
  return <main className="login-screen"><div className="login-photo" /><section className="login-panel"><a className="admin-brand login-brand" href="#login"><span className="brand-symbol"><HardHat size={20} /></span><span>ЧУВАШ<span>СТРОЙ</span><small>ПАНЕЛЬ УПРАВЛЕНИЯ</small></span></a><div className="login-form-wrap"><span className="page-kicker">ЗАКРЫТЫЙ ДОСТУП</span><h1>С возвращением.</h1><p>Войдите, чтобы управлять заявками и материалами сайта.</p><form onSubmit={onSubmit}><label>Логин<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Имя пользователя" /></label><label>Пароль<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ваш пароль" /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button login-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{busy ? 'Проверяем…' : 'Войти в панель'}</button></form></div><div className="login-footer"><ShieldCheck size={15} /> Защищенное соединение · Чуваш Строй</div></section></main>
}

function LeadDetails({ lead, onClose, onStatus, onComplete, onEditCompleted, onDelete }: { lead: Lead; onClose: () => void; onStatus: (lead: Lead, status: Status) => void; onComplete: () => void; onEditCompleted: () => void; onDelete: (lead: Lead) => void }) {
  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="lead-drawer"><header><button className="back-button" onClick={onClose}><ArrowLeft size={17} />К списку</button><div className="drawer-header-actions"><button className="delete-action" title="Удалить заявку" aria-label={`Удалить заявку от ${lead.name}`} onClick={() => onDelete(lead)}><Trash2 size={17} /></button><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button></div></header><span className="page-kicker">ОБРАЩЕНИЕ · {lead.id.slice(-7).toUpperCase()}</span><h2>{lead.name}</h2><StatusBadge status={lead.status} /><div className="lead-data"><label>Телефон<a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}>{lead.phone}<ArrowUpRight size={15} /></a></label><label>Интересующая услуга<strong>{lead.service}</strong></label>{lead.quantity !== null && lead.unit && <label>Объем<strong>{lead.quantity} {lead.unit}</strong></label>}{lead.estimate !== null && <label>Предварительная стоимость<strong>{new Intl.NumberFormat('ru-RU').format(lead.estimate)} ₽</strong></label>}<label>Получена<strong>{formatDate(lead.createdAt)}</strong></label><label>Описание задачи<p>{lead.message || 'Клиент не оставил комментарий.'}</p></label></div>
    {lead.status === 'NEW' && <div className="drawer-actions"><span>Действия по заявке</span><button className="status-action accept" onClick={() => onStatus(lead, 'IN_WORK')}><Check size={17} />Принять в работу</button><button className="status-action review" onClick={() => onStatus(lead, 'UNDER_REVIEW')}><Search size={16} />На рассмотрении</button><button className="status-action reject" onClick={() => onStatus(lead, 'REJECTED')}><X size={16} />Отклонить заявку</button></div>}
    {lead.status === 'UNDER_REVIEW' && <div className="drawer-actions"><span>Действия по заявке</span><button className="status-action accept" onClick={() => onStatus(lead, 'IN_WORK')}><Check size={17} />Принять в работу</button><button className="status-action reject" onClick={() => onStatus(lead, 'REJECTED')}><X size={16} />Отклонить заявку</button></div>}
    {lead.status === 'IN_WORK' && <div className="drawer-actions"><span>Заявка в работе</span><button className="status-action complete" onClick={onComplete}><Check size={17} />Завершить и опубликовать работу</button></div>}
    {lead.status === 'REJECTED' && <div className="drawer-terminal-note">Заявка отклонена и закрыта. Изменение статуса недоступно.</div>}
    {lead.status === 'COMPLETED' && <div className="drawer-actions"><span>Заявка завершена</span><button className="status-action complete" onClick={onEditCompleted}><Pencil size={16} />Редактировать данные работы</button></div>}
    {lead.completedProject && <div className="completed-project-details"><strong>{lead.completedProject.title}</strong><span>Место: {lead.completedProject.location}</span><span>Срок: {lead.completedProject.duration}</span><p>{lead.completedProject.description}</p><img src={lead.completedProject.imageUrl} alt={lead.completedProject.title} /></div>}
    </aside></div>
}

function CompletionEditor({ lead, editing, onClose, onSaved }: { lead: Lead; editing: boolean; onClose: () => void; onSaved: (work: CompletedWork) => boolean | Promise<boolean> }) {
  const [draft, setDraft] = useState<CompletedWork>({ title: lead.completedProject?.title ?? lead.service, description: lead.completedProject?.description ?? '', location: lead.completedProject?.location ?? '', duration: lead.completedProject?.duration ?? '', imageUrl: lead.completedProject?.imageUrl ?? '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (!await onSaved(draft)) setError(editing ? 'Не удалось сохранить изменения. Проверьте данные и повторите попытку.' : 'Не удалось завершить заявку. Проверьте данные и повторите попытку.')
    } finally { setSaving(false) }
  }

  return <EditorModal title={editing ? 'Редактировать завершенную заявку' : 'Завершить заявку'} onClose={onClose}><form className="editor-form" onSubmit={submit}>
    <p className="completion-lead">{lead.name} · {lead.service}</p>
    <label>Название работы<input required minLength={2} maxLength={150} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
    <label>Описание проделанной работы<textarea required minLength={2} maxLength={2000} rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    <div className="form-two"><label>Где проводились работы<input required minLength={2} maxLength={150} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label><label>Срок выполнения<input required maxLength={100} placeholder="Например, 3 недели" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} /></label></div>
    <ImageField url={draft.imageUrl} setUrl={(imageUrl) => setDraft({ ...draft, imageUrl })} />
    {error && <p className="editor-error" role="alert">{error}</p>}
    <EditorActions onClose={onClose} saving={saving} />
  </form></EditorModal>
}

function WorkTypeEditor({ workType, onClose, onSaved }: { workType: WorkType | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [draft, setDraft] = useState({ title: workType?.title ?? '', unit: workType?.unit ?? 'м²', pricePerUnit: workType?.pricePerUnit ?? 0, sortOrder: workType?.sortOrder ?? 0, enabled: workType?.enabled ?? true })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await request(`/admin/work-types${workType ? `/${workType.id}` : ''}`, {
        method: workType ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...draft, pricePerUnit: Number(draft.pricePerUnit), sortOrder: Number(draft.sortOrder) }),
      })
      await onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить тип работ') }
    finally { setSaving(false) }
  }

  return <EditorModal title={workType ? 'Изменить тип работ' : 'Новый тип работ'} onClose={onClose}><form className="editor-form" onSubmit={submit}>
    <label>Название<input required minLength={2} maxLength={100} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Например, монтаж водостока" /></label>
    <div className="form-two"><label>Единица измерения<input required list="worktype-units" maxLength={20} value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="м², м³, пог. м, шт." /><datalist id="worktype-units"><option value="м²" /><option value="м³" /><option value="пог. м" /><option value="шт." /></datalist></label><label>Цена за единицу, ₽<input required type="number" min="0" max="100000000" step="0.01" value={draft.pricePerUnit} onChange={(event) => setDraft({ ...draft, pricePerUnit: Number(event.target.value) })} /></label></div>
    <label>Порядок показа<input type="number" min="0" max="10000" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
    <label className="check-field"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Показывать на лендинге и в форме заявки</label>
    {error && <p className="editor-error" role="alert">{error}</p>}
    <EditorActions onClose={onClose} saving={saving} />
  </form></EditorModal>
}

function ProjectEditor({ project, onClose, onSaved }: { project: Project | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [draft, setDraft] = useState({ title: project?.title ?? '', category: project?.category ?? '', location: project?.location ?? '', area: project?.area?.toString() ?? '', imageUrl: project?.imageUrl ?? '', description: project?.description ?? '', duration: project?.duration ?? '', sortOrder: project?.sortOrder ?? 0, isPublished: project?.isPublished ?? false })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...draft, area: draft.area ? Number(draft.area) : null, sortOrder: Number(draft.sortOrder) }
      await request(`/admin/projects${project ? `/${project.id}` : ''}`, { method: project ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      await onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка сохранения') } finally { setSaving(false) }
  }
  return <EditorModal title={project ? 'Изменить объект' : 'Новый объект'} onClose={onClose}><form className="editor-form" onSubmit={submit}><label>Название<input required minLength={2} maxLength={150} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><div className="form-two"><label>Вид работ<input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label><label>Локация<input required value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label></div><label>Описание<textarea rows={3} maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><div className="form-two"><label>Срок выполнения<input maxLength={100} value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} /></label><label>Площадь, м²<input type="number" min="1" value={draft.area} onChange={(event) => setDraft({ ...draft, area: event.target.value })} /></label></div><label>Порядок показа<input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label><ImageField url={draft.imageUrl} setUrl={(imageUrl) => setDraft({ ...draft, imageUrl })} /><label className="check-field"><input type="checkbox" checked={draft.isPublished} onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })} />Показывать на сайте</label>{error && <p className="editor-error">{error}</p>}<EditorActions onClose={onClose} saving={saving} /></form></EditorModal>
}

function NewsEditor({ item, onClose, onSaved }: { item: NewsPost | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [draft, setDraft] = useState({ title: item?.title ?? '', summary: item?.summary ?? '', body: item?.body ?? '', imageUrl: item?.imageUrl ?? '', publishedAt: item?.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10), isPublished: item?.isPublished ?? false })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...draft, publishedAt: new Date(`${draft.publishedAt}T12:00:00.000Z`).toISOString() }
      await request(`/admin/news${item ? `/${item.id}` : ''}`, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      await onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка сохранения') } finally { setSaving(false) }
  }
  return <EditorModal title={item ? 'Изменить новость' : 'Новая новость'} onClose={onClose}><form className="editor-form" onSubmit={submit}><label>Заголовок<input required minLength={2} maxLength={150} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>Краткое описание<textarea required rows={2} maxLength={500} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label><label>Текст публикации<textarea rows={5} maxLength={10000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label><label>Дата публикации<input type="date" required value={draft.publishedAt} onChange={(event) => setDraft({ ...draft, publishedAt: event.target.value })} /></label><ImageField url={draft.imageUrl} setUrl={(imageUrl) => setDraft({ ...draft, imageUrl })} optional /><label className="check-field"><input type="checkbox" checked={draft.isPublished} onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })} />Опубликовать на сайте</label>{error && <p className="editor-error">{error}</p>}<EditorActions onClose={onClose} saving={saving} /></form></EditorModal>
}

function ImageField({ url, setUrl, optional = false }: { url: string; setUrl: (value: string) => void; optional?: boolean }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  async function upload(file?: File) {
    if (!file) return
    setUploading(true); setError('')
    try {
      const data = new FormData(); data.append('image', file)
      const result = await request<{ url: string }>('/admin/uploads', { method: 'POST', body: data })
      setUrl(result.url)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить фото') } finally { setUploading(false) }
  }
  return <div className="image-field"><label>Фотография {optional && <span>(необязательно)</span>}<div className="image-input-row"><input placeholder="URL изображения" required={!optional} value={url} onChange={(event) => setUrl(event.target.value)} /><label className="upload-button" title="Загрузить фотографию">{uploading ? <LoaderCircle className="spin" size={17} /> : <FileImage size={17} />}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void upload(event.target.files?.[0])} /></label></div></label>{error && <span className="field-error">{error}</span>}{url && <img className="image-preview" src={url} alt="Предпросмотр" />}</div>
}

function EditorModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="editor-modal"><header><div><span className="page-kicker">КОНТЕНТ САЙТА</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button></header>{children}</section></div>
}

function EditorActions({ onClose, saving }: { onClose: () => void; saving: boolean }) {
  return <div className="editor-actions"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>
}

function EmptyContent({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return <div className="content-empty"><FileText size={27} /><strong>{title}</strong><button className="primary-button" onClick={onClick}><Plus size={16} />{action}</button></div>
}

export default App