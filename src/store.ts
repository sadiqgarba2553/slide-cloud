import type { Deck } from './model';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('slidecloud', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('decks', { keyPath: 'id' }); request.result.createObjectStore('originals'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function run<T>(name: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode), request = action(tx.objectStore(name));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('Local storage is unavailable. Export a backup of your work.')); };
  });
}
let saves: Promise<unknown> = Promise.resolve();
export const store = {
  list: (): Promise<Deck[]> => run('decks', 'readonly', s => s.getAll()),
  save: (deck: Deck) => { const snapshot = structuredClone(deck); saves = saves.catch(() => {}).then(() => run('decks', 'readwrite', s => s.put(snapshot))); return saves; },
  original: (id: string, name: string, data: Uint8Array) => run('originals', 'readwrite', s => s.put({ name, data }, id)),
  getOriginal: (id: string): Promise<{ name: string; data: Uint8Array } | undefined> => run('originals', 'readonly', s => s.get(id)),
  remove: async (id: string) => {
    await saves.catch(() => {});
    const db = await database();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['decks', 'originals'], 'readwrite');
      tx.objectStore('decks').delete(id); tx.objectStore('originals').delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },
};
