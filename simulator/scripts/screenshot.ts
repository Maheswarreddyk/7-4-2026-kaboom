import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('kaboom_display_name', 'SimUser');
    localStorage.setItem('kaboom_tutorial_seen', 'true');
    localStorage.setItem('kaboom_match_mode', 'RANDOM');
  });
  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));

  try {
    await page.goto('http://127.0.0.1:5173');
    await page.waitForSelector('button:has-text("Resume")');
    await page.click('button:has-text("Resume")');
    await page.waitForURL('**/chat');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot.png' });
    console.log('Screenshot saved to screenshot.png');
  } catch (err) {
    console.error('Error:', err);
    await page.screenshot({ path: 'screenshot-error.png' });
  }
  await browser.close();
}

run().catch(console.error);
