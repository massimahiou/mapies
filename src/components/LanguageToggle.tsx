import React from 'react'
import { Globe } from 'lucide-react'
import { EmbedMapLanguage } from '../utils/embedMapTranslations'

interface LanguageToggleProps {
  language: EmbedMapLanguage
  onLanguageChange: (lang: EmbedMapLanguage) => void
  isMobile?: boolean
  showToggle?: boolean // If false, don't render the toggle button
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({ 
  language, 
  onLanguageChange,
  isMobile = false,
  showToggle = true // Default to showing the toggle
}) => {
  // Don't render if showToggle is false
  if (showToggle === false) {
    return null
  }
  const toggleLanguage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const newLanguage = language === 'en' ? 'fr' : 'en'
    onLanguageChange(newLanguage)
  }

  // Mobile positioning: under search bar, left side, smaller, closer to search bar
  if (isMobile) {
    return (
      <button
        onClick={toggleLanguage}
        type="button"
        className="absolute top-20 left-4 z-[1000] bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs shadow-sm border border-gray-200/60 transition-all duration-200 hover:bg-white/95 hover:shadow-md active:scale-95 flex items-center gap-1 touch-manipulation"
        style={{ fontSize: '11px' }}
        title={language === 'en' ? 'Switch to French / Passer au français' : 'Switch to English / Passer à l\'anglais'}
        aria-label={language === 'en' ? 'Switch to French' : 'Switch to English'}
      >
        <Globe className="w-2.5 h-2.5 text-gray-500" />
        <span className="font-medium text-gray-600">
          {language === 'en' ? 'EN' : 'FR'}
        </span>
      </button>
    )
  }

  // Desktop positioning: top-right corner
  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className="absolute top-3 right-3 z-[1000] bg-white/80 backdrop-blur-sm px-2 py-1.5 rounded-md shadow-sm border border-gray-200/60 transition-all duration-200 hover:bg-white/95 hover:shadow-md active:scale-95 flex items-center gap-1.5 touch-manipulation"
      title={language === 'en' ? 'Switch to French / Passer au français' : 'Switch to English / Passer à l\'anglais'}
      aria-label={language === 'en' ? 'Switch to French' : 'Switch to English'}
    >
      <Globe className="w-3.5 h-3.5 text-gray-500" />
      <span className="text-xs font-medium text-gray-600">
        {language === 'en' ? 'EN' : 'FR'}
      </span>
    </button>
  )
}

export default LanguageToggle

