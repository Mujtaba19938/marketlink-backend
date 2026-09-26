import mongoose from "mongoose";

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
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