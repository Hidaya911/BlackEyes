// Run with node; set PLAYWRIGHT_MODULE to a cached Playwright package if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const split of [false, true]) {
      const page = await browser.newPage();
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (!path.startsWith('/api/')) return route.continue();
        if (path === '/api/customer/profile') return route.fulfill({ json: { user_id: 999, full_name: 'Design Test', email: 'test@example.com', phone: '123456', role: 'customer', status: 'active' } });
        if (path === '/api/customer/products') return route.fulfill({ json: [{ product_id: 99, name: 'A4 test', description: 'Paper', price: 100, standard_price: 100, special_price: false, image_url: null }] });
        if (path === '/api/customer/orders') return route.fulfill(route.request().method() === 'POST' ? { status: 422, json: { detail: 'Test intercepted; no order created.' } } : { json: [] });
        return route.fulfill({ status: 401, json: { detail: 'Test session' } });
      });
      await page.goto(process.env.FRONTEND_URL || 'http://localhost:5173');
      await page.evaluate(async () => {
        sessionStorage.clear();
        document.getElementById('root').style.display = 'none';
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const client = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
        const { CustomerPage } = await import('/src/components/customer/CustomerPage.tsx');
        const el = document.createElement('div'); document.body.append(el);
        client.createRoot(el).render(React.createElement(CustomerPage, { onLogout: () => {}, onProfileSaved: () => {} }));
      });
      await page.getByRole('button', { name: 'Customize A4 test' }).click();
      await page.getByLabel('Quantity', { exact: true }).fill('2');
      await page.getByLabel('Upload design 1').setInputFiles({ name: 'shared.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nTest') });
      if (split) {
        await page.getByRole('button', { name: 'Add a different design' }).click();
        await page.getByLabel('Upload design 2').setInputFiles({ name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSecond') });
        await page.getByLabel('Units using this design').first().fill('2');
        await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
        assert(await page.getByText('The quantities assigned to designs must match the item quantity.').isVisible());
        await page.getByLabel('Units using this design').first().fill('1');
      }
      await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
      await page.getByRole('button', { name: 'Open basket, 2 items' }).click();
      assert.equal(await page.getByLabel('Upload design 1').count(), 1);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert(await page.getByText('Pay locally at the press', { exact: true }).isVisible());
      assert(!/whish/i.test(await page.locator('.modal.show').innerText()));
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      const request = page.waitForRequest(r => r.url().endsWith('/api/customer/orders') && r.method() === 'POST');
      await page.getByRole('button', { name: 'Place order', exact: true }).click();
      const data = (await request).postDataJSON();
      assert.equal(data.payment_method, 'cash');
      assert.equal(data.payment_timing, 'after_pickup');
      assert.equal(data.items[0].designs.length, split ? 2 : 1);
      assert.equal(data.items[0].designs.reduce((sum, d) => sum + d.quantity, 0), 2);
      assert(data.items[0].designs.every(d => d.file.data_url.startsWith('data:application/pdf;base64,')));
      console.log(`${split ? 'Separate designs + quantity validation' : 'Shared design'}: passed; local payment submitted.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
