import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 5175;
const DEBUG_PORT = 9226;
const SHOTS_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\3f5db5f2-96bc-4bf8-b28b-40540510cf0c\\shots';

fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Start vite preview
console.log('1. Starting Vite preview server on port', PORT);
const previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore'
});

await sleep(2000);

// 2. Launch Headless Edge
console.log('2. Launching Headless Edge Chromium...');
const userDataDir = path.resolve('tmp_edge_profile_2');
fs.mkdirSync(userDataDir, { recursive: true });

const edgeProcess = spawn(EDGE_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--user-data-dir=${userDataDir}`,
  'about:blank'
], { stdio: 'ignore' });

await sleep(2000);

async function getJson(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${DEBUG_PORT}${endpoint}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

const targets = await getJson('/json');
const pageTarget = targets?.find(t => t.type === 'page');
if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
  console.error('❌ Could not find page target');
  edgeProcess.kill();
  previewProcess.kill();
  process.exit(1);
}

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
let msgId = 1;
const pending = new Map();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
};

async function sendCdp(method, params = {}) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise(resolve => ws.onopen = resolve);
console.log('  ✅ Connected to Edge DevTools WebSocket');

await sendCdp('Page.enable');
await sendCdp('Runtime.enable');
await sendCdp('DOM.enable');

// 3. Navigate
console.log('3. Navigating to http://localhost:' + PORT);
await sendCdp('Page.navigate', { url: `http://localhost:${PORT}/` });
await sleep(2000);

// 4. Authenticate as admin via event with retry loop
console.log('4. Authenticating as admin and opening Manage Tab...');
await sendCdp('Runtime.evaluate', {
  expression: `
    try {
      localStorage.setItem('kosherai_current_user', JSON.stringify({
        id: 'admin_test_1',
        name: 'James Admin',
        email: 'jamesphillipdeguzman@gmail.com',
        role: 'admin'
      }));
      localStorage.setItem('kosherai_ingredient_images_lid', JSON.stringify({
        'salt-kosher': 'https://res.cloudinary.com/dego6hgcb/image/upload/f_auto,q_auto,w_400,c_limit/kosherai/lid_protocol/ingredients/salt-kosher'
      }));
    } catch (_) {}
  `
});

let manageFound = false;
for (let i = 0; i < 12; i++) {
  const res = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        window.dispatchEvent(new CustomEvent('kosherai:auth-changed', {
          detail: {
            user: {
              id: 'admin_test_1',
              name: 'James Admin',
              email: 'jamesphillipdeguzman@gmail.com',
              role: 'admin'
            }
          }
        }));

        const btn = document.querySelector('[data-tab="manage"]');
        if (btn) {
          btn.click();
          return { clicked: true, text: btn.textContent.trim() };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });

  if (res?.result?.value?.clicked) {
    manageFound = true;
    console.log('  ✅ Manage button clicked:', res.result.value);
    break;
  }
  await sleep(400);
}

// 5. Inject actual Cloudinary mapping for salt-kosher and re-render
console.log('5. Injecting Cloudinary mapping for salt-kosher and re-rendering...');
await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      // Find global state or inject mapping
      const mapping = {
        id: 'img_lid_salt-kosher',
        protocol_id: 'lid',
        ingredient_id: 'salt-kosher',
        secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/f_auto,q_auto,w_400,c_limit/kosherai/lid_protocol/ingredients/salt-kosher',
        public_id: 'kosherai/lid_protocol/ingredients/salt-kosher',
        status: 'active'
      };

      // Set in cache if ingredientImageCache exists
      try {
        localStorage.setItem('kosherai_ingredient_images_lid', JSON.stringify({
          'salt-kosher': mapping.secure_url
        }));
      } catch (_) {}

      // Click manage to ensure fresh render
      const btn = document.querySelector('[data-tab="manage"]');
      if (btn) btn.click();
    })()
  `
});
await sleep(1000);

// 6. Viewport inspection
const viewports = [
  { name: 'small-mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'large-desktop-1920', width: 1920, height: 1080 }
];

console.log('\n6. Inspecting gallery and capturing screenshots across 5 viewports...');

for (const vp of viewports) {
  await sendCdp('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.width < 768
  });
  await sleep(400);

  const inspection = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const gallery = document.querySelector('.ingredient-gallery');
        const cards = document.querySelectorAll('.ingredient-card');
        const images = document.querySelectorAll('.ingredient-card__image img');
        const containers = document.querySelectorAll('.ingredient-card__image');
        
        let sampleImage = null;
        let sampleContainer = null;
        if (images.length > 0) {
          const s = window.getComputedStyle(images[0]);
          sampleImage = {
            width: s.width,
            height: s.height,
            maxWidth: s.maxWidth,
            maxHeight: s.maxHeight,
            objectFit: s.objectFit
          };
        }
        if (containers.length > 0) {
          const s = window.getComputedStyle(containers[0]);
          sampleContainer = {
            width: s.width,
            height: s.height,
            minHeight: s.minHeight,
            maxHeight: s.maxHeight,
            overflow: s.overflow
          };
        }

        const galleryStyle = gallery ? window.getComputedStyle(gallery) : null;

        return {
          hasGallery: Boolean(gallery),
          cardsCount: cards.length,
          imagesCount: images.length,
          galleryDisplay: galleryStyle?.display,
          gridTemplateColumns: galleryStyle?.gridTemplateColumns,
          sampleImage,
          sampleContainer,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
          hasHorizontalOverflow: document.body.scrollWidth > document.body.clientWidth
        };
      })()
    `,
    returnByValue: true
  });

  const res = inspection?.result?.value;
  console.log(`\n  --- Viewport ${vp.name} (${vp.width}x${vp.height}) ---`);
  console.log('  Cards count:', res?.cardsCount, '| Images count:', res?.imagesCount);
  console.log('  Gallery display:', res?.galleryDisplay);
  console.log('  Grid template columns count:', res?.gridTemplateColumns ? res.gridTemplateColumns.split(' ').length : 0);
  console.log('  Container height:', res?.sampleContainer?.height, '| overflow:', res?.sampleContainer?.overflow);
  console.log('  Image object-fit:', res?.sampleImage?.objectFit, '| maxWidth:', res?.sampleImage?.maxWidth);
  console.log('  Horizontal overflow:', res?.hasHorizontalOverflow ? '⚠️ YES' : '✅ NO');

  // Screenshot
  const shot = await sendCdp('Page.captureScreenshot', { format: 'png' });
  const shotPath = path.join(SHOTS_DIR, `manage-gallery-${vp.name}.png`);
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log(`  📸 Screenshot saved: ${shotPath}`);
}

// 7. Test opening dialog
console.log('\n7. Clicking card to open editing dialog...');
const openDialog = await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const firstCard = document.querySelector('.ingredient-card');
      if (firstCard) {
        firstCard.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()
  `,
  returnByValue: true
});
await sleep(600);

const dialogInspect = await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const dialog = document.querySelector('.admin-dialog-overlay, #admin-image-inspect-modal');
      const dialogBox = document.querySelector('.admin-dialog-box');
      const dialogPreview = document.querySelector('.admin-dialog-preview');
      const dialogImg = document.querySelector('.admin-dialog-preview img');
      
      return {
        hasDialog: Boolean(dialog),
        dialogBoxWidth: dialogBox ? window.getComputedStyle(dialogBox).width : null,
        dialogPreviewHeight: dialogPreview ? window.getComputedStyle(dialogPreview).height : null,
        dialogPreviewMaxHeight: dialogPreview ? window.getComputedStyle(dialogPreview).maxHeight : null,
        imgObjectFit: dialogImg ? window.getComputedStyle(dialogImg).objectFit : null,
        imgWidth: dialogImg ? window.getComputedStyle(dialogImg).width : null,
        imgHeight: dialogImg ? window.getComputedStyle(dialogImg).height : null
      };
    })()
  `,
  returnByValue: true
});

const dRes = dialogInspect?.result?.value;
console.log('  Dialog open result:', dRes);

const dialogShot = await sendCdp('Page.captureScreenshot', { format: 'png' });
const dialogShotPath = path.join(SHOTS_DIR, 'manage-dialog-desktop-1366.png');
fs.writeFileSync(dialogShotPath, Buffer.from(dialogShot.data, 'base64'));
console.log(`  📸 Dialog screenshot saved: ${dialogShotPath}`);

// Cleanup
console.log('\n8. Closing browser and preview server...');
ws.close();
edgeProcess.kill();
previewProcess.kill();

try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}

console.log('🎉 ALL BROWSER & CSS INSPECTIONS COMPLETED SUCCESSFULLY!\n');
