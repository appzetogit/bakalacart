import mongoose from 'mongoose';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export const connectDB = async () => {
  try {
    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      logger.error('MONGODB_URI is not set in environment variables');
      process.exit(1);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection timeout settings
      serverSelectionTimeoutMS: 30000, // 30 seconds to select server
      connectTimeoutMS: 30000, // 30 seconds to establish connection
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
    logger.error(`Error connecting to MongoDB: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      mongodbUri: process.env.MONGODB_URI ? 'Set (hidden)' : 'Not set'
    });
    process.exit(1);
  }
};

export default connectDB;

