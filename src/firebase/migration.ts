import { db } from './config'
import { collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore'

// Migration function to add missing clustering settings to existing maps
export const migrateMapSettings = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Starting migration for user:', userId)
    
    // Get all maps for the user
    const mapsRef = collection(db, 'users', userId, 'maps')
    const mapsSnapshot = await getDocs(mapsRef)
    
    let migratedCount = 0
    
    for (const mapDoc of mapsSnapshot.docs) {
      const mapData = mapDoc.data()
      
      // Check if clustering settings are missing
      if (mapData.settings && 
          (mapData.settings.clusteringEnabled === undefined || 
           mapData.settings.clusterRadius === undefined)) {
        
        console.log('📝 Migrating map:', mapDoc.id, mapData.name)
        
        // Update the map with default clustering settings
        await updateDoc(doc(db, 'users', userId, 'maps', mapDoc.id), {
          'settings.clusteringEnabled': mapData.settings.clusteringEnabled !== undefined ? mapData.settings.clusteringEnabled : true,
          'settings.clusterRadius': mapData.settings.clusterRadius || 50,
          'settings.searchBarBackgroundColor': mapData.settings.searchBarBackgroundColor || '#ffffff',
          'settings.searchBarTextColor': mapData.settings.searchBarTextColor || '#000000',
          'settings.searchBarHoverColor': mapData.settings.searchBarHoverColor || '#f3f4f6',
          'settings.nameRules': mapData.settings.nameRules || [],
          updatedAt: serverTimestamp()
        })
        
        migratedCount++
        console.log('✅ Migrated map:', mapDoc.id)
      }
    }
    
    console.log(`🎉 Migration completed! Migrated ${migratedCount} maps.`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Function to migrate a specific map
export const migrateSpecificMap = async (userId: string, mapId: string): Promise<void> => {
  try {
    console.log('🔄 Migrating specific map:', mapId)
    
    const mapRef = doc(db, 'users', userId, 'maps', mapId)
    
    // Update the map with default clustering settings
    await updateDoc(mapRef, {
      'settings.clusteringEnabled': true,
      'settings.clusterRadius': 50,
      'settings.searchBarBackgroundColor': '#ffffff',
      'settings.searchBarTextColor': '#000000',
      'settings.searchBarHoverColor': '#f3f4f6',
      'settings.nameRules': [],
      updatedAt: serverTimestamp()
    })
    
    console.log('✅ Migrated map:', mapId)
    
  } catch (error) {
    console.error('❌ Migration failed for map:', mapId, error)
    throw error
  }
}







