export type BrowserType = 'chromium' | 'firefox' | 'webkit';
export type OSEnv = 'Windows' | 'macOS' | 'Android' | 'iOS';

export interface MatrixContext {
  id: string;
  browser: BrowserType;
  os: OSEnv;
  deviceName: string;
  userAgent: string;
  viewport: { width: number; height: number };
  isMobile: boolean;
}

export const BROWSER_MATRIX: Record<string, MatrixContext> = {
  'Chrome_Windows': {
    id: 'Chrome_Windows',
    browser: 'chromium',
    os: 'Windows',
    deviceName: 'Desktop Chrome',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    isMobile: false,
  },
  'Edge_Windows': {
    id: 'Edge_Windows',
    browser: 'chromium',
    os: 'Windows',
    deviceName: 'Desktop Edge',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    viewport: { width: 1280, height: 720 },
    isMobile: false,
  },
  'Firefox_Windows': {
    id: 'Firefox_Windows',
    browser: 'firefox',
    os: 'Windows',
    deviceName: 'Desktop Firefox',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    viewport: { width: 1280, height: 720 },
    isMobile: false,
  },
  'Safari_macOS': {
    id: 'Safari_macOS',
    browser: 'webkit',
    os: 'macOS',
    deviceName: 'Desktop Safari',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    viewport: { width: 1280, height: 720 },
    isMobile: false,
  },
  'Chrome_Android': {
    id: 'Chrome_Android',
    browser: 'chromium',
    os: 'Android',
    deviceName: 'Pixel 7',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    isMobile: true,
  },
  'Safari_iPhone': {
    id: 'Safari_iPhone',
    browser: 'webkit',
    os: 'iOS',
    deviceName: 'iPhone 14',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    isMobile: true,
  },
  'Samsung_Internet_Android': {
    id: 'Samsung_Internet_Android',
    browser: 'chromium',
    os: 'Android',
    deviceName: 'Galaxy S23',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/122.0.0.0 Mobile Safari/537.36',
    viewport: { width: 360, height: 780 },
    isMobile: true,
  }
};

export function getRandomMatrixProfile(): MatrixContext {
  const keys = Object.keys(BROWSER_MATRIX);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return BROWSER_MATRIX[randomKey];
}
