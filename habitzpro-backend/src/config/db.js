const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS:          45000,
      connectTimeoutMS:         10000,
      heartbeatFrequencyMS:     5000,
      retryWrites:              true,
    });

    console.log(`✅  MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌  MongoDB error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Retrying...');
      setTimeout(connectDB, 5000); // auto-reconnect after 5 seconds
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅  MongoDB reconnected!');
    });

  } catch (err) {
    console.error('❌  Failed to connect to MongoDB:', err.message);
    setTimeout(connectDB, 5000); // retry after 5 seconds
  }
};

module.exports = connectDB;