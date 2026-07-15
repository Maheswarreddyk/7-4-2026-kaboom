export class BrowserCapabilities {
  static supportsNotifications(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  static supportsPush(): boolean {
    return typeof window !== 'undefined' && 'PushManager' in window;
  }

  static supportsServiceWorker(): boolean {
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  }

  static supportsCamera(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
  }

  static supportsMicrophone(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
  }

  static supportsPictureInPicture(): boolean {
    return typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;
  }

  static supportsBroadcastChannel(): boolean {
    return typeof window !== 'undefined' && 'BroadcastChannel' in window;
  }

  static supportsMatchMedia(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia;
  }

  static supportsIntersectionObserver(): boolean {
    return typeof window !== 'undefined' && 'IntersectionObserver' in window;
  }

  static supportsResizeObserver(): boolean {
    return typeof window !== 'undefined' && 'ResizeObserver' in window;
  }

  static supportsVisualViewport(): boolean {
    return typeof window !== 'undefined' && !!window.visualViewport;
  }

  static supportsLocalStorage(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const test = '__test__';
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  static supportsSessionStorage(): boolean {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return false;
      const test = '__test__';
      window.sessionStorage.setItem(test, test);
      window.sessionStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
}
