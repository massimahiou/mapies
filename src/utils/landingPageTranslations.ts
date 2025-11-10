export type Language = 'en' | 'fr'

export interface LandingPageTranslations {
  // Navigation
  nav: {
    home: string
    demo: string
    features: string
    pricing: string
    contact: string
  }
  
  // Hero Section
  hero: {
    badge: string
    title: string
    titlePlaceholder: string
    createAccount: string
    signIn: string
    freeText: string
  }
  
  // Typewriter words (for RollingWord component)
  typewriter: {
    businesses: string
    markers: string
    identity: string
    retailers: string
    stores: string
    yourself: string
  }
  
  // User types for typewriter
  userTypes: string[]
  
  // Tagline Section
  tagline: {
    main: string
    connector?: string
    madeWith: string
    inMontreal: string
  }
  
  // Demo Section
  demo: {
    title: string
    description: string
    markersCount: string
    countries: string
    fast: string
    readyToExplore: string
    exploreDescription: string
    loadMap: string
    demoControls: string
    controlsDescription: string
    style: string
    light: string
    dark: string
    shape: string
    color: string
    clustering: string
    on: string
    off: string
    interactiveMarkers: string
    interactiveMarkersDesc: string
    lightningPerformance: string
    lightningPerformanceDesc: string
    globalScale: string
    globalScaleDesc: string
  }
  
  // Features Section
  features: {
    badge: string
    title: string
    subtitle: string
    everyUseCase?: string
    items: Array<{
      title: string
      description: string
    }>
  }
  
  // Pricing Section
  pricing: {
    title: string
    subtitle: string
    mostPopular: string
    perMonth: string
    dayTrial: string
    map: string
    maps: string
    markersPerMap: string
    bulkImport: string
    manualEntry: string
    autoGeocoding: string
    manualCoordinates: string
      smartGrouping: string
      basicGrouping: string
      tags: string
      noTags: string
      withWatermark: string
      noWatermark: string
      getStartedFree: string
      startTrial: string
  }
  
  // CTA Section
  cta: {
    title: string
    description: string
    button: string
  }
  
  // Footer
  footer: {
    tagline: string
    privacyPolicy: string
    termsOfService: string
    contact: string
    madeWith: string
    inMontreal: string
  }
  
  // Toast
  toast: {
    emailVerified: string
    emailVerifiedMessage: string
  }
  
  // Subscription Plans (for landing page only)
  subscriptionPlans: {
    freemium: {
      name: string
      description: string
    }
    starter: {
      name: string
      description: string
    }
    professional: {
      name: string
      description: string
    }
    enterprise: {
      name: string
      description: string
    }
  }
}

export const translations: Record<Language, LandingPageTranslations> = {
  en: {
    nav: {
      home: 'Home',
      demo: 'Demo',
      features: 'Features',
      pricing: 'Pricing',
      contact: 'Contact'
    },
    hero: {
      badge: 'The Future of Map Creation',
      title: 'Interactive maps for',
      titlePlaceholder: '',
      createAccount: 'Create Account',
      signIn: 'Sign In',
      freeText: 'Free to get started • No credit card required'
    },
    typewriter: {
      businesses: 'businesses',
      markers: 'markers',
      identity: 'identity',
      retailers: 'retailers',
      stores: 'stores',
      yourself: 'yourself'
    },
    userTypes: [
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
    ],
    tagline: {
      main: 'The easiest way to put',
      connector: 'on a map',
      madeWith: 'Made with',
      inMontreal: 'in Montreal'
    },
    demo: {
      title: 'See Pinz in Action',
      description: 'Try out our fast, responsive and easily embeddable maps for yourself.',
      markersCount: '1000+ Markers',
      countries: '3 Countries',
      fast: 'Lightning Fast',
      readyToExplore: 'Ready to Explore?',
      exploreDescription: 'Click below to load an interactive demo map with 1000+ markers from 3 countries',
      loadMap: 'Load Interactive Map',
      demoControls: 'Demo Controls',
      controlsDescription: 'Try these basic customization options - Pinz offers many more advanced features',
      style: 'Style',
      light: 'Light',
      dark: 'Dark',
      shape: 'Shape',
      color: 'Color',
      clustering: 'Clustering',
      on: 'On',
      off: 'Off',
      interactiveMarkers: 'Interactive Markers',
      interactiveMarkersDesc: 'Click any marker to see detailed information about businesses, restaurants, and attractions.',
      lightningPerformance: 'Lightning Performance',
      lightningPerformanceDesc: 'Smooth rendering and interactions even with 1000+ markers thanks to our optimized engine.',
      globalScale: 'Global Scale',
      globalScaleDesc: 'From local Quebec businesses to major US cities - Pinz scales beautifully across any region.'
    },
    features: {
      badge: 'Amazing Features',
      title: 'Powerful Features for',
      subtitle: 'Everything you need to create, customize, and share beautiful interactive maps',
      everyUseCase: 'Every Use Case',
      items: [
        {
          title: 'Interactive Maps',
          description: 'Create beautiful, interactive maps with custom markers and locations'
        },
        {
          title: 'Bulk Import',
          description: 'Import thousands of locations from CSV files with automatic geocoding'
        },
        {
          title: 'Smart Grouping',
          description: 'Automatically group and categorize your markers with AI-powered insights'
        },
        {
          title: 'Tags & Filtering',
          description: 'Organize and filter your markers with custom tags for better navigation and discovery'
        },
        {
          title: 'Custom Branding',
          description: 'Remove watermarks and customize your maps with your brand colors'
        },
        {
          title: 'Public Sharing',
          description: 'Share your maps publicly or embed them in your website'
        }
      ]
    },
    pricing: {
      title: 'Choose Your',
      subtitle: 'Start free and upgrade as you grow. All plans include our core features.',
      mostPopular: 'Most Popular',
      perMonth: '/month',
      dayTrial: '-day free trial',
      map: 'Map',
      maps: 'Maps',
      markersPerMap: 'Markers per Map',
      bulkImport: 'Bulk Import',
      manualEntry: 'Manual Entry Only',
      autoGeocoding: 'Auto Geocoding',
      manualCoordinates: 'Manual Coordinates',
      smartGrouping: 'Smart Grouping',
      basicGrouping: 'Basic Grouping',
      tags: 'Tags & Filtering',
      noTags: 'No Tags',
      withWatermark: 'With Watermark',
      noWatermark: 'No Watermark',
      getStartedFree: 'Get Started Free',
      startTrial: 'Start Free Trial'
    },
    cta: {
      title: 'Ready to Create Your First Map?',
      description: 'Join thousands of users who are already creating amazing maps with Pinz',
      button: 'Start Creating Maps'
    },
    footer: {
      tagline: 'Create beautiful, interactive maps in minutes',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      contact: 'Contact',
      madeWith: 'Made with',
      inMontreal: 'in Montreal'
    },
    toast: {
      emailVerified: 'Email Verified!',
      emailVerifiedMessage: 'Your email has been verified. Please sign in to access your dashboard.'
    },
    subscriptionPlans: {
      freemium: {
        name: 'Freemium',
        description: 'Perfect for getting started'
      },
      starter: {
        name: 'Starter',
        description: 'Great for small businesses'
      },
      professional: {
        name: 'Professional',
        description: 'Most popular choice'
      },
      enterprise: {
        name: 'Enterprise',
        description: 'For large organizations'
      }
    }
  },
  fr: {
    nav: {
      home: 'Accueil',
      demo: 'Démo',
      features: 'Fonctionnalités',
      pricing: 'Tarifs',
      contact: 'Contact'
    },
    hero: {
      badge: 'L\'avenir de la création de cartes',
      title: 'Cartes interactives pour',
      titlePlaceholder: '',
      createAccount: 'Créer un compte',
      signIn: 'Se connecter',
      freeText: 'Gratuit pour commencer • Aucune carte de crédit requise'
    },
    typewriter: {
      businesses: 'entreprises',
      markers: 'repères',
      identity: 'identité',
      retailers: 'détaillants',
      stores: 'magasins',
      yourself: 'vous-même'
    },
    userTypes: [
      'entreprises',
      'entrepreneurs',
      'musiciens',
      'artistes',
      'distributeurs',
      'détaillants',
      'restaurants',
      'hôtels',
      'événements',
      'organismes sans but lucratif'
    ],
    tagline: {
      main: 'Le moyen le plus simple de créer une carte pour',
      connector: '',
      madeWith: 'Fait avec',
      inMontreal: 'à Montréal'
    },
    demo: {
      title: 'Découvrez Pinz en action',
      description: 'Essayez nos cartes rapides, réactives et facilement intégrables vous-même.',
      markersCount: '1000+ Repères',
      countries: '3 Pays',
      fast: 'Ultra rapide',
      readyToExplore: 'Prêt à explorer?',
      exploreDescription: 'Cliquez ci-dessous pour charger une carte interactive de démonstration avec plus de 1000 repères de 3 pays',
      loadMap: 'Charger la carte interactive',
      demoControls: 'Contrôles de démonstration',
      controlsDescription: 'Essayez ces options de personnalisation de base - Pinz offre bien plus de fonctionnalités avancées',
      style: 'Style',
      light: 'Clair',
      dark: 'Sombre',
      shape: 'Forme',
      color: 'Couleur',
      clustering: 'Regroupement',
      on: 'Activé',
      off: 'Désactivé',
      interactiveMarkers: 'Repères interactifs',
      interactiveMarkersDesc: 'Cliquez sur n\'importe quel repère pour voir des informations détaillées sur les entreprises, restaurants et attractions.',
      lightningPerformance: 'Performance ultrarapide',
      lightningPerformanceDesc: 'Rendu et interactions fluides même avec plus de 1000 repères grâce à notre moteur optimisé.',
      globalScale: 'Portée mondiale',
      globalScaleDesc: 'Des entreprises locales du Québec aux grandes villes américaines - Pinz s\'adapte magnifiquement à n\'importe quelle région.'
    },
    features: {
      badge: 'Fonctionnalités impressionnantes',
      title: 'Fonctionnalités puissantes pour',
      subtitle: 'Tout ce dont vous avez besoin pour créer, personnaliser et partager de magnifiques cartes interactives',
      everyUseCase: 'Tous les cas d\'utilisation',
      items: [
        {
          title: 'Cartes interactives',
          description: 'Créez de magnifiques cartes interactives avec des repères et des emplacements personnalisés'
        },
        {
          title: 'Import en masse',
          description: 'Importez des milliers d\'emplacements à partir de fichiers CSV avec géocodage automatique'
        },
        {
          title: 'Regroupement intelligent',
          description: 'Regroupez et catégorisez automatiquement vos repères avec des informations alimentées par l\'IA'
        },
        {
          title: 'Tags et filtrage',
          description: 'Organisez et filtrez vos repères avec des tags personnalisés pour une meilleure navigation et découverte'
        },
        {
          title: 'Personnalisation de marque',
          description: 'Supprimez les filigranes et personnalisez vos cartes avec les couleurs de votre marque'
        },
        {
          title: 'Partage public',
          description: 'Partagez vos cartes publiquement ou intégrez-les dans votre site web'
        }
      ]
    },
    pricing: {
      title: 'Choisissez votre',
      subtitle: 'Commencez gratuitement et passez à un niveau supérieur au fur et à mesure. Tous les plans incluent nos fonctionnalités principales.',
      mostPopular: 'Le plus populaire',
      perMonth: '/mois',
      dayTrial: ' jours d\'essai gratuit',
      map: 'Carte',
      maps: 'Cartes',
      markersPerMap: 'Repères par carte',
      bulkImport: 'Import en masse',
      manualEntry: 'Saisie manuelle uniquement',
      autoGeocoding: 'Géocodage automatique',
      manualCoordinates: 'Coordonnées manuelles',
      smartGrouping: 'Regroupement intelligent',
      basicGrouping: 'Regroupement de base',
      tags: 'Tags et filtrage',
      noTags: 'Pas de tags',
      withWatermark: 'Avec filigrane',
      noWatermark: 'Sans filigrane',
      getStartedFree: 'Commencer gratuitement',
      startTrial: 'Démarrer l\'essai gratuit'
    },
    cta: {
      title: 'Prêt à créer votre première carte?',
      description: 'Rejoignez des milliers d\'utilisateurs qui créent déjà des cartes incroyables avec Pinz',
      button: 'Commencer à créer des cartes'
    },
    footer: {
      tagline: 'Créez de magnifiques cartes interactives en quelques minutes',
      privacyPolicy: 'Politique de confidentialité',
      termsOfService: 'Conditions d\'utilisation',
      contact: 'Contact',
      madeWith: 'Fait avec',
      inMontreal: 'à Montréal'
    },
    toast: {
      emailVerified: 'Courriel vérifié!',
      emailVerifiedMessage: 'Votre courriel a été vérifié. Veuillez vous connecter pour accéder à votre tableau de bord.'
    },
    subscriptionPlans: {
      freemium: {
        name: 'Freemium',
        description: 'Parfait pour commencer'
      },
      starter: {
        name: 'Starter',
        description: 'Idéal pour les petites entreprises'
      },
      professional: {
        name: 'Professionnel',
        description: 'Choix le plus populaire'
      },
      enterprise: {
        name: 'Entreprise',
        description: 'Pour les grandes organisations'
      }
    }
  }
}

