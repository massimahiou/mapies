import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { parse } from 'csv-parse/sync';
import { Logger } from './utils/logger';

const logger = Logger.getInstance();

export interface CsvUploadJob {
  id: string;
  userId: string;
  mapId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    geocodingFailures: number;
    duplicates: number;
    skipped: number;
    currentStep: string;
    stepProgress: number;
    stepTotal: number;
  };
  columnMapping: {
    name: string | null;
    address: string | null;
    lat: string | null;
    lng: string | null;
  };
  results: {
    markersAdded: number;
    errors: string[];
    processingTime: number;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  success: boolean;
  error?: string;
}

export interface AddressData {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  rowIndex: number;
}

// Geocoding service with dual provider support
export class GeocodingService {
  private static readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
  private static readonly MAPBOX_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
  private static readonly MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWFzc2ltYWhpb3UiLCJhIjoiY21ncHoxdHNzMm95bjJsbjI2OHR6MHBqOSJ9.EOCBNHBTmagXTD4BStPIwA';

  static async geocodeAddress(address: string): Promise<GeocodingResult> {
    try {
      logger.info(`Starting geocoding for: ${address}`);
      
      // Try OpenStreetMap Nominatim first (primary)
      const nominatimResult = await this.geocodeWithNominatim(address);
      if (nominatimResult.success) {
        logger.info(`Nominatim success for: ${address}`);
        return nominatimResult;
      }
      
      // Fallback to Mapbox if Nominatim fails
      logger.info(`Nominatim failed for: ${address}, trying Mapbox fallback`);
      const mapboxResult = await this.geocodeWithMapbox(address);
      if (mapboxResult.success) {
        logger.info(`Mapbox success for: ${address}`);
        return mapboxResult;
      }
      
      logger.warn(`Both geocoding services failed for: ${address}`);
      return {
        lat: 0,
        lng: 0,
        success: false,
        error: 'Both geocoding services failed'
      };
    } catch (error) {
      logger.error(`Geocoding error for ${address}:`, error);
      return {
        lat: 0,
        lng: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async geocodeWithNominatim(address: string): Promise<GeocodingResult> {
    try {
      const response = await fetch(
        `${this.NOMINATIM_BASE_URL}?format=json&q=${encodeURIComponent(address)}&countrycodes=ca&limit=1`,
        {
          headers: {
            'User-Agent': 'Mapies/1.0 (https://mapies.app)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim HTTP error: ${response.status}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          success: true
        };
      }

      return {
        lat: 0,
        lng: 0,
        success: false,
        error: 'No results found'
      };
    } catch (error) {
      return {
        lat: 0,
        lng: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Nominatim error'
      };
    }
  }

  private static async geocodeWithMapbox(address: string): Promise<GeocodingResult> {
    try {
      // Try multiple address variations
      const addressVariations = [
        address, // Original address
        address.replace(/,\s*QC\s+\w+\s+\w+/, ', QC'), // Remove postal code
        address.replace(/,\s*QC.*/, ', QC'), // Remove everything after QC
        address.split(',')[0] + ', Saint-Hubert, QC', // Just street + city + province
        address.split(',')[0] + ', QC' // Just street + province
      ];
      
      for (const variation of addressVariations) {
        try {
          const response = await fetch(
            `${this.MAPBOX_BASE_URL}/${encodeURIComponent(variation)}.json?access_token=${this.MAPBOX_ACCESS_TOKEN}&country=CA&limit=1`
          );
          
          if (!response.ok) {
            continue;
          }
          
          const data = await response.json();
          
          if (data.features && data.features.length > 0) {
            const coordinates = data.features[0].center;
            return {
              lat: coordinates[1], // Mapbox returns [lng, lat]
              lng: coordinates[0],
              success: true
            };
          }
          
          // Add small delay between requests
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          continue;
        }
      }
      
      return {
        lat: 0,
        lng: 0,
        success: false,
        error: 'No results found in any variation'
      };
    } catch (error) {
      return {
        lat: 0,
        lng: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Mapbox error'
      };
    }
  }
}

// CSV Processing service
export class CsvProcessingService {
  static async processCsvFile(
    csvContent: string,
    columnMapping: CsvUploadJob['columnMapping'],
    jobId: string,
    userId: string,
    mapId: string
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update job status to processing
      await this.updateJobProgress(jobId, {
        status: 'processing',
        currentStep: 'Starting CSV processing...'
      });
      // Parse CSV content with error handling for inconsistent columns
      let records: any[];
      try {
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true, // Allow inconsistent column counts
          relax_quotes: true, // Handle malformed quotes
          on_record: (record, context) => {
            // Log problematic rows for debugging
            if (context.error) {
              logger.warn(`CSV parsing warning on line ${context.lines}:`, context.error.message);
            }
            return record;
          }
        });
      } catch (parseError) {
        logger.error('CSV parsing error:', parseError);
        await this.updateJobProgress(jobId, {
          status: 'failed',
          results: {
            markersAdded: 0,
            errors: [`CSV parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`],
            processingTime: Date.now() - startTime
          }
        });
        return;
      }

      logger.info(`Parsed CSV with ${records.length} rows`);

      // Update job with total count
      await this.updateJobProgress(jobId, {
        total: records.length,
        currentStep: 'Processing CSV data...',
        stepProgress: 0,
        stepTotal: records.length
      });

      // Prepare address data for processing
      const addressData: AddressData[] = [];
      let skippedRows = 0;

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        
        try {
          // Extract data based on column mapping with null checks
          const name = columnMapping.name && row[columnMapping.name] ? String(row[columnMapping.name]).trim() : '';
          const address = columnMapping.address && row[columnMapping.address] ? String(row[columnMapping.address]).trim() : '';
          const lat = columnMapping.lat && row[columnMapping.lat] ? parseFloat(String(row[columnMapping.lat])) : undefined;
          const lng = columnMapping.lng && row[columnMapping.lng] ? parseFloat(String(row[columnMapping.lng])) : undefined;

          // Skip rows without required data
          if (!name || (!address && (isNaN(lat!) || isNaN(lng!)))) {
            skippedRows++;
            logger.debug(`Skipping row ${i + 1}: missing required data`, { name, address, lat, lng });
            continue;
          }

          // Validate coordinates if provided
          if (lat !== undefined && lng !== undefined) {
            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
              logger.warn(`Invalid coordinates in row ${i + 1}:`, { lat, lng });
              skippedRows++;
              continue;
            }
          }

          addressData.push({
            name,
            address,
            lat: !isNaN(lat!) ? lat : undefined,
            lng: !isNaN(lng!) ? lng : undefined,
            rowIndex: i
          });
        } catch (rowError) {
          logger.warn(`Error processing row ${i + 1}:`, rowError);
          skippedRows++;
          continue;
        }
      }

      logger.info(`Prepared ${addressData.length} addresses for processing (${skippedRows} skipped)`);

      // Update job with skipped count
      await this.updateJobProgress(jobId, {
        skipped: skippedRows,
        currentStep: 'Geocoding addresses...',
        stepProgress: 0,
        stepTotal: addressData.length
      });

      // Process addresses with geocoding
      const processedMarkers: any[] = [];
      let geocodingFailures = 0;

      for (let i = 0; i < addressData.length; i++) {
        const addressDataItem = addressData[i];
        
        // Update progress
        await this.updateJobProgress(jobId, {
          processed: i,
          stepProgress: i,
          currentStep: `Geocoding addresses... (${i + 1}/${addressData.length})`
        });

        // Add delay between requests to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        let coordinates: { lat: number; lng: number } | null = null;

        // Use provided coordinates or geocode the address
        if (addressDataItem.lat && addressDataItem.lng) {
          coordinates = {
            lat: addressDataItem.lat,
            lng: addressDataItem.lng
          };
          logger.info(`Using provided coordinates for: ${addressDataItem.name}`);
        } else {
          // Try geocoding with retry mechanism
          let geocodingAttempts = 0;
          const maxAttempts = 3;
          
          while (geocodingAttempts < maxAttempts && !coordinates) {
            try {
              const geocodingResult = await GeocodingService.geocodeAddress(addressDataItem.address);
              if (geocodingResult.success) {
                coordinates = {
                  lat: geocodingResult.lat,
                  lng: geocodingResult.lng
                };
                logger.info(`Successfully geocoded: ${addressDataItem.name} (attempt ${geocodingAttempts + 1})`);
              } else {
                geocodingAttempts++;
                if (geocodingAttempts < maxAttempts) {
                  logger.warn(`Geocoding attempt ${geocodingAttempts} failed for: ${addressDataItem.name}, retrying...`);
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                }
              }
            } catch (error) {
              geocodingAttempts++;
              logger.error(`Geocoding error for ${addressDataItem.name} (attempt ${geocodingAttempts}):`, error);
              if (geocodingAttempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
              }
            }
          }
          
          if (!coordinates) {
            logger.warn(`Failed to geocode after ${maxAttempts} attempts: ${addressDataItem.name} - ${addressDataItem.address}`);
            geocodingFailures++;
          }
        }

        // Add marker to Firestore if geocoding succeeded
        if (coordinates) {
          try {
            const markerId = await this.addMarkerToMap(userId, mapId, {
              name: addressDataItem.name,
              address: addressDataItem.address,
              lat: coordinates.lat,
              lng: coordinates.lng,
              type: 'other',
              visible: true
            });

            processedMarkers.push({
              id: markerId,
              name: addressDataItem.name,
              address: addressDataItem.address,
              lat: coordinates.lat,
              lng: coordinates.lng
            });

            logger.info(`Added marker: ${addressDataItem.name} (ID: ${markerId})`);
          } catch (error) {
            logger.error(`Error adding marker for ${addressDataItem.name}:`, error);
            // Don't count this as a geocoding failure, but log the error
            // The marker addition failed, but geocoding succeeded
          }
        }
      }

      // Update job as completed
      const processingTime = Date.now() - startTime;
      await this.updateJobProgress(jobId, {
        status: 'completed',
        processed: addressData.length,
        geocodingFailures,
        currentStep: 'Completed',
        stepProgress: addressData.length,
        results: {
          markersAdded: processedMarkers.length,
          errors: [],
          processingTime
        }
      });

      logger.info(`CSV processing completed. Added ${processedMarkers.length} markers in ${processingTime}ms`);

    } catch (error) {
      logger.error('CSV processing error:', error);
      
      // Update job as failed
      await this.updateJobProgress(jobId, {
        status: 'failed',
        results: {
          markersAdded: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          processingTime: Date.now() - startTime
        }
      });
      
      throw error;
    }
  }

  private static async updateJobProgress(jobId: string, updates: Partial<CsvUploadJob['progress'] & { status?: CsvUploadJob['status'], results?: CsvUploadJob['results'] }>): Promise<void> {
    try {
      const jobRef = admin.firestore().collection('csvUploadJobs').doc(jobId);
      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.status) {
        updateData.status = updates.status;
      }

      if (updates.results) {
        updateData.results = updates.results;
      }

      if (updates.total !== undefined) updateData['progress.total'] = updates.total;
      if (updates.processed !== undefined) updateData['progress.processed'] = updates.processed;
      if (updates.geocodingFailures !== undefined) updateData['progress.geocodingFailures'] = updates.geocodingFailures;
      if (updates.duplicates !== undefined) updateData['progress.duplicates'] = updates.duplicates;
      if (updates.skipped !== undefined) updateData['progress.skipped'] = updates.skipped;
      if (updates.currentStep !== undefined) updateData['progress.currentStep'] = updates.currentStep;
      if (updates.stepProgress !== undefined) updateData['progress.stepProgress'] = updates.stepProgress;
      if (updates.stepTotal !== undefined) updateData['progress.stepTotal'] = updates.stepTotal;

      await jobRef.update(updateData);
    } catch (error) {
      logger.error('Error updating job progress:', error);
    }
  }

  private static async addMarkerToMap(
    userId: string,
    mapId: string,
    markerData: {
      name: string;
      address: string;
      lat: number;
      lng: number;
      type: string;
      visible: boolean;
    }
  ): Promise<string> {
    // For now, skip business detection to avoid import issues
    // TODO: Implement business detection in backend
    const markerWithCategory = {
      ...markerData,
      businessCategory: {
        id: 'other',
        name: 'Other',
        icon: '📍',
        color: '#3B82F6',
        confidence: 0.5,
        matchedTerm: ''
      }
    };
    
    const markersRef = admin.firestore().collection('users').doc(userId).collection('maps').doc(mapId).collection('markers');
    const docRef = await markersRef.add({
      ...markerWithCategory,
      userId,
      mapId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Sync to public collection for faster public access
    try {
      const publicMarkerRef = admin.firestore().collection('publicMaps').doc(mapId).collection('markers').doc(docRef.id);
      await publicMarkerRef.set({
        ...markerWithCategory,
        userId,
        mapId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        syncedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (syncError) {
      logger.warn('Failed to sync marker to public collection:', syncError);
    }
    
    // Update map stats
    await this.updateMapStats(userId, mapId);
    
    return docRef.id;
  }

  private static async updateMapStats(userId: string, mapId: string): Promise<void> {
    try {
      const markersSnapshot = await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('maps')
        .doc(mapId)
        .collection('markers')
        .get();

      const mapRef = admin.firestore().collection('users').doc(userId).collection('maps').doc(mapId);
      await mapRef.update({
        'stats.markerCount': markersSnapshot.size,
        'stats.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Error updating map stats:', error);
    }
  }

  // Retry failed job
  static async retryJob(jobId: string): Promise<void> {
    try {
      const jobRef = admin.firestore().collection('csvUploadJobs').doc(jobId);
      const jobDoc = await jobRef.get();
      
      if (!jobDoc.exists) {
        throw new Error('Job not found');
      }
      
      const jobData = jobDoc.data() as CsvUploadJob;
      
      if (jobData.status !== 'failed') {
        throw new Error('Job is not in failed state');
      }
      
      // Reset job status and start processing again
      await jobRef.update({
        status: 'pending',
        'progress.processed': 0,
        'progress.geocodingFailures': 0,
        'progress.currentStep': 'Retrying job...',
        'results.errors': [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      logger.info(`Retrying job: ${jobId}`);
      
      // Note: The actual retry would need the original CSV content and parameters
      // This is a simplified version - in practice, you'd need to store the CSV content
      // or have the client resubmit the file
      
    } catch (error) {
      logger.error(`Error retrying job ${jobId}:`, error);
      throw error;
    }
  }
}

// Configure multer for file uploads (replaced with busboy)
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB limit
//     fieldSize: 10 * 1024 * 1024, // 10MB field size limit
//   },
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only CSV files are allowed'));
//     }
//   }
// });

// CSV Upload Firebase Function - Version 1.1
export const processCsvUpload = functions.https.onRequest(async (req, res) => {
  const startTime = Date.now();
  
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Handle JSON request with CSV content
    try {
      logger.info('Request received:', {
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        method: req.method,
        bodyKeys: Object.keys(req.body || {})
      });

      // Get request body data
      const { csvContent, fileName, userId, mapId, columnMapping } = req.body;
      
      if (!csvContent || !fileName || !userId || !mapId) {
        res.status(400).json({ error: 'Missing required fields: csvContent, fileName, userId, or mapId' });
        return;
      }

      if (!columnMapping) {
        res.status(400).json({ error: 'Missing columnMapping' });
        return;
      }

      // Validate column mapping
      if (!columnMapping.name || (!columnMapping.address && (!columnMapping.lat || !columnMapping.lng))) {
        res.status(400).json({ error: 'Invalid column mapping: name and either address or lat/lng required' });
        return;
      }

      // Create job document
      const jobRef = admin.firestore().collection('csvUploadJobs').doc();
      const jobId = jobRef.id;

      const jobData: CsvUploadJob = {
        id: jobId,
        userId,
        mapId,
        fileName: fileName,
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          geocodingFailures: 0,
          duplicates: 0,
          skipped: 0,
          currentStep: 'Initializing...',
          stepProgress: 0,
          stepTotal: 0
        },
        columnMapping: columnMapping,
        results: {
          markersAdded: 0,
          errors: [],
          processingTime: 0
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any
      };

      await jobRef.set(jobData);

      logger.info(`Created CSV upload job: ${jobId} for user: ${userId}`);

      // Start processing asynchronously
      CsvProcessingService.processCsvFile(csvContent, columnMapping, jobId, userId, mapId)
        .then(() => {
          logger.info(`CSV processing completed for job: ${jobId}`);
        })
        .catch((error) => {
          logger.error(`CSV processing failed for job: ${jobId}`, error);
        });

      // Return job ID immediately
      res.status(202).json({
        success: true,
        jobId,
        message: 'CSV upload started. Use the jobId to track progress.'
      });

    } catch (error) {
      logger.error('CSV upload processing error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('CSV upload function error:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      processingTime,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// CSV Job Retry Function
export const retryCsvJob = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { jobId } = req.body;
    
    if (!jobId) {
      res.status(400).json({ error: 'Missing jobId' });
      return;
    }

    await CsvProcessingService.retryJob(jobId);
    
    res.status(200).json({
      success: true,
      message: 'Job retry initiated'
    });

  } catch (error) {
    logger.error('CSV job retry error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
