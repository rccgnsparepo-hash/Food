import { initializeDatabaseSeed } from '../services/seedService';

export async function seedInitialDataIfNeeded() {
  await initializeDatabaseSeed();
}

