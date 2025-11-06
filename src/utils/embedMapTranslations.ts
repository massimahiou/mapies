export type EmbedMapLanguage = 'en' | 'fr'

export interface EmbedMapTranslations {
  search: {
    placeholder: string
    placeholderWithCount: string
    noResults: string
    tryAdjusting: string
    clear: string
    noStoresAdded: string
    addStoresUsingSidebar: string
  }
  location: {
    findMyLocation: string
    currentLocation: string
    placesNearYou: string
    placesWithin: string
    kmAway: string
    sortedByDistance: string
    noNearbyStores: string
    noStoresWithinRadius: string
  }
  watermark: {
    poweredBy: string
    clickToCreate: string
    clickToUpgrade: string
  }
  errors: {
    mapNotFound: string
    mapUnavailable: string
    mapUpdating: string
    checkBackLater: string
    contactOwner: string
    locationUnavailable: string
    allowLocationAccess: string
    locationInfoUnavailable: string
    locationTimeout: string
    geolocationNotSupported: string
    toFindLocation: string
    continue: string
  }
  watermarkPopup: {
    titlePublic: string
    titleDashboard: string
    descriptionPublic: string
    descriptionDashboard: string
    whatYouGet: string
    noWatermark: string
    moreMarkers: string
    advancedFeatures: string
    professionalCustomization: string
    getStarted: string
    viewPlans: string
    maybeLater: string
    startingFrom: string
    cancelAnytime: string
  }
}

export const embedMapTranslations: Record<EmbedMapLanguage, EmbedMapTranslations> = {
  en: {
    search: {
      placeholder: 'Search locations...',
      placeholderWithCount: 'Search {count} locations...',
      noResults: 'No locations found',
      tryAdjusting: 'Try adjusting your search terms',
      clear: 'Clear search',
      noStoresAdded: 'No stores added yet',
      addStoresUsingSidebar: 'Add stores using the sidebar'
    },
    location: {
      findMyLocation: 'Find my location',
      currentLocation: 'Your current location',
      placesNearYou: 'Places Near You',
      placesWithin: 'places within 5km',
      kmAway: 'km away',
      sortedByDistance: 'Sorted by distance',
      noNearbyStores: 'No nearby stores',
      noStoresWithinRadius: 'No stores within 5km radius'
    },
    watermark: {
      poweredBy: 'Powered by Pinz',
      clickToCreate: 'Click to create your own map',
      clickToUpgrade: 'Click to upgrade and remove watermark'
    },
    errors: {
      mapNotFound: 'Map Not Found',
      mapUnavailable: 'Map Temporarily Unavailable',
      mapUpdating: 'This map is currently being updated and will be available shortly.',
      checkBackLater: 'Please check back later or contact the map owner for more information.',
      contactOwner: 'Please check back later or contact the map owner for more information.',
      locationUnavailable: 'Unable to get your location.',
      allowLocationAccess: 'Please allow location access and try again.',
      locationInfoUnavailable: 'Location information is unavailable.',
      locationTimeout: 'Location request timed out.',
      geolocationNotSupported: 'Geolocation is not supported by this browser.',
      toFindLocation: 'To find your location, you may need to allow location access in your browser. Continue?',
      continue: 'Continue'
    },
    watermarkPopup: {
      titlePublic: "This won't be here with a plan!",
      titleDashboard: 'Remove Watermark',
      descriptionPublic: 'Create your own maps without watermarks! Get started with our Starter plan and build professional maps that represent your brand.',
      descriptionDashboard: 'Upgrade to any paid plan to remove the "Powered by Pinz" watermark and give your maps a professional look.',
      whatYouGet: "What you'll get:",
      noWatermark: 'No watermark on your maps',
      moreMarkers: 'More markers and maps',
      advancedFeatures: 'Advanced features like geocoding',
      professionalCustomization: 'Professional customization',
      getStarted: 'Get Started - View Plans',
      viewPlans: 'View Plans & Upgrade',
      maybeLater: 'Maybe Later',
      startingFrom: 'Starting from $14/month',
      cancelAnytime: 'Cancel anytime'
    }
  },
  fr: {
    search: {
      placeholder: 'Rechercher des emplacements...',
      placeholderWithCount: 'Rechercher {count} emplacements...',
      noResults: 'Aucun emplacement trouvé',
      tryAdjusting: 'Essayez d\'ajuster vos termes de recherche',
      clear: 'Effacer la recherche',
      noStoresAdded: 'Aucun commerce ajouté pour le moment',
      addStoresUsingSidebar: 'Ajoutez des commerces en utilisant la barre latérale'
    },
    location: {
      findMyLocation: 'Trouver ma position',
      currentLocation: 'Votre position actuelle',
      placesNearYou: 'Lieux près de vous',
      placesWithin: 'lieux dans un rayon de 5km',
      kmAway: 'km de distance',
      sortedByDistance: 'Triés par distance',
      noNearbyStores: 'Aucun commerce à proximité',
      noStoresWithinRadius: 'Aucun commerce dans un rayon de 5km'
    },
    watermark: {
      poweredBy: 'Propulsé par Pinz',
      clickToCreate: 'Cliquez pour créer votre propre carte',
      clickToUpgrade: 'Cliquez pour mettre à niveau et supprimer le filigrane'
    },
    errors: {
      mapNotFound: 'Carte introuvable',
      mapUnavailable: 'Carte temporairement indisponible',
      mapUpdating: 'Cette carte est actuellement en cours de mise à jour et sera disponible sous peu.',
      checkBackLater: 'Veuillez réessayer plus tard ou contacter le propriétaire de la carte pour plus d\'informations.',
      contactOwner: 'Veuillez réessayer plus tard ou contacter le propriétaire de la carte pour plus d\'informations.',
      locationUnavailable: 'Impossible d\'obtenir votre position.',
      allowLocationAccess: 'Veuillez autoriser l\'accès à la localisation et réessayer.',
      locationInfoUnavailable: 'Les informations de localisation ne sont pas disponibles.',
      locationTimeout: 'La demande de localisation a expiré.',
      geolocationNotSupported: 'La géolocalisation n\'est pas prise en charge par ce navigateur.',
      toFindLocation: 'Pour trouver votre position, vous devrez peut-être autoriser l\'accès à la localisation dans votre navigateur. Continuer?',
      continue: 'Continuer'
    },
    watermarkPopup: {
      titlePublic: 'Ceci ne sera pas là avec un plan!',
      titleDashboard: 'Supprimer le filigrane',
      descriptionPublic: 'Créez vos propres cartes sans filigranes! Commencez avec notre plan Starter et créez des cartes professionnelles qui représentent votre marque.',
      descriptionDashboard: 'Passez à n\'importe quel plan payant pour supprimer le filigrane "Propulsé par Pinz" et donner à vos cartes un aspect professionnel.',
      whatYouGet: 'Ce que vous obtiendrez:',
      noWatermark: 'Aucun filigrane sur vos cartes',
      moreMarkers: 'Plus de marqueurs et de cartes',
      advancedFeatures: 'Fonctionnalités avancées comme la géocodification',
      professionalCustomization: 'Personnalisation professionnelle',
      getStarted: 'Commencer - Voir les plans',
      viewPlans: 'Voir les plans et mettre à niveau',
      maybeLater: 'Peut-être plus tard',
      startingFrom: 'À partir de 14 $/mois',
      cancelAnytime: 'Annuler à tout moment'
    }
  }
}

