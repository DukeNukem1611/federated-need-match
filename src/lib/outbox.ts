// Tiny IndexedDB outbox for field reports written while offline. Reports are
// queued locally (IndexedDB, not localStorage — payloads may include a photo)
// and flushed by <OutboxSync> whenever connectivity returns.
// Client-side only.

const DB_NAME = "relief-outbox";
const STORE = "reports";

export type QueuedReport = {
  id?: number;
  endpoint: string; // e.g. /api/ingest
  payload: unknown; // JSON body to POST
  queuedAt: number;
};

// Fired whenever the queue changes so any listener (badge) can re-count.
export const OUTBOX_EVENT = "relief-outbox-changed";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function addToOutbox(endpoint: string, payload: unknown): Promise<void> {
  await tx("readwrite", s => s.add({ endpoint, payload, queuedAt: Date.now() } satisfies QueuedReport));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export function listOutbox(): Promise<QueuedReport[]> {
  return tx("readonly", s => s.getAll() as IDBRequest<QueuedReport[]>);
}

export async function removeFromOutbox(id: number): Promise<void> {
  await tx("readwrite", s => s.delete(id));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export async function outboxCount(): Promise<number> {
  return tx("readonly", s => s.count());
}
