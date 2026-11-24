import { openDB } from "idb";
import type { StoredDocument } from "./types";

const DB_NAME = "formsaathi-local-vault";
const STORE_NAME = "documents";

async function getDatabase() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    }
  });
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const database = await getDatabase();
  const documents = await database.getAll(STORE_NAME) as StoredDocument[];
  return documents.sort((a, b) => b.addedAt - a.addedAt);
}

export async function saveDocument(document: StoredDocument): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAME, document);
}

export async function deleteDocument(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(STORE_NAME, id);
}
