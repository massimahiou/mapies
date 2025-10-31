/**
 * Temporary script to analyze and compare two maps from Firebase
 * Run with: node analyze-maps.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(readFileSync(join(__dirname, 'config/mapies-firebase-adminsdk-fbsvc-40548c12ec.json'), 'utf8'));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function analyzeMap(userId, mapId, label) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}: Map ${mapId} owned by ${userId}`);
  console.log('='.repeat(80));
  
  try {
    // Get map document
    const mapRef = db.collection('users').doc(userId).collection('maps').doc(mapId);
    const mapDoc = await mapRef.get();
    
    if (!mapDoc.exists) {
      console.log(`❌ Map ${mapId} does not exist`);
      return null;
    }
    
    const mapData = mapDoc.data();
    console.log('\n📋 MAP DOCUMENT STRUCTURE:');
    console.log(JSON.stringify(mapData, null, 2));
    
    // Get markers
    const markersRef = mapRef.collection('markers');
    const markersSnapshot = await markersRef.get();
    
    console.log(`\n📍 MARKERS COUNT: ${markersSnapshot.size}`);
    
    if (markersSnapshot.size > 0) {
      console.log('\n📋 MARKER STRUCTURES (first 3):');
      const markers = [];
      markersSnapshot.docs.slice(0, 3).forEach(doc => {
        const markerData = doc.data();
        markers.push({
          id: doc.id,
          ...markerData
        });
      });
      console.log(JSON.stringify(markers, null, 2));
      
      if (markersSnapshot.size > 3) {
        console.log(`\n... and ${markersSnapshot.size - 3} more markers`);
      }
      
      // Analyze all markers for issues
      console.log('\n🔍 MARKER ANALYSIS:');
      const issues = [];
      let validCount = 0;
      let invalidCount = 0;
      
      markersSnapshot.docs.forEach(doc => {
        const marker = doc.data();
        
        // Check for required fields
        const hasId = doc.id && doc.id.length > 0;
        const hasName = marker.name !== undefined && marker.name !== null;
        const hasAddress = marker.address !== undefined && marker.address !== null;
        const hasLat = typeof marker.lat === 'number' && !isNaN(marker.lat);
        const hasLng = typeof marker.lng === 'number' && !isNaN(marker.lng);
        
        if (!hasId || !hasName || !hasAddress || !hasLat || !hasLng) {
          invalidCount++;
          issues.push({
            id: doc.id,
            missing: {
              id: !hasId,
              name: !hasName,
              address: !hasAddress,
              lat: !hasLat,
              lng: !hasLng
            },
            data: marker
          });
        } else {
          validCount++;
        }
        
        // Check for unexpected data types
        if (marker.lat && typeof marker.lat !== 'number') {
          issues.push({
            id: doc.id,
            issue: `lat is ${typeof marker.lat}, expected number`,
            value: marker.lat
          });
        }
        
        if (marker.lng && typeof marker.lng !== 'number') {
          issues.push({
            id: doc.id,
            issue: `lng is ${typeof marker.lng}, expected number`,
            value: marker.lng
          });
        }
      });
      
      console.log(`Valid markers: ${validCount}`);
      console.log(`Invalid markers: ${invalidCount}`);
      
      if (issues.length > 0) {
        console.log(`\n⚠️  ISSUES FOUND (${issues.length}):`);
        issues.slice(0, 10).forEach(issue => {
          console.log(JSON.stringify(issue, null, 2));
        });
        if (issues.length > 10) {
          console.log(`... and ${issues.length - 10} more issues`);
        }
      }
      
      // Check for Firestore Timestamp issues
      console.log('\n🕐 TIMESTAMP ANALYSIS:');
      let timestampIssues = 0;
      markersSnapshot.docs.forEach(doc => {
        const marker = doc.data();
        if (marker.createdAt && !(marker.createdAt instanceof admin.firestore.Timestamp) && typeof marker.createdAt !== 'string') {
          timestampIssues++;
          console.log(`Marker ${doc.id} has invalid createdAt:`, marker.createdAt);
        }
        if (marker.updatedAt && !(marker.updatedAt instanceof admin.firestore.Timestamp) && typeof marker.updatedAt !== 'string') {
          timestampIssues++;
          console.log(`Marker ${doc.id} has invalid updatedAt:`, marker.updatedAt);
        }
      });
      if (timestampIssues === 0) {
        console.log('✅ All timestamps are valid');
      }
    } else {
      console.log('⚠️  No markers found!');
    }
    
    // Get polygons if any
    const polygonsRef = mapRef.collection('polygons');
    const polygonsSnapshot = await polygonsRef.get();
    console.log(`\n🔷 POLYGONS COUNT: ${polygonsSnapshot.size}`);
    
    return {
      mapData,
      markerCount: markersSnapshot.size,
      polygonCount: polygonsSnapshot.size
    };
    
  } catch (error) {
    console.error(`❌ Error analyzing map ${mapId}:`, error);
    return null;
  }
}

async function compareMaps() {
  const corruptedMapId = 'Zcq05pgM8oz1QkE2mBDe';
  const corruptedUserId = 'J9dP8wWXvQVVLrf38cwWthlhXdH2';
  
  const stableMapId = 'mLvrquL7TbMtDJxRtAOD';
  const stableUserId = 'Ql5olfgF8WZRG6j9fjpdpIhUMEv1';
  
  console.log('\n🔍 COMPARING MAP STRUCTURES\n');
  
  const corrupted = await analyzeMap(corruptedUserId, corruptedMapId, 'CORRUPTED MAP');
  const stable = await analyzeMap(stableUserId, stableMapId, 'STABLE MAP');
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(80));
  
  if (corrupted && stable) {
    console.log('\nMap Document Keys:');
    const corruptedKeys = Object.keys(corrupted.mapData).sort();
    const stableKeys = Object.keys(stable.mapData).sort();
    
    console.log(`Corrupted: ${corruptedKeys.join(', ')}`);
    console.log(`Stable: ${stableKeys.join(', ')}`);
    
    const missingInCorrupted = stableKeys.filter(k => !corruptedKeys.includes(k));
    const extraInCorrupted = corruptedKeys.filter(k => !stableKeys.includes(k));
    
    if (missingInCorrupted.length > 0) {
      console.log(`\n⚠️  Missing in corrupted: ${missingInCorrupted.join(', ')}`);
    }
    if (extraInCorrupted.length > 0) {
      console.log(`\n⚠️  Extra in corrupted: ${extraInCorrupted.join(', ')}`);
    }
    
    console.log(`\nMarker Counts:`);
    console.log(`Corrupted: ${corrupted.markerCount}`);
    console.log(`Stable: ${stable.markerCount}`);
    
    console.log(`\nPolygon Counts:`);
    console.log(`Corrupted: ${corrupted.polygonCount}`);
    console.log(`Stable: ${stable.polygonCount}`);
  }
  
  process.exit(0);
}

compareMaps().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

