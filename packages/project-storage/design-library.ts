import { get, set } from "idb-keyval";
import {
  emptyLibrary,
  validateLibrary,
  type DesignLibrary,
} from "../designer/library";
// Separate key space from pamph: project records.
const libraryKey = "shared-design-library:v1";
export async function loadDesignLibrary(): Promise<DesignLibrary> {
  const raw = await get(libraryKey);
  return raw ? validateLibrary(raw) : emptyLibrary();
}
export async function saveDesignLibrary(library: DesignLibrary) {
  await set(libraryKey, validateLibrary(library));
}
