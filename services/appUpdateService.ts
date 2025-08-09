/**
 * App Update Service
 * Handles automatic updates and cache management for the PWA
 */

interface UpdateInfo {
  available: boolean;
  version?: string;
  releaseNotes?: string;
}

export class AppUpdateService {
  private static updateAvailable = false;
  private static newWorker: ServiceWorker | null = null;

  /**
   * Initialize the update service
   */
  static initialize(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload the page when a new service worker takes control
        window.location.reload();
      });

      // Listen for updates
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            this.newWorker = newWorker;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available
                this.updateAvailable = true;
                this.notifyUpdateAvailable();
              }
            });
          }
        });
      });
    }
  }

  /**
   * Check for updates manually
   */
  static async checkForUpdates(): Promise<UpdateInfo> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();

        return {
          available: this.updateAvailable,
          version: this.getAppVersion(),
          releaseNotes: 'Bug fixes and improvements'
        };
      } catch (error) {
        console.error('Error checking for updates:', error);
        return { available: false };
      }
    }
    return { available: false };
  }

  /**
   * Apply the update
   */
  static applyUpdate(): void {
    if (this.newWorker) {
      this.newWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Clear all caches and reload
   */
  static async clearCacheAndReload(): Promise<void> {
    try {
      // Clear all caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );

      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Reload the page
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      // Force reload anyway
      window.location.reload();
    }
  }

  /**
   * Get current app version
   */
  private static getAppVersion(): string {
    // You can set this in your build process
    return process.env.REACT_APP_VERSION || '1.0.0';
  }

  /**
   * Notify user that update is available
   */
  private static notifyUpdateAvailable(): void {
    // Create a custom event that components can listen to
    const event = new CustomEvent('app-update-available', {
      detail: {
        version: this.getAppVersion(),
        applyUpdate: () => this.applyUpdate(),
        clearCache: () => this.clearCacheAndReload()
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Force refresh with cache bypass
   */
  static forceRefresh(): void {
    // Use location.replace to avoid back button issues
    window.location.replace(window.location.href + '?v=' + Date.now());
  }

  /**
   * Check if app is running in standalone mode (PWA)
   */
  static isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
  }
}

export default AppUpdateService;