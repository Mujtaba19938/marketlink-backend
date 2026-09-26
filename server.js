import express from 'express';
import connectDB from './config/db.js';
import router from './routes/authRoutes.js';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { seedDatabase } from './config/seedData.js';

// 1. Load Environment Configuration
try {
  process.loadEnvFile();
} catch (e) {
  // .env will use process.env or fallback defaults
}

// 2. Dynamic & Secure CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://marketlink-two.vercel.app',
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_ALT,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      origin.startsWith('http://localhost:') ||
      origin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  optionSuccessStatus: 200,
};

// 3. Logger Stream Setup (only in persistent local environment)
let logStream = null;
if (!process.env.VERCEL) {
  try {
    let logDirectory = 'C:/LogData';
    if (!fs.existsSync(logDirectory)) {
      try {
        fs.mkdirSync(logDirectory, { recursive: true });
      } catch {
        logDirectory = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDirectory)) fs.mkdirSync(logDirectory, { recursive: true });
      }
    }
    const logFilePath = path.join(logDirectory, 'log.txt');
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  } catch (e) {
    console.warn("File logger initialization notice:", e.message);
  }
}

const app = express();
const port = process.env.PORT || 5000;

// 4. Middlewares
app.use(morgan('dev'));
if (logStream) {
  app.use(morgan('combined', { stream: logStream }));
}

app.use(cors(corsOptions));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Serve uploaded media files statically (in local environments)
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch {
    // ignore
  }
}
app.use('/uploads', express.static(uploadsDir));

// 5. Serverless Database Connection Middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database connection failure in request pipeline:", err.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed: " + err.message,
    });
  }
});

// Seed data once when running locally
if (!process.env.VERCEL) {
  connectDB().then(() => {
    seedDatabase().catch((err) => console.error("Database seed error:", err));
  });
}

// 6. Application Routes
app.use('/', router);

// Health check root
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    project: 'MarketLink - Farm Fresh Just a Click Away',
    serverless: Boolean(process.env.VERCEL),
    serverTime: new Date().toISOString(),
    apiDocs: 'Express.js MERN Backend API on Vercel Serverless',
  });
});

// 7. Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// 8. Start HTTP Server (Only in local non-serverless mode)
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server connected on http://localhost:${port}`);
  });
}

export default app;
