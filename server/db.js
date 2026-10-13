const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const initialSeedData = require('./data/initialSeed');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db_fallback.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let memoryDb = null;

// Initialize memory DB from initial seed or saved file
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    memoryDb = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading fallback db file:', e.message);
  }
}

if (!memoryDb || !memoryDb.items || memoryDb.items.length === 0) {
  memoryDb = JSON.parse(JSON.stringify(initialSeedData));
  persistMemoryDb();
}

function persistMemoryDb() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryDb, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving fallback db file:', e.message);
  }
}

function resetDbToSeed() {
  memoryDb = JSON.parse(JSON.stringify(initialSeedData));
  persistMemoryDb();
  return memoryDb;
}

let isMongoConnected = false;

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dept_inventory';
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2000
    });
    isMongoConnected = true;
    console.log('✅ Connected to MongoDB successfully:', mongoUri);
  } catch (err) {
    isMongoConnected = false;
    console.log('💡 Note: Running with persistent Embedded JSON Engine (Zero-config instant demo mode)');
  }
}

module.exports = {
  connectDB,
  getIsMongoConnected: () => isMongoConnected,
  getMemoryDb: () => memoryDb,
  persistMemoryDb,
  resetDbToSeed
};
