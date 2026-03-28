import mongoose from 'mongoose';
import winston from 'winston';
import dns from 'dns';

// Set DNS servers to fix MongoDB Atlas connection issues
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export const connectDB = async (retryCount = 0, maxRetries = 3) => {
  try {
    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      logger.error('MONGODB_URI is not set in environment variables');
      process.exit(1);
    }

    // Log retry attempt
    if (retryCount > 0) {
      logger.info(`🔄 Attempting MongoDB connection (retry ${retryCount}/${maxRetries})...`);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection timeout settings - increased for DNS resolution
      serverSelectionTimeoutMS: 60000, // 60 seconds to select server (includes DNS resolution)
      connectTimeoutMS: 60000, // 60 seconds to establish connection
      socketTimeoutMS: 45000, // 45 seconds for socket operations
      
      // Connection pool settings
      maxPoolSize: 10, // Maximum number of connections in pool
      minPoolSize: 2, // Minimum number of connections in pool
      
      // Retry settings
      retryWrites: true,
      retryReads: true,
      
      // Heartbeat settings
      heartbeatFrequencyMS: 10000, // Check connection every 10 seconds
      
      // Other options
      family: 4, // Use IPv4, skip trying IPv6
    });

    // Set mongoose-level buffer options (not MongoDB driver options)
    mongoose.set('bufferCommands', false); // Fail fast instead of buffering

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`, {
        error: err.message,
        stack: err.stack
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected - attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });

    mongoose.connection.on('connecting', () => {
      logger.info('MongoDB connecting...');
    });

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    const isDNSError = error.message.includes('querySrv') || 
                       error.message.includes('ETIMEOUT') ||
                       error.message.includes('ENOTFOUND') ||
                       error.message.includes('getaddrinfo');
    
    logger.error(`Error connecting to MongoDB: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      mongodbUri: process.env.MONGODB_URI ? 'Set (hidden)' : 'Not set',
      retryCount,
      isDNSError
    });

    // If it's a DNS error and we haven't exceeded max retries, retry with exponential backoff
    if (isDNSError && retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
      logger.warn(`⏳ DNS resolution failed. Retrying in ${delay}ms... (${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retryCount + 1, maxRetries);
    }

    // If it's a DNS error, provide helpful troubleshooting info
    if (isDNSError) {
      logger.error('\n❌ DNS Resolution Failed - Troubleshooting Steps:');
      logger.error('1. Check your internet connection');
      logger.error('2. Verify DNS server is working (try: nslookup cluster0.ptajoze.mongodb.net)');
      logger.error('3. Check if firewall/VPN is blocking DNS queries');
      logger.error('4. Verify MongoDB Atlas cluster is not paused');
      logger.error('5. Check if MONGODB_URI connection string is correct');
      logger.error('6. Try using a different DNS server (e.g., 8.8.8.8 or 1.1.1.1)');
    }

    // Exit after all retries exhausted
    logger.error('❌ Failed to connect to MongoDB after all retry attempts. Exiting...');
    process.exit(1);
  }
};

export default connectDB;

