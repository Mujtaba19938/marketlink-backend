import mongoose from "mongoose";
import dns from "dns";

try {
  process.loadEnvFile();
} catch (e) {}

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
  }

  if (process.env.VERCEL && !process.env.MONGODB_URI) {
    throw new Error(
      "Missing MONGODB_URI in Vercel. Please set MONGODB_URI (e.g. MongoDB Atlas cluster URL) in Vercel Project Settings -> Environment Variables and redeploy."
    );
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/AptechDB2';
  try {
    const db = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState >= 1;
    console.log(`Database connected successfully to ${uri}`);
  } catch (error) {
    console.error("Database connection error:", error.message);
    if (!process.env.VERCEL) {
      console.warn("Retrying database connection on subsequent requests...");
    }
    throw error;
  }
};

export default connectDB;