import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  MapPin, 
  Upload, 
  Zap, 
  Globe, 
  Users, 
  CheckCircle, 
  Star,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans'
import AuthModal from './AuthModal'
import PublicMap from './PublicMap'

const LandingPage: React.FC = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')
  const [currentUserType, setCurrentUserType] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [mapSettings, setMapSettings] = useState({
    style: 'dark',
    markerShape: 'pin',
    markerColor: '#ff3670',
    markerSize: 'medium',
    clusteringEnabled: false
  })

  const userTypes = [
    'businesses',
    'entrepreneurs', 
    'musicians',
    'artists',
    'distributors',
    'retailers',
    'restaurants',
    'hotels',
    'events',
    'nonprofits'
  ]

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
    { id: 'hero', label: 'Home', name: 'Home' },
    { id: 'demo', label: 'Demo', name: 'Demo' },
    { id: 'features', label: 'Features', name: 'Features' },
    { id: 'pricing', label: 'Pricing', name: 'Pricing' },
    { id: 'footer', label: 'Contact', name: 'Contact' }
  ]

  // Scroll detection for active section
  useEffect(() => {
    const handleScroll = () => {
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

    window.addEventListener('scroll', handleScroll)
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

  const features = [
    {
      icon: MapPin,
      title: "Interactive Maps",
      description: "Create beautiful, interactive maps with custom markers and locations",
      color: "from-pink-500 to-rose-500",
      delay: 0
    },
    {
      icon: Upload,
      title: "Bulk Import",
      description: "Import thousands of locations from CSV files with automatic geocoding",
      color: "from-rose-500 to-pink-600",
      delay: 0.1
    },
    {
      icon: Zap,
      title: "Smart Grouping",
      description: "Automatically group and categorize your markers with AI-powered insights",
      color: "from-pink-600 to-rose-600",
      delay: 0.2
    },
    {
      icon: Star,
      title: "Custom Branding",
      description: "Remove watermarks and customize your maps with your brand colors",
      color: "from-rose-600 to-pink-500",
      delay: 0.3
    },
    {
      icon: Globe,
      title: "Public Sharing",
      description: "Share your maps publicly or embed them in your website",
      color: "from-pink-500 to-rose-500",
      delay: 0.4
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Invite team members to collaborate on maps with different permission levels",
      color: "from-rose-500 to-pink-600",
      delay: 0.5
    }
  ]

  const stats = [
    { number: "10K+", label: "Maps Created" },
    { number: "1M+", label: "Markers Placed" },
    { number: "500+", label: "Happy Customers" },
    { number: "99.9%", label: "Uptime" }
  ]

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes blink-caret {
            from, to { border-color: transparent }
            50% { border-color: #ec4899 }
          }
        `
      }} />
      {/* Mobile Top Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-pink-100 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <img
            src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
            alt="Pinz Logo"
            className="h-8"
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
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-pink-200 rounded-full opacity-20"
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360]
            }}
            transition={{ 
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-200 rounded-full opacity-20"
            animate={{ 
              scale: [1.2, 1, 1.2],
              rotate: [360, 180, 0]
            }}
            transition={{ 
              duration: 25,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-100 to-rose-100 text-pink-800 rounded-full text-sm font-semibold mb-8 shadow-lg border border-pink-200">
              <motion.div
                className="mr-2"
                animate={{ 
                  y: [0, -8, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <MapPin className="w-5 h-5 text-pink-600" />
              </motion.div>
              The Future of Map Creation
              <motion.div
                className="ml-2 w-2 h-2 bg-pink-500 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
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
              alt="Pinz Logo"
              className="h-24 md:h-32 mx-auto"
            />
          </motion.div>

          <motion.h1 
            className="text-3xl md:text-5xl font-bold text-gray-900 mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Interactive maps for
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
              onClick={() => setIsAuthModalOpen(true)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              {/* Subtle shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              
              <span className="relative z-10 flex items-center">
                Create Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </motion.button>

            {/* Secondary CTA - Sign In */}
            <motion.button
              className="px-8 py-4 bg-white text-gray-700 rounded-xl font-medium text-lg border-2 border-gray-200 hover:border-pink-300 hover:text-pink-600 transition-all duration-300 flex items-center justify-center order-2"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAuthModalOpen(true)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
            >
              Sign In
            </motion.button>
          </motion.div>

          <motion.p 
            className="text-sm text-gray-500 mt-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            Free to get started • No credit card required
          </motion.p>
        </div>

        {/* Floating Elements - Redistributed for better balance */}
        
        {/* Top left corner - subtle */}
        <motion.div
          className="absolute top-20 left-8 w-12 h-12 bg-pink-200 rounded-lg opacity-40"
          animate={{ 
            y: [0, -15, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Top right corner - subtle */}
        <motion.div
          className="absolute top-16 right-12 w-8 h-8 bg-rose-200 rounded-full opacity-50"
          animate={{ 
            y: [0, 12, 0],
            rotate: [0, -5, 0]
          }}
          transition={{ 
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Left side - medium pin */}
        <motion.div
          className="absolute top-1/2 left-8 opacity-30"
          animate={{ 
            y: [0, -20, 0],
            x: [0, 8, 0],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ 
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <MapPin className="w-16 h-20 text-pink-500" />
        </motion.div>

        {/* Right side - small pin */}
        <motion.div
          className="absolute top-2/3 right-8 opacity-25"
          animate={{ 
            y: [0, 15, 0],
            x: [0, -10, 0],
            rotate: [0, -8, 8, 0]
          }}
          transition={{ 
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <MapPin className="w-10 h-12 text-rose-500" />
        </motion.div>

        {/* Bottom left - geometric shape */}
        <motion.div
          className="absolute bottom-20 left-1/4 w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full opacity-50 shadow-lg"
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, 180, 360],
            opacity: [0.5, 0.2, 0.5]
          }}
          transition={{ 
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        
        {/* Bottom right - geometric shape */}
        <motion.div
          className="absolute bottom-16 right-1/4 w-14 h-14 bg-gradient-to-br from-rose-300 to-pink-400 rounded-xl opacity-40 shadow-md"
          animate={{ 
            y: [0, -20, 0],
            x: [0, 12, 0],
            rotate: [0, 12, 0]
          }}
          transition={{ 
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
        
        {/* Center bottom - small dot */}
        <motion.div
          className="absolute bottom-24 left-1/2 w-4 h-4 bg-pink-500 rounded-full opacity-60"
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.6, 0.1, 0.6]
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5
          }}
        />

        {/* Far right - large pin */}
        <motion.div
          className="absolute top-1/3 right-4 opacity-20"
          animate={{ 
            y: [0, -25, 0],
            x: [0, 15, 0],
            rotate: [0, 15, -15, 0]
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3
          }}
        >
          <MapPin className="w-12 h-16 text-pink-600" />
        </motion.div>
      </motion.section>

      {/* Stats Section */}
      <motion.section 
        className="py-20 bg-gradient-to-r from-pink-600 to-rose-600"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                className="text-center text-white"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="text-4xl md:text-5xl font-bold mb-2">{stat.number}</div>
                <div className="text-pink-100">{stat.label}</div>
              </motion.div>
            ))}
          </div>
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
              See Pinz in Action
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Here's an example to show our speed of light maps
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm">
                <MapPin className="w-4 h-5 text-pink-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">1000+ Markers</span>
              </div>
              <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm">
                <Globe className="w-4 h-5 text-pink-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">3 Countries</span>
              </div>
              <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm">
                <Zap className="w-4 h-5 text-pink-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">Lightning Fast</span>
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
            <div className="h-[500px] md:h-[500px] lg:h-[600px] relative">
              {/* Demo Map Component */}
              <div className="w-full h-full">
                <PublicMap 
                  mapId="demo-map-1000-markers" 
                  customSettings={mapSettings}
                />
              </div>
            </div>
          </motion.div>

          {/* Subtle Map Controls - Always Visible */}
          <motion.div
            className="mt-6 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-4 max-w-3xl w-full">
              {/* Header with disclaimer */}
              <div className="text-center mb-4">
                <p className="text-xs text-gray-500 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-pink-50 text-pink-600 text-xs font-medium">
                    Demo Controls
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  Try these basic customization options - Pinz offers many more advanced features
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Map Style */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Style</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setMapSettings({...mapSettings, style: 'light'})}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        mapSettings.style === 'light' 
                          ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setMapSettings({...mapSettings, style: 'dark'})}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        mapSettings.style === 'dark' 
                          ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      Dark
                    </button>
                  </div>
                </div>

                {/* Marker Shape */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Shape</label>
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
                  <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
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
                  <label className="block text-xs font-medium text-gray-600 mb-2">Clustering</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setMapSettings({...mapSettings, clusteringEnabled: true})}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        mapSettings.clusteringEnabled 
                          ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      On
                    </button>
                    <button
                      onClick={() => setMapSettings({...mapSettings, clusteringEnabled: false})}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        !mapSettings.clusteringEnabled 
                          ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      Off
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Interactive Markers</h3>
              <p className="text-gray-600">Click any marker to see detailed information about businesses, restaurants, and attractions.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Lightning Performance</h3>
              <p className="text-gray-600">Smooth rendering and interactions even with 1000+ markers thanks to our optimized engine.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Global Scale</h3>
              <p className="text-gray-600">From local Quebec businesses to major US cities - Pinz scales beautifully across any region.</p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-br from-pink-50 via-white to-rose-50 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Circles */}
          <motion.div
            className="absolute top-20 left-10 w-32 h-32 bg-pink-200 rounded-full opacity-20"
            animate={{ 
              y: [0, -30, 0],
              x: [0, 20, 0],
              rotate: [0, 180, 360]
            }}
            transition={{ 
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute top-40 right-20 w-24 h-24 bg-rose-200 rounded-full opacity-30"
            animate={{ 
              y: [0, 40, 0],
              x: [0, -30, 0],
              rotate: [0, -180, -360]
            }}
            transition={{ 
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-20 left-1/4 w-20 h-20 bg-pink-300 rounded-full opacity-25"
            animate={{ 
              y: [0, -20, 0],
              x: [0, 15, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Pin Shapes */}
          <motion.div
            className="absolute top-32 right-1/3 opacity-15"
            animate={{ 
              y: [0, -25, 0],
              x: [0, 15, 0],
              rotate: [0, 10, -10, 0]
            }}
            transition={{ 
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <MapPin className="w-24 h-30 text-pink-500" />
          </motion.div>

          <motion.div
            className="absolute top-60 left-1/3 opacity-20"
            animate={{ 
              y: [0, 30, 0],
              x: [0, -20, 0],
              rotate: [0, -15, 15, 0]
            }}
            transition={{ 
              duration: 9,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <MapPin className="w-8 h-10 text-rose-500" />
          </motion.div>

          <motion.div
            className="absolute bottom-32 right-1/4 opacity-18"
            animate={{ 
              y: [0, -35, 0],
              x: [0, 25, 0],
              rotate: [0, 20, -20, 0]
            }}
            transition={{ 
              duration: 11,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <MapPin className="w-16 h-20 text-pink-600" />
          </motion.div>

          <motion.div
            className="absolute top-80 left-1/5 opacity-22"
            animate={{ 
              y: [0, 25, 0],
              x: [0, -15, 0],
              rotate: [0, -25, 25, 0]
            }}
            transition={{ 
              duration: 8.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <MapPin className="w-12 h-15 text-rose-400" />
          </motion.div>

          {/* Squares */}
          <motion.div
            className="absolute top-16 right-1/5 w-16 h-16 bg-pink-200 opacity-15 rounded-lg"
            animate={{ 
              y: [0, -20, 0],
              x: [0, 10, 0],
              rotate: [0, 45, 0]
            }}
            transition={{ 
              duration: 6.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-40 right-1/6 w-12 h-12 bg-rose-200 opacity-20 rounded-lg"
            animate={{ 
              y: [0, 30, 0],
              x: [0, -15, 0],
              rotate: [0, -30, 30, 0]
            }}
            transition={{ 
              duration: 7.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
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
              Amazing Features
            </motion.div>
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Powerful Features for
              <span className="block bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                Every Use Case
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to create, customize, and share beautiful interactive maps
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
                {/* Floating Card */}
                <motion.div
                  className="relative p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 group-hover:shadow-3xl transition-all duration-500"
                  animate={{
                    y: [0, -10, 0],
                    rotateY: [0, 2, 0],
                    rotateX: [0, 1, 0]
                  }}
                  transition={{
                    duration: 4 + index * 0.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  whileHover={{
                    rotateY: 5,
                    rotateX: 5,
                    scale: 1.02
                  }}
                >
                  {/* Glow Effect */}
                  <motion.div
                    className={`absolute inset-0 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-10 rounded-3xl blur-xl transition-opacity duration-500`}
                    animate={{
                      opacity: [0, 0.1, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  
                  {/* Icon Container */}
                  <motion.div
                    className={`relative w-20 h-20 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-500 shadow-lg`}
                    whileHover={{
                      rotate: [0, -5, 5, 0],
                      scale: 1.1
                    }}
                    transition={{ duration: 0.6 }}
                  >
                    <motion.div
                      animate={{
                        rotate: [0, 360],
                      }}
                      transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    >
                      <feature.icon className="w-10 h-10 text-white" />
                    </motion.div>
                    
                    {/* Icon Glow */}
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-r ${feature.color} rounded-2xl opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-500`}
                    />
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

                  {/* Decorative Elements */}
                  <motion.div
                    className="absolute top-4 right-4 w-2 h-2 bg-pink-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0, 0.6, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <motion.div
                    className="absolute bottom-4 left-4 w-1 h-1 bg-rose-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0, 0.4, 0]
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5
                    }}
                  />
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
              Choose Your
              <span className="block bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                Perfect Plan
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Start free and upgrade as you grow. All plans include our core features.
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
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    ${plan.price}
                    <span className="text-lg text-gray-500 font-normal">/month</span>
                  </div>
                  {plan.trialDays && (
                    <div className="text-sm text-pink-600 font-medium">
                      {plan.trialDays}-day free trial
                    </div>
                  )}
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.maxMaps} {plan.maxMaps === 1 ? 'Map' : 'Maps'}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.maxMarkersPerMap.toLocaleString()} Markers per Map</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.bulkImport ? 'Bulk Import' : 'Manual Entry Only'}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.geocoding ? 'Auto Geocoding' : 'Manual Coordinates'}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.smartGrouping ? 'Smart Grouping' : 'Basic Grouping'}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{plan.watermark ? 'With Watermark' : 'No Watermark'}</span>
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
                  onClick={() => setIsAuthModalOpen(true)}
                >
                  {plan.price === 0 ? 'Get Started Free' : 'Start Free Trial'}
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
            Ready to Create Your First Map?
          </motion.h2>
          <motion.p 
            className="text-xl text-pink-100 mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Join thousands of users who are already creating amazing maps with Pinz
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
              onClick={() => setIsAuthModalOpen(true)}
            >
              Start Creating Maps
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
              alt="Pinz Logo"
              className="h-8 mx-auto mb-4 filter brightness-0 invert"
            />
            <p className="text-gray-400 mb-8">Create beautiful, interactive maps in minutes</p>
            <div className="flex justify-center space-x-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  )
}

export default LandingPage
