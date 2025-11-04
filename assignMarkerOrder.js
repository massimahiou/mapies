const admin = require('firebase-admin')
const { readFileSync } = require('fs')
const { join } = require('path')

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), 'config', 'mapies-firebase-adminsdk-fbsvc-40548c12ec.json'), 'utf8')
  )
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'mapies'
  })
}

const db = admin.firestore()

async function assignMarkerOrder() {
  try {
    console.log('🚀 Starting marker order assignment for all users...\n')

    let totalUsers = 0
    let totalMaps = 0
    let totalMarkers = 0
    let markersUpdated = 0
    let markersAlreadyOrdered = 0
    let errors = 0

    // Get all users
    const usersSnapshot = await db.collection('users').get()
    totalUsers = usersSnapshot.size
    console.log(`📊 Found ${totalUsers} users\n`)

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id
      console.log(`👤 Processing user: ${userId}`)

      // Get all maps for this user
      const mapsRef = db.collection('users').doc(userId).collection('maps')
      const mapsSnapshot = await mapsRef.get()

      if (mapsSnapshot.empty) {
        console.log(`   ⏭️  No maps found for user ${userId}\n`)
        continue
      }

      console.log(`   📋 Found ${mapsSnapshot.size} maps`)
      totalMaps += mapsSnapshot.size

      // Process each map
      for (const mapDoc of mapsSnapshot.docs) {
        const mapId = mapDoc.id
        const mapData = mapDoc.data()
        console.log(`   🗺️  Processing map: ${mapId} (${mapData.name || 'Unnamed'})`)

        // Get all markers for this map
        const markersRef = mapsRef.doc(mapId).collection('markers')
        const markersSnapshot = await markersRef.get()

        if (markersSnapshot.empty) {
          console.log(`      ⏭️  No markers found for map ${mapId}\n`)
          continue
        }

        totalMarkers += markersSnapshot.size
        console.log(`      📍 Found ${markersSnapshot.size} markers`)

        // Check which markers need order assignment
        const markers = markersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        // Sort markers by createdAt (oldest first) to preserve original order
        const sortedMarkers = [...markers].sort((a, b) => {
          const aTime = a.createdAt?.getTime?.() || a.createdAt?.seconds * 1000 || 0
          const bTime = b.createdAt?.getTime?.() || b.createdAt?.seconds * 1000 || 0
          return aTime - bTime
        })

        // Get max existing order or 0
        const existingOrders = markers.map(m => m.order).filter(o => o !== undefined && o !== null && o > 0)
        const maxOrder = existingOrders.length > 0 ? Math.max(...existingOrders) : 0

        // Assign sequential order starting from 1
        const orderUpdates = []
        let indexOffset = 0
        sortedMarkers.forEach((marker, index) => {
          if (marker.order === undefined || marker.order === null || marker.order === 0) {
            const newOrder = maxOrder + indexOffset + 1
            orderUpdates.push({ markerId: marker.id, order: newOrder })
            indexOffset++
          } else {
            markersAlreadyOrdered++
          }
        })

        // Update Firestore with order values
        if (orderUpdates.length > 0) {
          try {
            const batch = db.batch()
            orderUpdates.forEach(({ markerId, order }) => {
              const markerRef = markersRef.doc(markerId)
              batch.update(markerRef, { order })
            })
            await batch.commit()
            markersUpdated += orderUpdates.length
            console.log(`      ✅ Assigned order to ${orderUpdates.length} markers`)
          } catch (error) {
            console.error(`      ❌ Error updating markers for map ${mapId}:`, error)
            errors++
          }
        } else {
          console.log(`      ✓ All markers already have order assigned`)
        }
        console.log()
      }
      console.log()
    }

    // Summary
    console.log('='.repeat(80))
    console.log('📊 SUMMARY')
    console.log('='.repeat(80))
    console.log(`👤 Total users processed: ${totalUsers}`)
    console.log(`🗺️  Total maps processed: ${totalMaps}`)
    console.log(`📍 Total markers found: ${totalMarkers}`)
    console.log(`✅ Markers updated: ${markersUpdated}`)
    console.log(`✓ Markers already ordered: ${markersAlreadyOrdered}`)
    console.log(`❌ Errors: ${errors}`)
    console.log('='.repeat(80))
    console.log('\n✅ Migration completed successfully!')

  } catch (error) {
    console.error('💥 Fatal error in assignMarkerOrder:', error)
    process.exit(1)
  }
}

assignMarkerOrder()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

