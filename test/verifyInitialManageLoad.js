import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 5176;
const DEBUG_PORT = 9227;
const SHOTS_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\3f5db5f2-96bc-4bf8-b28b-40540510cf0c\\shots';

fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('🧪 Starting Browser Verification: Initial Manage Tab Loading (No Click Required)...\n');

// 1. Start vite preview server
console.log('1. Starting Vite preview on port', PORT);
const previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore'
});
await sleep(2000);

// 2. Launch Headless Edge
const userDataDir = path.resolve('tmp_edge_profile_manage_test');
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
if (!pageTarget?.webSocketDebuggerUrl) {
  console.error('❌ Could not find Edge target');
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
console.log('  ✅ Connected to DevTools WebSocket');

await sendCdp('Page.enable');
await sendCdp('Runtime.enable');
await sendCdp('DOM.enable');

// 3. Navigate
console.log('2. Navigating to http://localhost:' + PORT);
await sendCdp('Page.navigate', { url: `http://localhost:${PORT}/` });
await sleep(2000);

// 4. Mock backend API response matching actual Neon database state (6 mapped photos)
console.log('3. Installing API interceptor returning actual Neon DB figures (6 mapped, 30 missing)...');
await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      window.__realNeonMappings = [
        { id: 'img_lid_fresh-chilies', protocol_id: 'lid', ingredient_id: 'fresh-chilies', public_id: 'kosherai/lid_protocol/ingredients/fresh-chilies', secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794295230/kosherai/lid_protocol/ingredients/fresh-chilies.webp', status: 'active' },
        { id: 'img_lid_fish-sauce-patis', protocol_id: 'lid', ingredient_id: 'fish-sauce-patis', public_id: 'kosherai/lid_protocol/ingredients/fish-sauce-patis', secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794295144/kosherai/lid_protocol/ingredients/fish-sauce-patis.webp', status: 'active' },
        { id: 'img_lid_salt-kosher', protocol_id: 'lid', ingredient_id: 'salt-kosher', public_id: 'kosherai/lid_protocol/ingredients/salt-kosher', secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp', status: 'active' },
        { id: 'img_lid_soy-sauce', protocol_id: 'lid', ingredient_id: 'soy-sauce', public_id: 'kosherai/lid_protocol/ingredients/soy-sauce', secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794294051/kosherai/lid_protocol/ingredients/soy-sauce.webp', status: 'active' },
        { id: 'img_lid_salt-sea', protocol_id: 'lid', ingredient_id: 'salt-sea', public_id: 'kosherai/lid_protocol/ingredients/salt-sea', secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794288367/kosherai/lid_protocol/ingredients/salt-sea.webp', status: 'active' },
        { id: 'img_lid_salt-iodized', protocol_id: 'lid', ingredient_id: 'salt-iodized', public_id: 'kosherai/lid_protocol/ingredients/salt-iodized', secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794232380/kosherai/lid_protocol/ingredients/salt-iodized.webp', status: 'active' }
      ];

      const origFetch = window.fetch;
      window.fetch = async (url, opts) => {
        const urlStr = typeof url === 'string' ? url : (url?.url || '');
        if (urlStr.includes('/api/auth/get-session')) {
          return new Response(JSON.stringify({
            user: {
              id: 'admin_test_1',
              name: 'James Admin',
              email: 'jamesphillipdeguzman@gmail.com',
              role: 'admin'
            },
            session: { token: 'mock-admin-token' }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr.includes('/api/admin/ingredient-images')) {
          return new Response(JSON.stringify({
            success: true,
            protocol: 'lid',
            stats: {
              totalIngredients: 36,
              withImage: 6,
              missingImage: 30,
              pendingReview: 0
            },
            mappings: window.__realNeonMappings
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return origFetch(url, opts);
      };
    })()
  `
});

// 5. Authenticate as Admin
console.log('4. Authenticating as administrator...');
await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      localStorage.setItem('kosherai_current_user', JSON.stringify({
        id: 'admin_test_1',
        name: 'James Admin',
        email: 'jamesphillipdeguzman@gmail.com',
        role: 'admin'
      }));
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
    })()
  `
});
await sleep(500);

// ============================================================================
// SCENARIO A: First Manage tab activation (WITHOUT clicking any ingredient)
// ============================================================================
console.log('\n--- Scenario A: First Manage tab activation (NO ingredient click) ---');
await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const btn = document.querySelector('[data-tab="manage"]');
      if (btn) btn.click();
    })()
  `
});
await sleep(1000); // Allow fetch and render to complete

const scenarioA = await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const cards = document.querySelectorAll('.ingredient-card');
      const images = document.querySelectorAll('.ingredient-card__image img');
      const dialog = document.querySelector('.admin-dialog-overlay');
      const statsGrid = document.querySelector('.admin-stats-grid');
      const statsText = statsGrid ? statsGrid.textContent.replace(/\\s+/g, ' ') : '';

      return {
        hasGallery: Boolean(document.querySelector('.ingredient-gallery')),
        totalCards: cards.length,
        mappedPhotosCount: images.length,
        hasOpenDialog: Boolean(dialog),
        statsText,
        // Check mapped images src
        mappedSrcs: Array.from(images).map(img => img.src)
      };
    })()
  `,
  returnByValue: true
});

const resA = scenarioA.result.value;
console.log('  Gallery present:', resA.hasGallery);
console.log('  Total cards rendered:', resA.totalCards);
console.log('  Mapped photos automatically loaded:', resA.mappedPhotosCount);
console.log('  Is inspection dialog open?', resA.hasOpenDialog ? 'YES (Error)' : 'NO (Correct!)');
console.log('  Stats Bar Text:', resA.statsText);

// Verify Scenario A requirements
if (resA.mappedPhotosCount !== 6) {
  console.error(`❌ Expected 6 mapped photos, got ${resA.mappedPhotosCount}`);
  process.exit(1);
}
if (resA.hasOpenDialog) {
  console.error('❌ Inspection dialog should NOT be open on initial load!');
  process.exit(1);
}
console.log('  ✅ Scenario A Passed: All 6 photos rendered immediately without clicking any ingredient!');

// Save screenshot of initial first load
const shotA = await sendCdp('Page.captureScreenshot', { format: 'png' });
const shotAPath = path.join(SHOTS_DIR, 'manage-initial-load-first-click.png');
fs.writeFileSync(shotAPath, Buffer.from(shotA.data, 'base64'));
console.log(`  📸 Screenshot saved: ${shotAPath}`);

// ============================================================================
// SCENARIO B: Repeat navigation (Navigate away and return)
// ============================================================================
console.log('\n--- Scenario B: Repeat navigation (Away to Checker and back to Manage) ---');
await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const checkerBtn = document.querySelector('[data-tab="checker"]');
      if (checkerBtn) checkerBtn.click();
    })()
  `
});
await sleep(400);

await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const manageBtn = document.querySelector('[data-tab="manage"]');
      if (manageBtn) manageBtn.click();
    })()
  `
});
await sleep(500);

const scenarioB = await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const images = document.querySelectorAll('.ingredient-card__image img');
      const statsGrid = document.querySelector('.admin-stats-grid');
      return {
        mappedPhotosCount: images.length,
        statsText: statsGrid ? statsGrid.textContent.replace(/\\s+/g, ' ') : ''
      };
    })()
  `,
  returnByValue: true
});

const resB = scenarioB.result.value;
console.log('  Mapped photos count on return:', resB.mappedPhotosCount);
console.log('  Stats on return:', resB.statsText);
if (resB.mappedPhotosCount !== 6) {
  console.error(`❌ Expected 6 mapped photos on repeat navigation, got ${resB.mappedPhotosCount}`);
  process.exit(1);
}
console.log('  ✅ Scenario B Passed: Cached data renders immediately on repeat navigation!');

// ============================================================================
// SCENARIO C: Course Mode Manage Navigation
// ============================================================================
console.log('\n--- Scenario C: Mode Switch to 6-Week Course & Manage Subnav ---');
await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const courseBtn = document.querySelector('.mode-tab-btn[data-app-mode="course"]');
      if (courseBtn) courseBtn.click();
    })()
  `
});
await sleep(500);

await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const manageSubnav = document.querySelector('.nav-tab-btn[data-tab="manage"]');
      if (manageSubnav) manageSubnav.click();
    })()
  `
});
await sleep(600);

const scenarioC = await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const images = document.querySelectorAll('.ingredient-card__image img');
      return {
        hasGallery: Boolean(document.querySelector('.ingredient-gallery')),
        mappedPhotosCount: images.length
      };
    })()
  `,
  returnByValue: true
});

const resC = scenarioC.result.value;
console.log('  Course mode gallery present:', resC.hasGallery);
console.log('  Course mode mapped photos count:', resC.mappedPhotosCount);
if (resC.mappedPhotosCount !== 6) {
  console.error(`❌ Expected 6 mapped photos in course mode Manage, got ${resC.mappedPhotosCount}`);
  process.exit(1);
}
console.log('  ✅ Scenario C Passed: 6-Week Project mode Manage navigation works cleanly!');

// ============================================================================
// SCENARIO D: Non-blocking Error Handling
// ============================================================================
console.log('\n--- Scenario D: API failure maintains valid cached mappings ---');
await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      // Cause API to fail
      window.fetch = async (url) => {
        if (typeof url === 'string' && url.includes('/api/admin/ingredient-images')) {
          return new Response(JSON.stringify({ error: 'DATABASE_TIMEOUT', message: 'Simulated network timeout' }), { status: 500 });
        }
        return new Response('{}');
      };

      // Trigger re-fetch for protocol
      const manageBtn = document.querySelector('[data-tab="manage"]');
      if (manageBtn) manageBtn.click();
    })()
  `
});
await sleep(600);

const scenarioD = await sendCdp('Runtime.evaluate', {
  expression: `
    (() => {
      const images = document.querySelectorAll('.ingredient-card__image img');
      return {
        mappedPhotosCount: images.length
      };
    })()
  `,
  returnByValue: true
});

console.log('  Mapped photos retained during simulated outage:', scenarioD.result.value.mappedPhotosCount);
if (scenarioD.result.value.mappedPhotosCount !== 6) {
  console.error(`❌ Cached mappings should have been retained! Got ${scenarioD.result.value.mappedPhotosCount}`);
  process.exit(1);
}
console.log('  ✅ Scenario D Passed: Cached images preserved during simulated backend outage!');

// Cleanup
console.log('\n5. Cleaning up processes...');
ws.close();
edgeProcess.kill();
previewProcess.kill();

try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}

console.log('\n======================================================================');
console.log('🎉 ALL BROWSER SCENARIOS (A THROUGH D) PASSED WITH FLYING COLORS!');
console.log('======================================================================\n');
