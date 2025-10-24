/**
 * Mapies Responsive Iframe Script
 * 
 * Include this script on your website to automatically make Mapies iframes responsive.
 * This script listens for messages from Mapies embeds and applies responsive styling.
 * 
 * Usage:
 * <script src="https://mapies.web.app/mapies-responsive.js"></script>
 * 
 * Or copy this code directly into your website.
 */

(function() {
  'use strict';

  // Listen for messages from Mapies embeds
  window.addEventListener('message', function(event) {
    // Verify the message is from a Mapies embed
    if (event.data && 
        event.data.type === 'MAPIES_REQUEST_RESPONSIVE_IFRAME' && 
        event.data.source === 'mapies-embed') {
      
      console.log('🎯 Mapies embed requesting responsive iframe styling');
      
      // Find all iframes that might contain Mapies embeds
      const iframes = document.querySelectorAll('iframe[src*="mapies.web.app"]');
      
      iframes.forEach(iframe => {
        // Apply responsive styling
        iframe.style.width = '100%';
        iframe.style.maxWidth = '100%';
        iframe.style.height = 'auto';
        iframe.style.aspectRatio = '16 / 9';
        iframe.style.display = 'block';
        
        // Fix parent container overflow
        if (iframe.parentElement) {
          iframe.parentElement.style.overflow = 'hidden';
        }
        
        console.log('✅ Applied responsive styling to Mapies iframe');
      });
    }
  });

  // Also apply responsive styling on page load for existing iframes
  document.addEventListener('DOMContentLoaded', function() {
    const mapiesIframes = document.querySelectorAll('iframe[src*="mapies.web.app"]');
    
    mapiesIframes.forEach(iframe => {
      iframe.style.width = '100%';
      iframe.style.maxWidth = '100%';
      iframe.style.height = 'auto';
      iframe.style.aspectRatio = '16 / 9';
      iframe.style.display = 'block';
      
      if (iframe.parentElement) {
        iframe.parentElement.style.overflow = 'hidden';
      }
    });
    
    if (mapiesIframes.length > 0) {
      console.log(`🎯 Applied responsive styling to ${mapiesIframes.length} Mapies iframe(s) on page load`);
    }
  });

  console.log('📱 Mapies responsive iframe script loaded');
})();








