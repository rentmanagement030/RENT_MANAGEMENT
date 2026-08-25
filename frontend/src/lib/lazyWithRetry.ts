import { ComponentType, lazy, LazyExoticComponent } from "react";

/**
 * Resilient lazy loader that automatically refreshes the page when a new deployment
 * has invalidated older chunk hashes in the user's browser session.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    const refreshedKey = "spa_chunk_reload_attempted";
    const hasAlreadyRefreshed = sessionStorage.getItem(refreshedKey) === "true";

    try {
      const module = await componentImport();
      sessionStorage.removeItem(refreshedKey);
      return module;
    } catch (error: any) {
      const errorMessage = String(error?.message || error || "");
      const isChunkError =
        errorMessage.includes("Failed to fetch dynamically imported module") ||
        errorMessage.includes("MIME type") ||
        errorMessage.includes("error loading dynamically imported module") ||
        errorMessage.includes("Importing a module script failed");

      if (isChunkError && !hasAlreadyRefreshed) {
        sessionStorage.setItem(refreshedKey, "true");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }

      sessionStorage.removeItem(refreshedKey);
      throw error;
    }
  });
}
