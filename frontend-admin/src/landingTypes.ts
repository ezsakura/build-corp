export type LandingBlockType = 'hero' | 'services' | 'calculator' | 'projects' | 'news' | 'about' | 'contact' | 'custom'

export type LandingSection = {
  id: string
  type: LandingBlockType
  enabled: boolean
  eyebrow: string
  title: string
  subtitle: string
  body: string
  imageUrl: string
  ctaLabel: string
  secondaryLabel: string
  items: Array<{ title: string; text: string }>
}

export type LandingSettings = {
  brandName: string
  tagline: string
  city: string
  phone: string
  years: number
  projectsCompleted: number
  metaTitle: string
  metaDescription: string
  accentColor: string
  forestColor: string
}

export type LandingMedia = { id: string; title: string; imageUrl: string }
export type LandingPageDraft = { settings: LandingSettings; sections: LandingSection[]; projectImages: LandingMedia[]; newsImages: LandingMedia[] }