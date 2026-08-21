const DATABASE_NAME = "kenzai-legal-vault"
const DATABASE_VERSION = 1
const DOCUMENT_STORE = "documents"

export type StoredPdfDocument = {
  id: string
  name: string
  size: number
  type: string
  lastModified: number
  uploadedAt: number
  file: Blob
  inspection?: unknown
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
        database.createObjectStore(DOCUMENT_STORE, { keyPath: "id" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Unable to open the local document library."))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, mode)
    const request = action(transaction.objectStore(DOCUMENT_STORE))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("The local document operation failed."))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error("The local document transaction failed."))
    }
  })
}

export async function listStoredPdfDocuments(): Promise<StoredPdfDocument[]> {
  const documents = await withStore<StoredPdfDocument[]>("readonly", (store) => store.getAll())
  return documents.sort((first, second) => second.uploadedAt - first.uploadedAt)
}

export async function saveStoredPdfDocument(document: StoredPdfDocument): Promise<void> {
  await withStore<IDBValidKey>("readwrite", (store) => store.put(document))
}

export async function removeStoredPdfDocument(id: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(id))
}

export async function clearStoredPdfDocuments(): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.clear())
}
