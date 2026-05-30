const mongoose = require('mongoose');

const maskMongoUri = (mongoUri) => {
  try {
    const parsedUri = new URL(mongoUri);
    parsedUri.username = parsedUri.username ? '***' : '';
    parsedUri.password = parsedUri.password ? '***' : '';
    return `${parsedUri.protocol}//${parsedUri.host}${parsedUri.pathname}`;
  } catch {
    return 'configured MongoDB URI';
  }
};

const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured');
  }

  mongoose.set('bufferCommands', false);

  const startedAt = Date.now();
  console.log(`Connecting to MongoDB at ${maskMongoUri(mongoUri)}`);

  await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`MongoDB connected to ${mongoose.connection.name} in ${Date.now() - startedAt}ms`);
};

module.exports = connectDatabase;
