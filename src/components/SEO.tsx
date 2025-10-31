import React from 'react'
import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { Language } from '../utils/landingPageTranslations'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  language?: Language
  noindex?: boolean
  canonical?: string
}

const SEO: React.FC<SEOProps> = ({
  title = 'PINZ - Interactive Maps Platform',
  description,
  image = 'https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5',
  language = 'en',
  noindex = false,
  canonical
}) => {
  const location = useLocation()
  const baseUrl = 'https://pinzapp.com'
  const fullUrl = `${baseUrl}${location.pathname}${location.search}`
  const canonicalUrl = canonical || fullUrl
  
  // Default description based on language
  const defaultDescription = language === 'fr' 
    ? 'Le moyen le plus simple de créer une carte interactive pour votre entreprise, vos magasins ou vos marqueurs. Créez, personnalisez et partagez vos cartes en quelques minutes.'
    : 'The easiest way to create interactive maps for your business, stores, or markers. Create, customize, and share your maps in minutes.'
  
  const metaDescription = description || defaultDescription
  
  // SEO title (should be under 60 characters)
  const seoTitle = title.length > 60 ? title.substring(0, 57) + '...' : title
  
  // Build hreflang links
  const currentPath = location.pathname
  const queryParams = location.search || ''
  const langParam = queryParams.includes('lang=') ? '' : (queryParams ? '&' : '?') + 'lang='
  
  // Structured Data - Organization
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PINZ',
    url: baseUrl,
    logo: image,
    email: 'info@pinzapp.com',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'info@pinzapp.com',
      contactType: 'Customer Service'
    }
  }
  
  // Structured Data - SoftwareApplication
  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PINZ',
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '100'
    }
  }
  
  // Structured Data - WebSite
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'PINZ',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  }
  
  // Breadcrumb Schema (only for non-home pages)
  const breadcrumbSchema = currentPath !== '/' ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: language === 'fr' ? 'Accueil' : 'Home',
        item: baseUrl
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: seoTitle,
        item: fullUrl
      }
    ]
  } : null

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <html lang={language} />
      <title>{seoTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="PINZ" />
      <meta property="og:locale" content={language === 'fr' ? 'fr_CA' : 'en_US'} />
      <meta property="og:locale:alternate" content={language === 'fr' ? 'en_US' : 'fr_CA'} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image} />
      
      {/* Hreflang Tags for Multilingual */}
      <link rel="alternate" hrefLang="en" href={`${baseUrl}${currentPath}${queryParams}${langParam}en`} />
      <link rel="alternate" hrefLang="fr" href={`${baseUrl}${currentPath}${queryParams}${langParam}fr`} />
      <link rel="alternate" hrefLang="x-default" href={`${baseUrl}${currentPath}`} />
      
      {/* Structured Data - JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(softwareApplicationSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
      
      {/* Additional Meta Tags */}
      <meta name="author" content="PINZ" />
      <meta name="theme-color" content="#ec4899" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="PINZ" />
    </Helmet>
  )
}

export default SEO

