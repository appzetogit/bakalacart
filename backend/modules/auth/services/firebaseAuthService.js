import admin from 'firebase-admin';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { getFirebaseCredentials } from '../../../shared/utils/envService.js';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class FirebaseAuthService {
  constructor() {
    this.initialized = false;
    // Initialize asynchronously (don't await in constructor)
    this.init().catch(err => {
      logger.error(`Error initializing Firebase: ${err.message}`);
    });
  }

  async init() {
    if (this.initialized) return;

    try {
      const dbCredentials = await getFirebaseCredentials();
      let projectId = dbCredentials.projectId || process.env.FIREBASE_PROJECT_ID;
      let clientEmail = dbCredentials.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = dbCredentials.privateKey || process.env.FIREBASE_PRIVATE_KEY;

      // Fallback: read from firebaseconfig.json or firebase-service-account.json
      if (!projectId || !clientEmail || !privateKey) {
        try {
          const configFolderPath = path.resolve(process.cwd(), 'config', 'firebase-service-account.json');
          const oldConfigPath = path.resolve(process.cwd(), 'config', 'zomato-607fa-firebase-adminsdk-fbsvc-f5f782c2cc.json');
          const rootPath = path.resolve(process.cwd(), 'firebaseconfig.json');

          let serviceAccountPath = null;
          if (fs.existsSync(configFolderPath)) {
            serviceAccountPath = configFolderPath;
          } else if (fs.existsSync(oldConfigPath)) {
            serviceAccountPath = oldConfigPath;
          } else if (fs.existsSync(rootPath)) {
            serviceAccountPath = rootPath;
          }

          if (serviceAccountPath) {
            const raw = fs.readFileSync(serviceAccountPath, 'utf-8');
            const json = JSON.parse(raw);
            projectId = projectId || json.project_id;
            clientEmail = clientEmail || json.client_email;
            privateKey = privateKey || json.private_key;
            logger.info(`Loaded Firebase config from file: ${path.basename(serviceAccountPath)}`);
          }
        } catch (err) {
          logger.warn(`Failed to read Firebase config file: ${err.message}`);
        }
      }

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn(
          'Firebase Admin not fully configured. Google Sign-In and Push Notifications will be disabled.'
        );
        return;
      }

      // Handle escaped newlines in private key
      if (typeof privateKey === 'string' && privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      try {
        if (!admin.apps.length) {
          // Use regional URL for asia-southeast1 region
          let databaseURL = process.env.FIREBASE_DATABASE_URL;
          
          // If no URL provided or using old firebaseio.com format, use regional URL
          if (!databaseURL || databaseURL.includes('firebaseio.com')) {
            if (projectId === 'bakalaa-8f5c2') {
              databaseURL = `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
            } else {
              databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/`;
            }
          }
          
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey
            }),
            databaseURL
          });
          logger.info(`Firebase Admin initialized with DB: ${databaseURL}`);
        }

        this.initialized = true;
        this.currentProjectId = projectId;
        logger.info(`Firebase Admin initialized successfully for project: ${projectId}`);
      } catch (error) {
        if (error?.code === 'app/duplicate-app') {
          this.initialized = true;
          this.currentProjectId = projectId;
          return;
        }
        logger.error(`Failed to initialize Firebase Admin: ${error.message}`);
      }
    } catch (error) {
      logger.error(`Error in Firebase init: ${error.message}`);
    }
  }

  isEnabled() {
    return this.initialized;
  }

  /**
   * Verify a Firebase ID token and return decoded claims
   * @param {string} idToken
   * @returns {Promise<admin.auth.DecodedIdToken>}
   */
  async verifyIdToken(idToken) {
    if (!this.initialized) {
      await this.init();
      if (!this.initialized) {
        throw new Error('Firebase Admin is not configured. Please verify settings in dashboard or .env');
      }
    }

    if (!idToken) {
      throw new Error('ID token is required');
    }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      logger.info('Firebase ID token verified', {
        uid: decoded.uid,
        email: decoded.email,
        project: this.currentProjectId
      });
      return decoded;
    } catch (error) {
      logger.error(`Firebase token verification failed (Project: ${this.currentProjectId}): ${error.message}`);

      // Check for project ID mismatch in error (common issue)
      if (error.message.includes('aud')) {
        throw new Error(`Firebase project mismatch. Token is not for project "${this.currentProjectId}".`);
      }

      throw new Error('Invalid or expired Firebase ID token');
    }
  }
}

export default new FirebaseAuthService();


