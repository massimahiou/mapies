import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  MapPin, 
  Upload, 
  Zap, 
  Globe, 
  CheckCircle, 
  Star,
  ArrowRight,
  Sparkles,
  Heart,
  ChevronDown,
  Languages,
  Tag
} from 'lucide-react'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'
import AuthModal from './AuthModal'
import PublicMap from './PublicMap'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { translations, Language } from '../utils/landingPageTranslations'
import SEO from './SEO'

// Wrapper component to only render map when visible (performance optimization)
const DemoMapWrapper: React.FC<{ mapId: string; customSettings: any }> = ({ mapId, customSettings }) => {
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting)
        })
      },
      { 
        rootMargin: '100px', // Start loading 100px before it's visible
        threshold: 0.1
      }
    )

    observer.observe(containerRef.current)

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full">
      {isVisible && (
        <PublicMap 
          mapId={mapId} 
          customSettings={customSettings}
        />
      )}
    </div>
  )
}

// Animated word component with 3D roll effect
const RollingWord: React.FC<{ words: string[] }> = ({ words }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showStar, setShowStar] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!hasStarted || !isAnimating) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1
        if (next >= words.length) {
          setIsAnimating(false)
          setShowStar(true)
          return words.length - 1 // Stay on "yourself"
        }
        return next
      })
    }, 600) // Change word every 600ms

    return () => clearInterval(interval)
  }, [isAnimating, hasStarted, words.length])

  // Use IntersectionObserver to detect when element comes into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStarted) {
            setHasStarted(true)
            setIsAnimating(true)
          }
        })
      },
      { 
        threshold: 0.3, // Start when 30% visible
        rootMargin: '0px' 
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [hasStarted])

  const currentWord = words[currentIndex]
  const isLastWord = currentIndex === words.length - 1
  
  // Find longest word to set fixed width
  const longestWord = words.reduce((a, b) => a.length > b.length ? a : b)
  const longestWordLength = longestWord.length

  return (
    <span ref={ref} className="relative inline-block mx-1" style={{ width: `${longestWordLength}ch`, minWidth: `${longestWordLength}ch` }}>
      <motion.span
        key={currentIndex}
        className="inline-block"
        initial={{ rotateX: 90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ 
          duration: 0.4,
          ease: "easeOut"
        }}
        style={{ transformPerspective: 1000 }}
      >
        {currentWord}
      </motion.span>
      {showStar && isLastWord && (
        <motion.div
          className="absolute -top-2"
          style={{ right: `calc(${longestWordLength}ch - ${currentWord.length}ch - 0.5rem)` }}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ 
            scale: 1, 
            rotate: [0, -15, 15, -10, 10, 0],
            filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"]
          }}
          transition={{ 
            scale: {
              type: "spring",
              stiffness: 300,
              damping: 20
            },
            rotate: {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.25, 0.5, 0.75, 1]
            },
            filter: {
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
        >
          <motion.div
            className="absolute inset-0 blur-sm"
            animate={{
              opacity: [0, 0.8, 0],
              scale: [1, 1.3, 1]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
          </motion.div>
          <Star className="w-4 h-4 text-yellow-300 fill-yellow-300 relative z-10 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
        </motion.div>
      )}
    </span>
  )
}

const LandingPage: React.FC = () => {
  const [language, setLanguage] = useState<Language>(() => {
    // Get language from localStorage (user preference takes priority)
    const saved = localStorage.getItem('landingPageLanguage') as Language | null
    if (saved) return saved
    // Default to browser language for now, will be updated after IP detection
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('fr') ? 'fr' : 'en'
  })
  
  // Detect language based on IP geolocation
  useEffect(() => {
    // Only detect if user hasn't manually set a preference
    const saved = localStorage.getItem('landingPageLanguage')
    if (saved) return // User already chose a language
    
    // List of French-speaking country codes
    const frenchSpeakingCountries = ['FR', 'CA', 'BE', 'CH', 'LU', 'MC', 'SN', 'CM', 'CI', 'MA', 'DZ', 'TN', 'CD', 'MG', 'BJ', 'TG', 'ML', 'BF', 'NE', 'TD', 'CF', 'KM', 'DJ', 'GA', 'CG', 'GN', 'RW', 'BI', 'VU', 'PF', 'NC', 'WF', 'GP', 'MQ', 'RE', 'GF', 'YT', 'PM', 'BL', 'MF']
    
    // Try multiple geolocation services for reliability
    const detectLanguage = async () => {
      try {
        // Try geojs.io first (free, no API key needed)
        const response = await fetch('https://get.geojs.io/v1/ip/country.json', {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          const countryCode = data.country?.toUpperCase()
          
          if (countryCode && frenchSpeakingCountries.includes(countryCode)) {
            setLanguage('fr')
            localStorage.setItem('landingPageLanguage', 'fr')
            return
          }
        }
      } catch (error) {
        console.log('GeoJS detection failed, trying fallback...', error)
      }
      
      try {
        // Fallback to ipapi.co (free tier: 1000 requests/day)
        const response = await fetch('https://ipapi.co/json/', {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          const countryCode = data.country_code?.toUpperCase()
          
          if (countryCode && frenchSpeakingCountries.includes(countryCode)) {
            setLanguage('fr')
            localStorage.setItem('landingPageLanguage', 'fr')
          }
        }
      } catch (error) {
        console.log('IPAPI detection failed, using browser language', error)
        // Fallback to browser language (already set initially)
      }
    }
    
    detectLanguage()
  }, [])
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login')
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  
  const t = translations[language]
  
  // Save language preference
  useEffect(() => {
    localStorage.setItem('landingPageLanguage', language)
  }, [language])
  
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'fr' : 'en')
  }
  
  // Show success message if email was just verified
  useEffect(() => {
    if (searchParams.get('verified') === 'true' && searchParams.get('emailVerified') === 'true') {
      showToast({
        type: 'success',
        title: t.toast.emailVerified,
        message: t.toast.emailVerifiedMessage
      })
      // Clean up URL
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams, showToast, t])
  const [activeSection, setActiveSection] = useState('hero')
  const [currentUserType, setCurrentUserType] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showDemoMap, setShowDemoMap] = useState(false)
  const [mapSettings, setMapSettings] = useState({
    style: 'dark',
    markerShape: 'pin',
    markerColor: '#ff3670',
    markerSize: 'medium',
    clusteringEnabled: false
  })

  const userTypes = t.userTypes

  // Typewriter effect with backspace
  useEffect(() => {
    const currentText = userTypes[currentUserType]
    let i = 0
    let isDeleting = false
    setIsTyping(true)
    setDisplayedText('')

    const typeWriter = () => {
      if (!isDeleting && i < currentText.length) {
        // Typing forward
        setDisplayedText(currentText.substring(0, i + 1))
        i++
        setTimeout(typeWriter, 150) // Slower typing speed
      } else if (!isDeleting && i === currentText.length) {
        // Finished typing, wait then start deleting
        setIsTyping(false)
        setTimeout(() => {
          isDeleting = true
          setIsTyping(true)
          typeWriter()
        }, 2000) // Wait 2 seconds before deleting
      } else if (isDeleting && i > 0) {
        // Deleting backward
        setDisplayedText(currentText.substring(0, i - 1))
        i--
        setTimeout(typeWriter, 100) // Faster deleting speed
      } else if (isDeleting && i === 0) {
        // Finished deleting, move to next word
        setIsTyping(false)
        setTimeout(() => {
          setCurrentUserType((prev) => (prev + 1) % userTypes.length)
        }, 500) // Short pause before next word
      }
    }

    typeWriter()
  }, [currentUserType])

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false)
    // Redirect to dashboard after successful auth
    window.location.href = '/auth'
  }

  // Navigation sections
  const sections = [
    { id: 'hero', label: t.nav.home, name: t.nav.home },
    { id: 'demo', label: t.nav.demo, name: t.nav.demo },
    { id: 'features', label: t.nav.features, name: t.nav.features },
    { id: 'pricing', label: t.nav.pricing, name: t.nav.pricing },
    { id: 'footer', label: t.nav.contact, name: t.nav.contact }
  ]

  // Scroll detection for active section - Throttled for performance
  useEffect(() => {
    let lastScrollTime = 0
    const throttleDelay = 100 // Throttle to max once per 100ms

    const handleScroll = () => {
      const now = Date.now()
      if (now - lastScrollTime < throttleDelay) return
      lastScrollTime = now

      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = document.getElementById(section.id)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" }
  }

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const features = t.features.items.map((item, index) => {
    const icons = [MapPin, Upload, Zap, Tag, Star, Globe]
    const colors = [
      "from-pink-500 to-rose-500",
      "from-rose-500 to-pink-600",
      "from-pink-600 to-rose-600",
      "from-rose-600 to-pink-500",
      "from-pink-500 to-rose-500",
      "from-rose-500 to-pink-600"
    ]
    return {
      icon: icons[index],
      title: item.title,
      description: item.description,
      color: colors[index],
      delay: index * 0.1
    }
  })

  // Get rolling words for RollingWord component
  const rollingWords = Object.values(t.typewriter)
  
  // SEO content based on language
  const seoTitle = language === 'fr' 
    ? 'PINZ - Créez des Cartes Interactives pour votre Entreprise'
    : 'PINZ - Create Interactive Maps for Your Business'
  
  const seoDescription = language === 'fr'
    ? 'Le moyen le plus simple de créer une carte interactive pour votre entreprise, vos magasins ou vos marqueurs. Créez, personnalisez et partagez vos cartes en quelques minutes.'
    : 'The easiest way to create interactive maps for your business, stores, or markers. Create, customize, and share your maps in minutes.'
  
  const ogImage = 'https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5'
  
  return (
    <>
      <SEO 
        title={seoTitle}
        description={seoDescription}
        image={ogImage}
        language={language}
      />
      <div className="min-h-screen bg-white overflow-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes blink-caret {
            from, to { border-color: transparent }
            50% { border-color: #ec4899 }
          }
        `
      }} />
      {/* Language Toggle Button - Mobile (top right, above nav) */}
      <motion.button
        onClick={toggleLanguage}
        className="fixed top-2 right-2 z-[60] px-2.5 py-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-pink-200 hover:bg-pink-50 transition-all duration-300 flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-pink-600 lg:hidden"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Languages className="w-3.5 h-3.5" />
        <span className="font-semibold">{language.toUpperCase()}</span>
      </motion.button>
      
      {/* Language Toggle Button - Desktop */}
      <motion.button
        onClick={toggleLanguage}
        className="hidden lg:flex fixed top-4 right-4 z-[60] px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-pink-200 hover:bg-pink-50 transition-all duration-300 items-center gap-2 text-sm font-medium text-gray-700 hover:text-pink-600"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Languages className="w-4 h-4" />
        <span className="font-semibold">{language.toUpperCase()}</span>
      </motion.button>
      
      {/* Mobile Top Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-pink-100 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3 pr-16">
          {/* Logo */}
          <img
            src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
            alt="PINZ Logo"
            className="h-8"
            loading="eager"
            fetchPriority="high"
          />
          
          {/* Navigation Menu */}
          <div className="flex space-x-1">
            {sections.map((section) => (
              <motion.button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeSection === section.id
                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-200'
                    : 'text-gray-600 hover:text-pink-500 hover:bg-pink-50'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <MapPin className={`w-3 h-4 ${
                  activeSection === section.id
                    ? 'text-white'
                    : 'text-gray-500 group-hover:text-pink-500'
                }`} />
                <span>{section.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Vertical Navigation - Desktop */}
      <div className="fixed left-6 top-1/2 transform -translate-y-1/2 z-50 hidden lg:block">
        <div className="flex flex-col items-center space-y-4">
          {/* Vertical Line */}
          <div className="w-0.5 h-32 bg-gradient-to-b from-pink-300 to-rose-400 rounded-full"></div>
          
          {/* Navigation Dots */}
            {sections.map((section) => (
              <motion.button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`relative group transition-all duration-300 ${
                  activeSection === section.id 
                    ? 'scale-125' 
                    : 'scale-100 hover:scale-110'
                }`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* MapPin Icon */}
                <MapPin className={`w-5 h-6 transition-all duration-300 ${
                  activeSection === section.id
                    ? 'text-pink-500 drop-shadow-lg'
                    : 'text-gray-400 group-hover:text-pink-400'
                }`} />
                
                {/* Label */}
                <div className="absolute left-8 top-1/2 transform -translate-y-1/2 bg-pink-500 text-white px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out translate-x-[-10px] group-hover:translate-x-0">
                  {section.name}
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-pink-500"></div>
                </div>
              </motion.button>
            ))}
          
          {/* Bottom Line */}
          <div className="w-0.5 h-16 bg-gradient-to-b from-rose-400 to-pink-300 rounded-full"></div>
        </div>
      </div>

      {/* Hero Section */}
      <motion.section 
        id="hero"
        className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-rose-50 pt-16 lg:pt-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Background Elements - Removed continuous animations for performance */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Static background elements */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-200 rounded-full opacity-10" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-200 rounded-full opacity-10" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-100 to-rose-100 text-pink-800 rounded-full text-sm font-semibold mb-8 shadow-lg border border-pink-200">
              <MapPin className="w-5 h-5 text-pink-600 mr-2" />
              {t.hero.badge}
              <div className="ml-2 w-2 h-2 bg-pink-500 rounded-full" />
            </div>
          </motion.div>

          {/* Logo */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <img
              src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
              alt="PINZ - Interactive Maps Platform Logo"
              className="h-24 md:h-32 mx-auto"
              loading="eager"
              fetchPriority="high"
            />
          </motion.div>

          <motion.h1 
            className="text-3xl md:text-5xl font-bold text-gray-900 mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {t.hero.title}
            <br />
            <br />
            <div className="inline-block w-48 md:w-64 text-center relative">
              {/* Glowing effect behind text */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-pink-400/20 to-rose-400/20 rounded-lg blur-sm"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span 
                className="relative bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent whitespace-nowrap overflow-hidden border-r-2 border-pink-600 pr-1"
                style={{
                  animation: isTyping ? 'none' : 'blink-caret 0.75s step-end infinite'
                }}
              >
                {displayedText}
              </span>
            </div>
          </motion.h1>


          <motion.div 
            className="flex flex-col sm:flex-row gap-3 justify-center mb-8 max-w-md mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {/* Primary CTA - Create Account */}
            <motion.button
              className="relative px-8 py-4 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-pink-500/25 transition-all duration-300 flex items-center justify-center overflow-hidden group order-1"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setAuthModalMode('signup')
                setIsAuthModalOpen(true)
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              {/* Removed shimmer animation for performance */}
              
              <span className="relative z-10 flex items-center">
                {t.hero.createAccount}
                <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </motion.button>

            {/* Secondary CTA - Sign In */}
            <motion.button
              className="px-8 py-4 bg-white text-gray-700 rounded-xl font-medium text-lg border-2 border-gray-200 hover:border-pink-300 hover:text-pink-600 transition-all duration-300 flex items-center justify-center order-2"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setAuthModalMode('login')
                setIsAuthModalOpen(true)
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
            >
              {t.hero.signIn}
            </motion.button>
          </motion.div>

          <motion.p 
            className="text-sm text-gray-500 mt-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            {t.hero.freeText}
          </motion.p>
        </div>

        {/* Floating Elements - Static for performance (removed continuous animations) */}
        <div className="absolute top-20 left-8 w-12 h-12 bg-pink-200 rounded-lg opacity-20" />
        <div className="absolute top-16 right-12 w-8 h-8 bg-rose-200 rounded-full opacity-25" />
      </motion.section>

      {/* Tagline Section */}
      <motion.section 
        className="py-20 bg-gradient-to-r from-pink-600 to-rose-600"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight inline-block">
              {t.tagline.main} <RollingWord words={rollingWords} /> {t.tagline.connector || (language === 'en' ? 'on a map' : '')}
              <motion.span
                className="inline-block"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                .
              </motion.span>
            </h2>
            <motion.div 
              className="flex items-center justify-center space-x-2 text-pink-100 text-lg md:text-xl mt-6"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              viewport={{ once: true }}
            >
              <span>{t.tagline.madeWith}</span>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Heart className="w-5 h-5 text-pink-200 fill-pink-200" />
              </motion.div>
              <span>{t.tagline.inMontreal}</span>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Demo Map Section */}
      <motion.section 
        id="demo"
        className="py-20 bg-gradient-to-br from-pink-50 via-white to-rose-50 relative overflow-hidden"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {t.demo.title}
            </h2>
            <p className="text-xl text-gray-600 mb-4 max-w-3xl mx-auto">
              {t.demo.description}
            </p>
            <motion.div
              className="flex justify-center mb-8"
              animate={{ y: [0, 8, 0] }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <button
                onClick={() => {
                  const demoElement = document.getElementById('demo-map-container')
                  if (demoElement) {
                    demoElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
                className="text-pink-600 hover:text-pink-700 transition-colors"
                aria-label="Scroll to demo map"
              >
                <ChevronDown className="w-8 h-8" />
              </button>
            </motion.div>
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm">
                <MapPin className="w-4 h-5 text-pink-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">{t.demo.markersCount}</span>
              </div>
              <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm">
                <Globe className="w-4 h-5 text-pink-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">{t.demo.countries}</span>
              </div>
              <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm">
                <Zap className="w-4 h-5 text-pink-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">{t.demo.fast}</span>
              </div>
            </div>
          </motion.div>

          {/* Demo Map Container */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="h-[500px] md:h-[500px] lg:h-[600px] relative" id="demo-map-container">
              {!showDemoMap ? (
                // Cool reveal button/placeholder
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="text-center px-8">
                    {/* Animated map icon */}
                    <motion.div
                      className="mb-8 flex justify-center"
                      animate={{
                        y: [0, -10, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <div className="relative">
                        <Globe className="w-24 h-24 text-pink-500 opacity-20" />
                        <MapPin className="w-12 h-12 text-pink-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      </div>
                    </motion.div>
                    
                    {/* Title */}
                    <motion.h3
                      className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      {t.demo.readyToExplore}
                    </motion.h3>
                    
                    {/* Description */}
                    <motion.p
                      className="text-lg text-gray-600 mb-8 max-w-md mx-auto"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      {t.demo.exploreDescription}
                    </motion.p>
                    
                    {/* Reveal Button */}
                    <motion.button
                      onClick={() => setShowDemoMap(true)}
                      className="group relative px-8 py-4 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Shimmer effect */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{
                          x: ['-100%', '100%'],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      />
                      
                      <span className="relative flex items-center justify-center gap-2">
                        <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        {t.demo.loadMap}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                // Demo Map Component - Only render when revealed
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <DemoMapWrapper
                    mapId="demo-map-1000-markers" 
                    customSettings={mapSettings}
                  />
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Subtle Map Controls - Only visible after map is loaded */}
          {showDemoMap && (
          <motion.div
            className="mt-6 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-4 max-w-3xl w-full">
              {/* Header with disclaimer */}
              <div className="text-center mb-4">
                <p className="text-xs text-gray-500 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-pink-50 text-pink-600 text-xs font-medium">
                    {t.demo.demoControls}
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  {t.demo.controlsDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Map Style */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">{t.demo.style}</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setMapSettings({...mapSettings, style: 'light'})}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        mapSettings.style === 'light' 
                          ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {t.demo.light}
                    </button>
                    <button
                      onClick={() => setMapSettings({...mapSettings, style: 'dark'})}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        mapSettings.style === 'dark' 
                          ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {t.demo.dark}
                    </button>
                  </div>
                </div>

                {/* Marker Shape */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">{t.demo.shape}</label>
                  <div className="flex gap-1">
                    {[
                      { value: 'circle', label: '●' },
                      { value: 'square', label: '■' },
                      { value: 'triangle', label: '▲' },
                      { value: 'pin', label: <MapPin className="w-3 h-3" /> }
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setMapSettings({...mapSettings, markerShape: value})}
                        className={`w-6 h-6 flex items-center justify-center text-xs rounded-md transition-colors ${
                          mapSettings.markerShape === value 
                            ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                        title={value.charAt(0).toUpperCase() + value.slice(1)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Marker Color */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">{t.demo.color}</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
                      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() => setMapSettings({...mapSettings, markerColor: color})}
                        className={`w-5 h-5 rounded-full border transition-all ${
                          mapSettings.markerColor === color 
                            ? 'border-gray-400 scale-110 shadow-sm' 
                            : 'border-gray-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Clustering */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">{t.demo.clustering}</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setMapSettings({...mapSettings, clusteringEnabled: true})}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        mapSettings.clusteringEnabled 
                          ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {t.demo.on}
                    </button>
                    <button
                      onClick={() => setMapSettings({...mapSettings, clusteringEnabled: false})}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        !mapSettings.clusteringEnabled 
                          ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {t.demo.off}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          )}

          {/* Demo Features */}
          <motion.div
            className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t.demo.interactiveMarkers}</h3>
              <p className="text-gray-600">{t.demo.interactiveMarkersDesc}</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t.demo.lightningPerformance}</h3>
              <p className="text-gray-600">{t.demo.lightningPerformanceDesc}</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t.demo.globalScale}</h3>
              <p className="text-gray-600">{t.demo.globalScaleDesc}</p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-br from-pink-50 via-white to-rose-50 relative overflow-hidden">
        {/* Static Background Elements - Removed animations for performance */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-32 h-32 bg-pink-200 rounded-full opacity-10" />
          <div className="absolute top-40 right-20 w-24 h-24 bg-rose-200 rounded-full opacity-15" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="inline-flex items-center px-4 py-2 bg-pink-100 text-pink-800 rounded-full text-sm font-medium mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t.features.badge}
            </motion.div>
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              {t.features.title}
              <span className="block bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                {language === 'en' ? 'Every Use Case' : 'Tous les cas d\'utilisation'}
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t.features.subtitle}
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="group relative"
                variants={fadeInUp}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.8, 
                  delay: feature.delay,
                  ease: "easeOut"
                }}
                viewport={{ once: true }}
                whileHover={{ 
                  y: -20,
                  scale: 1.05,
                  transition: { duration: 0.3 }
                }}
              >
                {/* Card - Simplified animations for performance */}
                <motion.div
                  className="relative p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 group-hover:shadow-3xl transition-all duration-500"
                  whileHover={{
                    y: -5,
                    scale: 1.02
                  }}
                >
                  {/* Static Glow Effect - Only on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-10 rounded-3xl blur-xl transition-opacity duration-500`} />
                  
                  {/* Icon Container */}
                  <motion.div
                    className={`relative w-20 h-20 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-500 shadow-lg`}
                    whileHover={{
                      scale: 1.1
                    }}
                  >
                    <feature.icon className="w-10 h-10 text-white" />
                    
                    {/* Icon Glow */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} rounded-2xl opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-500`} />
                  </motion.div>

                  {/* Content */}
                  <motion.h3 
                    className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-pink-600 transition-colors duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    {feature.title}
                  </motion.h3>
                  <motion.p 
                    className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300"
                    whileHover={{ scale: 1.02 }}
                  >
                    {feature.description}
                  </motion.p>

                  {/* Decorative Elements - Static for performance */}
                  <div className="absolute top-4 right-4 w-2 h-2 bg-pink-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute bottom-4 left-4 w-1 h-1 bg-rose-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-gradient-to-br from-pink-50 to-rose-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {t.pricing.title}
              <span className="block bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                {language === 'en' ? 'Perfect Plan' : 'Plan Parfait'}
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t.pricing.subtitle}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan], index) => (
              <motion.div
                key={key}
                className={`relative p-8 bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 ${
                  plan.popular ? 'ring-2 ring-pink-500 scale-105' : ''
                }`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-pink-600 to-rose-600 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center">
                      <Star className="w-4 h-4 mr-1" />
                      {t.pricing.mostPopular}
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {t.subscriptionPlans[key as keyof typeof t.subscriptionPlans]?.name || plan.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {t.subscriptionPlans[key as keyof typeof t.subscriptionPlans]?.description || plan.description}
                  </p>
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    ${plan.price}
                    <span className="text-lg text-gray-500 font-normal">{t.pricing.perMonth}</span>
                  </div>
                  {plan.trialDays && (
                    <div className="text-sm text-pink-600 font-medium">
                      {plan.trialDays}{t.pricing.dayTrial}
                    </div>
                  )}
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.maxMaps} {plan.maxMaps === 1 ? t.pricing.map : t.pricing.maps}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.maxMarkersPerMap.toLocaleString()} {t.pricing.markersPerMap}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.bulkImport ? t.pricing.bulkImport : t.pricing.manualEntry}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.geocoding ? t.pricing.autoGeocoding : t.pricing.manualCoordinates}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.smartGrouping ? t.pricing.smartGrouping : t.pricing.basicGrouping}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.tags ? t.pricing.tags : t.pricing.noTags}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.watermark ? t.pricing.withWatermark : t.pricing.noWatermark}</span>
                  </div>
                </div>

                <motion.button
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setAuthModalMode('signup')
                    setIsAuthModalOpen(true)
                  }}
                >
                  {plan.price === 0 ? t.pricing.getStartedFree : t.pricing.startTrial}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <motion.section 
        className="py-24 bg-gradient-to-r from-pink-600 to-rose-600"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 
            className="text-4xl md:text-5xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            {t.cta.title}
          </motion.h2>
          <motion.p 
            className="text-xl text-pink-100 mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            {t.cta.description}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <motion.button
              className="px-12 py-4 bg-white text-pink-600 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center mx-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setAuthModalMode('signup')
                setIsAuthModalOpen(true)
              }}
            >
              {t.cta.button}
              <ArrowRight className="ml-2 w-6 h-6" />
            </motion.button>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer id="footer" className="py-12 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <img
              src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
              alt="PINZ Logo"
              className="h-8 mx-auto mb-4 filter brightness-0 invert"
              loading="lazy"
            />
            <p className="text-gray-400 mb-8">{t.footer.tagline}</p>
            <div className="flex justify-center space-x-6 text-sm text-gray-400 mb-8">
              <a href="/privacy" className="hover:text-white transition-colors">{t.footer.privacyPolicy}</a>
              <a href="/terms" className="hover:text-white transition-colors">{t.footer.termsOfService}</a>
              <a href="mailto:support@mapies.com" className="hover:text-white transition-colors">{t.footer.contact}</a>
            </div>
            <div className="flex items-center justify-center space-x-1 text-sm text-gray-400">
              <span>{t.footer.madeWith}</span>
              <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
              <span>{t.footer.inMontreal}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />
    </div>
    </>
  )
}

export default LandingPage
