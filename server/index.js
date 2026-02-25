import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { getDb } from './db.js';
import { createGenerateRouter } from './routes/generate.js';
import { createDataRouter } from './routes/data.js';
import { createGalleryRouter } from './routes/gallery.js';
import { createAdminRouter } from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not found in environment. Create a .env.local file.');
  process.exit(1);
}

// Initialize database
const db = getDb();
console.log('[Server] Database initialized.');

// Mount routes
app.use('/api', createGenerateRouter(apiKey));
app.use('/api', createDataRouter(db));
app.use('/api', createGalleryRouter(db));

// Admin routes are protected by an optional API key when ADMIN_API_KEY is set
function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return next(); // No key configured — allow access (local dev)
  const provided = req.get('x-admin-key');
  if (!provided || provided !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use('/api', adminAuth, createAdminRouter(db));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
