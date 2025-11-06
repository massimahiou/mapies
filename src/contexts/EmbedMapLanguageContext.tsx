import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { EmbedMapLanguage, embedMapTranslations, EmbedMapTranslations } from '../utils/embedMapTranslations'

const STORAGE_KEY = 'pinz_map_language'

interface EmbedMapLanguageContextType {
  language: EmbedMapLanguage
  setLanguage: (lang: EmbedMapLanguage) => void
  t: (key: string, params?: Record<string, string | number>) => string
  translations: EmbedMapTranslations
}

const EmbedMapLanguageContext = createContext<EmbedMapLanguageContextType | undefined>(undefined)

/**
 * Detect browser language and return appropriate language code
 */
const detectBrowserLanguage = (): EmbedMapLanguage => {
  if (typeof window === 'undefined') return 'en'
  
  // Get browser language
  const browserLang = navigator.language || navigator.languages?.[0] || 'en'
  
  // Check if French (fr, fr-FR, fr-CA, etc.)
  if (browserLang.toLowerCase().startsWith('fr')) {
    return 'fr'
  }
  
  // Default to English
  return 'en'
}

/**
 * Get language from URL parameter if present
 */
const getLanguageFromURL = (): EmbedMapLanguage | null => {
  if (typeof window === 'undefined') return null
  
  try {
    const params = new URLSearchParams(window.location.search)
    const langParam = params.get('lang')
    if (langParam === 'en' || langParam === 'fr') {
      return langParam as EmbedMapLanguage
    }
  } catch (error) {
    // URL parsing failed, ignore
  }
  
  return null
}

/**
 * Get initial language from URL parameter, localStorage, or browser
 */
const getInitialLanguage = (): EmbedMapLanguage => {
  if (typeof window === 'undefined') return 'en'
  
  // Priority 1: URL parameter (highest priority, locks language)
  const urlLang = getLanguageFromURL()
  if (urlLang) {
    return urlLang
  }
  
  try {
    // Priority 2: localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'fr') {
      return stored as EmbedMapLanguage
    }
  } catch (error) {
    // localStorage might be disabled, fall back to browser detection
  }
  
  // Priority 3: Browser language detection
  return detectBrowserLanguage()
}

/**
 * Translation function that replaces placeholders
 */
const translate = (
  translations: EmbedMapTranslations,
  key: string,
  params?: Record<string, string | number>
): string => {
  const keys = key.split('.')
  let value: any = translations
  
  for (const k of keys) {
    value = value?.[k]
    if (value === undefined) {
      return key // Fallback to key if translation not found
    }
  }
  
  if (typeof value !== 'string') {
    return key // Fallback if not a string
  }
  
  // Replace placeholders like {count}
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match
    })
  }
  
  return value
}

interface EmbedMapLanguageProviderProps {
  children: React.ReactNode
}

export const EmbedMapLanguageProvider: React.FC<EmbedMapLanguageProviderProps> = ({ children }) => {
  // Check if language is locked by URL parameter
  const urlLang = getLanguageFromURL()
  const isLanguageLocked = urlLang !== null
  
  const [language, setLanguageState] = useState<EmbedMapLanguage>(getInitialLanguage())
  
  // Update language and persist to localStorage (only if not locked by URL)
  const setLanguage = useCallback((newLanguage: EmbedMapLanguage) => {
    // Don't allow language changes if locked by URL parameter
    if (isLanguageLocked) {
      return
    }
    
    setLanguageState(newLanguage)
    try {
      localStorage.setItem(STORAGE_KEY, newLanguage)
    } catch (error) {
      // localStorage might be disabled, ignore
    }
  }, [isLanguageLocked])
  
  // If URL parameter changed, update language (but don't allow manual changes)
  React.useEffect(() => {
    if (urlLang && urlLang !== language) {
      setLanguageState(urlLang)
    }
  }, [urlLang, language])
  
  // Get translations for current language - useMemo to ensure it updates when language changes
  const translations = useMemo(() => embedMapTranslations[language], [language])
  
  // Translation function - depends on translations which depends on language
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    return translate(translations, key, params)
  }, [translations])
  
  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    translations
  }), [language, setLanguage, t, translations])
  
  return (
    <EmbedMapLanguageContext.Provider value={value}>
      {children}
    </EmbedMapLanguageContext.Provider>
  )
}

/**
 * Hook for using embed map language context
 */
export const useEmbedMapLanguage = () => {
  const context = useContext(EmbedMapLanguageContext)
  if (context === undefined) {
    // Fallback if context is not available (shouldn't happen, but for safety)
    const fallbackLanguage: EmbedMapLanguage = getInitialLanguage()
    const fallbackTranslations = embedMapTranslations[fallbackLanguage]
    const fallbackT = (key: string, params?: Record<string, string | number>) => {
      return translate(fallbackTranslations, key, params)
    }
    return {
      language: fallbackLanguage,
      setLanguage: () => {},
      t: fallbackT,
      translations: fallbackTranslations
    }
  }
  return context
}

