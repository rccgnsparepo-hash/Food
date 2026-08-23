import fs from 'fs';
import path from 'path';

// Embedded JSON file-backed database for Authoritative Server State
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'bukkit-db.json');

// In-memory memory store
let memoryStore: Record<string, Record<string, any>> = {};

// Ensure directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    memoryStore = JSON.parse(raw);
  } else {
    memoryStore = {};
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryStore, null, 2));
  }
} catch (e) {
  console.warn('Embedded DB initialization note:', e);
}

// Debounced disk flusher
let saveTimeout: NodeJS.Timeout | null = null;
function persistToDisk() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist embedded DB to disk:', err);
    }
  }, 150);
}

export const serverDb = {
  getCollection(name: string): Record<string, any> {
    if (!memoryStore[name]) {
      memoryStore[name] = {};
    }
    return memoryStore[name];
  },

  getAll(collectionName: string): any[] {
    const col = this.getCollection(collectionName);
    return Object.values(col);
  },

  getDoc(collectionName: string, id: string): any | null {
    const col = this.getCollection(collectionName);
    return col[id] || null;
  },

  setDoc(collectionName: string, id: string, data: any, merge = false): any {
    const col = this.getCollection(collectionName);
    const existing = col[id] || {};
    const finalData = merge ? { ...existing, ...data, id } : { ...data, id };
    col[id] = finalData;
    persistToDisk();
    return finalData;
  },

  deleteDoc(collectionName: string, id: string): boolean {
    const col = this.getCollection(collectionName);
    if (col[id]) {
      delete col[id];
      persistToDisk();
      return true;
    }
    return false;
  },

  dump() {
    return memoryStore;
  }
};
