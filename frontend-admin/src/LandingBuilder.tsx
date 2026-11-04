import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Eye, EyeOff, FileImage, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react'
import type { LandingBlockType, LandingMedia, LandingPageDraft, LandingSection } from './landingTypes'

const blockNames: Record<LandingBlockType, string> = {
  hero: 'Первый экран',
  services: 'Услуги',
  calculator: 'Калькулятор',
  projects: 'Портфолио',
  news: 'Новости',
  about: 'О компании',
  contact: 'Обратная связь',
  custom: 'Текстовый блок',
}

const blockTypes = Object.keys(blockNames) as LandingBlockType[]

function createSection(type: LandingBlockType): LandingSection {
  return {
    id: `${type}-${crypto.randomUUID().slice(0, 8)}`,
    type,
    enabled: true,
    eyebrow: '',
    title: type === 'custom' ? 'Новый раздел' : blockNames[type],
    subtitle: '',
    body: '',
    imageUrl: '',
    ctaLabel: '',
    secondaryLabel: '',
    items: type === 'services' ? [{ title: 'Новая услуга', text: '' }] : [],
  }
}

async function uploadImage(file: File) {
  const formData = new FormData()
  formData.append('image', file)
  const response = await fetch('/api/admin/uploads', { method: 'POST', credentials: 'same-origin', body: formData })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? 'Не удалось загрузить изображение')
  return result.url as string
}

export default function LandingBuilder({ initial, onSaved }: { initial: LandingPageDraft; onSaved: () => void }) {
  const [draft, setDraft] = useState(initial)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newType, setNewType] = useState<LandingBlockType>('custom')
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(initial)
    setDirty(false)
  }, [initial])

  function updateSettings(key: keyof LandingPageDraft['settings'], value: string) {
    setDraft((current) => ({ ...current, settings: { ...current.settings, [key]: key === 'years' || key === 'projectsCompleted' ? Number(value) : value } }))
    setDirty(true)
  }

  function updateSection(id: string, patch: Partial<LandingSection>) {
    setDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section) }))
    setDirty(true)
  }

  function moveSection(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= draft.sections.length) return
    const sections = [...draft.sections]
    ;[sections[index], sections[destination]] = [sections[destination], sections[index]]
    setDraft((current) => ({ ...current, sections }))
    setDirty(true)
  }

  function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const section = createSection(newType)
    setDraft((current) => ({ ...current, sections: [...current.sections, section] }))
    setExpandedId(section.id)
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/landing', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Не удалось сохранить лендинг')
      setDirty(false)
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  async function handleUpload(section: LandingSection, file?: File) {
    if (!file) return
    setUploadingId(section.id)
    setError('')
    try { updateSection(section.id, { imageUrl: await uploadImage(file) }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка загрузки изображения') }
    finally { setUploadingId(null) }
  }

  async function handleMediaUpload(kind: 'projectImages' | 'newsImages', id: string, file?: File) {
    if (!file) return
    const uploadId = `${kind}-${id}`
    setUploadingId(uploadId)
    setError('')
    try {
      const imageUrl = await uploadImage(file)
      setDraft((current) => ({ ...current, [kind]: current[kind].map((item) => item.id === id ? { ...item, imageUrl } : item) }))
      setDirty(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка загрузки изображения') }
    finally { setUploadingId(null) }
  }

  function updateMedia(kind: 'projectImages' | 'newsImages', id: string, imageUrl: string) {
    setDraft((current) => ({ ...current, [kind]: current[kind].map((item) => item.id === id ? { ...item, imageUrl } : item) }))
    setDirty(true)
  }

  return <div className="landing-builder">
    <section className="builder-settings">
      <div className="builder-section-heading"><div><span className="page-kicker">ОБЩИЕ ПАРАМЕТРЫ</span><h2>О компании</h2></div><Eye size={18} /></div>
      <div className="builder-settings-grid">
        <label>Название компании<input value={draft.settings.brandName} maxLength={80} onChange={(event) => updateSettings('brandName', event.target.value)} /></label>
        <label>Подпись бренда<input value={draft.settings.tagline} maxLength={120} onChange={(event) => updateSettings('tagline', event.target.value)} /></label>
        <label>Город и регион<input value={draft.settings.city} maxLength={150} onChange={(event) => updateSettings('city', event.target.value)} /></label>
        <label>Телефон<input type="tel" value={draft.settings.phone} maxLength={32} onChange={(event) => updateSettings('phone', event.target.value)} /></label>
        <label>Лет опыта<input type="number" min="0" max="100" value={draft.settings.years} onChange={(event) => updateSettings('years', event.target.value)} /></label>
        <label>Сдано объектов<input type="number" min="0" max="100000" value={draft.settings.projectsCompleted} onChange={(event) => updateSettings('projectsCompleted', event.target.value)} /></label>
        <label>SEO-заголовок<input value={draft.settings.metaTitle} maxLength={120} onChange={(event) => updateSettings('metaTitle', event.target.value)} /></label>
        <label>SEO-описание<input value={draft.settings.metaDescription} maxLength={320} onChange={(event) => updateSettings('metaDescription', event.target.value)} /></label>
        <label>Акцентный цвет<input className="builder-color-input" type="color" value={draft.settings.accentColor} onChange={(event) => updateSettings('accentColor', event.target.value)} /></label>
        <label>Основной темный цвет<input className="builder-color-input" type="color" value={draft.settings.forestColor} onChange={(event) => updateSettings('forestColor', event.target.value)} /></label>
      </div>
    </section>

    <div className="builder-section-heading builder-blocks-heading"><div><span className="page-kicker">СТРУКТУРА СТРАНИЦЫ</span><h2>Блоки лендинга <span>{draft.sections.length}</span></h2></div><button className="primary-button" onClick={() => void save()} disabled={saving || !dirty}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{saving ? 'Сохраняем…' : dirty ? 'Сохранить страницу' : 'Все сохранено'}</button></div>

    <div className="builder-block-list">
      {draft.sections.map((section, index) => <article className={`builder-block ${section.enabled ? '' : 'is-disabled'} ${expandedId === section.id ? 'is-expanded' : ''}`} key={section.id}>
        <header className="builder-block-header">
          <span className="builder-order">{String(index + 1).padStart(2, '0')}</span>
          <button type="button" className={`builder-block-toggle ${expandedId === section.id ? 'is-expanded' : ''}`} onClick={() => setExpandedId(expandedId === section.id ? null : section.id)} aria-expanded={expandedId === section.id} aria-controls={`builder-editor-${section.id}`}>
            <span className="builder-block-info"><strong>{section.title || 'Без названия'}</strong><small>{blockNames[section.type]}</small></span>
            <ChevronDown size={17} aria-hidden="true" />
          </button>
          <div className="builder-block-actions">
            <button type="button" title="Переместить выше" aria-label="Переместить блок выше" disabled={index === 0} onClick={() => moveSection(index, -1)}><ArrowUp size={16} /></button>
            <button type="button" title="Переместить ниже" aria-label="Переместить блок ниже" disabled={index === draft.sections.length - 1} onClick={() => moveSection(index, 1)}><ArrowDown size={16} /></button>
            <button type="button" title={section.enabled ? 'Скрыть блок' : 'Показать блок'} aria-label={section.enabled ? 'Скрыть блок' : 'Показать блок'} onClick={() => updateSection(section.id, { enabled: !section.enabled })}>{section.enabled ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            <button type="button" className="builder-delete" title="Удалить блок" aria-label="Удалить блок" onClick={() => { setDraft((current) => ({ ...current, sections: current.sections.filter((item) => item.id !== section.id) })); setDirty(true) }}><Trash2 size={16} /></button>
          </div>
        </header>
        {expandedId === section.id && <div className="builder-block-editor" id={`builder-editor-${section.id}`}>
          <div className="builder-editor-grid">
            <label>Надзаголовок<input value={section.eyebrow} maxLength={120} onChange={(event) => updateSection(section.id, { eyebrow: event.target.value })} /></label>
            <label>Заголовок<input value={section.title} required maxLength={180} onChange={(event) => updateSection(section.id, { title: event.target.value })} /></label>
            <label>Вторая строка<input value={section.subtitle} maxLength={240} onChange={(event) => updateSection(section.id, { subtitle: event.target.value })} /></label>
            <label>Текст кнопки<input value={section.ctaLabel} maxLength={100} onChange={(event) => updateSection(section.id, { ctaLabel: event.target.value })} /></label>
          </div>
          <label className="builder-wide-field">Текст<textarea rows={4} maxLength={4000} value={section.body} onChange={(event) => updateSection(section.id, { body: event.target.value })} /></label>
          {section.type === 'hero' && <label className="builder-wide-field">Текст второй кнопки<input value={section.secondaryLabel} maxLength={100} onChange={(event) => updateSection(section.id, { secondaryLabel: event.target.value })} /></label>}
          {['hero', 'calculator', 'about', 'custom'].includes(section.type) && <div className="builder-image-field">
            <label>Изображение<input value={section.imageUrl} maxLength={1000} placeholder="URL или /uploads/..." onChange={(event) => updateSection(section.id, { imageUrl: event.target.value })} /></label>
            <label className="builder-upload" title="Загрузить изображение">{uploadingId === section.id ? <LoaderCircle className="spin" size={17} /> : <FileImage size={17} />}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void handleUpload(section, event.target.files?.[0])} /></label>
            {section.imageUrl && <img src={section.imageUrl} alt="Предпросмотр изображения блока" />}
          </div>}
          {section.type === 'projects' && <MediaEditor title="Фотографии объектов" items={draft.projectImages} uploadingId={uploadingId} uploadKey="projectImages" onChange={(id, imageUrl) => updateMedia('projectImages', id, imageUrl)} onUpload={(id, file) => void handleMediaUpload('projectImages', id, file)} />}
          {section.type === 'news' && <MediaEditor title="Фотографии новостей" items={draft.newsImages} uploadingId={uploadingId} uploadKey="newsImages" onChange={(id, imageUrl) => updateMedia('newsImages', id, imageUrl)} onUpload={(id, file) => void handleMediaUpload('newsImages', id, file)} />}
          {section.type === 'services' && <div className="builder-items-editor"><div><strong>Карточки услуг</strong><button className="secondary-button" type="button" onClick={() => updateSection(section.id, { items: [...section.items, { title: '', text: '' }] })}><Plus size={14} />Добавить карточку</button></div>{section.items.map((item, itemIndex) => <div className="builder-item-fields" key={`${section.id}-${itemIndex}`}><label>Название<input value={item.title} maxLength={120} onChange={(event) => updateSection(section.id, { items: section.items.map((current, index) => index === itemIndex ? { ...current, title: event.target.value } : current) })} /></label><label>Описание<input value={item.text} maxLength={600} onChange={(event) => updateSection(section.id, { items: section.items.map((current, index) => index === itemIndex ? { ...current, text: event.target.value } : current) })} /></label><button type="button" title="Удалить карточку" aria-label="Удалить карточку" onClick={() => updateSection(section.id, { items: section.items.filter((_, index) => index !== itemIndex) })}><Trash2 size={15} /></button></div>)}</div>}
        </div>}
      </article>)}
    </div>

    <form className="builder-add-section" onSubmit={addSection}>
      <label>Новый блок<select value={newType} onChange={(event) => setNewType(event.target.value as LandingBlockType)}>{blockTypes.map((type) => <option value={type} key={type}>{blockNames[type]}</option>)}</select></label>
      <button className="secondary-button"><Plus size={16} />Добавить блок</button>
    </form>
    {error && <p className="editor-error" role="alert">{error}</p>}
    <div className="builder-save-bottom"><span>{dirty ? 'Есть несохраненные изменения' : 'Опубликованная версия актуальна'}</span><button className="primary-button" onClick={() => void save()} disabled={saving || !dirty}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? 'Сохраняем…' : 'Сохранить изменения'}</button></div>
  </div>
}

function MediaEditor({ title, items, uploadingId, uploadKey, onChange, onUpload }: {
  title: string
  items: LandingMedia[]
  uploadingId: string | null
  uploadKey: 'projectImages' | 'newsImages'
  onChange: (id: string, imageUrl: string) => void
  onUpload: (id: string, file?: File) => void
}) {
  return <div className="builder-media-editor"><strong>{title}</strong>{items.length === 0 ? <p>Пока нет опубликованных записей.</p> : items.map((item) => {
    const key = `${uploadKey}-${item.id}`
    return <div className="builder-media-row" key={item.id}><span>{item.title}</span><input aria-label={`Фото: ${item.title}`} value={item.imageUrl} placeholder="URL изображения" maxLength={1000} onChange={(event) => onChange(item.id, event.target.value)} /><label className="builder-upload" title={`Загрузить фото: ${item.title}`}>{uploadingId === key ? <LoaderCircle className="spin" size={17} /> : <FileImage size={17} />}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => onUpload(item.id, event.target.files?.[0])} /></label>{item.imageUrl && <img src={item.imageUrl} alt={`Предпросмотр: ${item.title}`} />}</div>
  })}</div>
}