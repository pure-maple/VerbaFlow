const DB_NAME = 'VerbaFlowDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_CHATS = 'chats';

export interface StorageStats {
  projectSize: number;
  chatCount: number;
}

class StorageService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CHATS)) {
          db.createObjectStore(STORE_CHATS, { keyPath: 'id' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) await this.init();
    const transaction = this.db!.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- Generic Methods ---

  async save(storeName: string, data: any): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName: string, key: string | number): Promise<any> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName: string): Promise<any[]> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string | number): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Specific Operations ---

  async saveWorkspaceState(state: any) {
    // We store the current workspace state with a fixed ID 'current'
    // To avoid circular structure or issues, ensure state is serializable
    const serialized = JSON.parse(JSON.stringify(state));
    await this.save(STORE_PROJECTS, { id: 'current', ...serialized, updatedAt: Date.now() });
  }

  async loadWorkspaceState() {
    return await this.get(STORE_PROJECTS, 'current');
  }

  async saveChats(chats: any[]) {
     // We can store all chats as one array or individual items. 
     // For performance with many chats, individual is better, but for simplicity compatible with current app structure:
     // We will store the array wrapper for now, or loop.
     // Let's store individual chats to allow easier management later.
     const tx = this.db!.transaction(STORE_CHATS, 'readwrite');
     const store = tx.objectStore(STORE_CHATS);
     
     // Clear old and rewrite (simple sync strategy)
     // In a real robust app, we'd update diffs.
     // For now, let's just save the whole array as a single object 'chat_history' to match localStorage behavior logic
     // but inside IDB to bypass size limits.
     store.put({ id: 'chat_history', data: chats });
  }

  async loadChats() {
    const result = await this.get(STORE_CHATS, 'chat_history');
    return result ? result.data : [];
  }

  async getStats(): Promise<StorageStats> {
      if (!this.db) await this.init();
      
      // Calculate roughly
      const workspace = await this.get(STORE_PROJECTS, 'current');
      const chats = await this.get(STORE_CHATS, 'chat_history');
      
      const projectSize = workspace ? new Blob([JSON.stringify(workspace)]).size : 0;
      const chatCount = chats?.data ? chats.data.length : 0;
      
      return { projectSize, chatCount };
  }
  
  async clearAllData() {
      await this.clear(STORE_PROJECTS);
      await this.clear(STORE_CHATS);
  }
}

export const storage = new StorageService();
