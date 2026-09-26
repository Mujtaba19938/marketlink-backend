import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { seedDatabase } from './config/seedData.js';

try {
  process.loadEnvFile();
} catch (e) {
  // Ignore if no .env
}

const runSeed = async () => {
  await connectDB();
  await seedDatabase();
  await mongoose.disconnect();
  console.log("Database connection closed.");
  process.exit(0);
};

runSeed();
