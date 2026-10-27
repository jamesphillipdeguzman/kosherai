import assert from 'node:assert';
import { searchDatabase } from '../src/services/ruleEngine.js';
import { renderCheckerTab } from '../src/components/CheckerTab.js';
import { LID_DATABASE, STATUS, getItemStatus } from '../src/data/lidDatabase.js';
import { filterFoods } from '../src/utils/searchUtils.js';

console.log('🧪 Starting Search Tab & Quick Lookup Filtering Tests...\n');

// 1. Test "Banana Ketchup" specific query issue
console.log('Test 1: Verify "Banana Ketchup" search returns only Banana Ketchup, not all 36 items');
const bananaResults = searchDatabase('Banana Ketchup', 'ALL', 'ALL', 'lid');
assert.strictEqual(bananaResults.length, 1, `Expected 1 item for Banana Ketchup, got ${bananaResults.length}`);
assert.strictEqual(bananaResults[0].id, 'banana-ketchup', 'Result must be banana-ketchup');
assert.ok(bananaResults[0].name.includes('Banana Ketchup'), 'Result name must contain Banana Ketchup');

// Check that other items like kosher salt or iodized salt are excluded
const bananaNames = bananaResults.map(r => r.name.toLowerCase());
assert.ok(!bananaNames.includes('kosher salt'), 'Must not include Kosher Salt');
assert.ok(!bananaNames.includes('iodized table salt'), 'Must not include Iodized Table Salt');

// 2. Test renderCheckerTab output when searching "Banana Ketchup"
console.log('Test 2: Verify renderCheckerTab shows "All Items (1)" and renders the Banana Ketchup card');
const bananaHtml = renderCheckerTab({
  searchQuery: 'Banana Ketchup',
  statusFilter: 'ALL',
  categoryFilter: 'ALL',
  searchResults: bananaResults,
  activeDiet: 'lid'
});

assert.ok(bananaHtml.includes('All Items (1)'), 'Must render "All Items (1)"');
assert.ok(!bananaHtml.includes('All Items (36)'), 'Must NOT render "All Items (36)"');
assert.ok(bananaHtml.includes('data-item-id="banana-ketchup"'), 'Must render Banana Ketchup card');
assert.ok(!bananaHtml.includes('data-item-id="pure-kosher-salt"'), 'Must NOT render Kosher Salt card');
assert.ok(!bananaHtml.includes('data-item-id="iodized-table-salt"'), 'Must NOT render Iodized Salt card');

// 3. Test Quick Lookup Tags & Stricter Field Prioritization
console.log('Test 3: Verify all primary Quick Lookup pills filter accurately with strict field prioritization');

// Specific test for "Sayote": searching "sayote" must return ONLY Sayote, and NOT Mung Beans or Potatoes whose swaps mention sayote
const sayoteResults = searchDatabase('Sayote', 'ALL', 'ALL', 'lid');
assert.strictEqual(sayoteResults.length, 1, `Searching "Sayote" must return exactly 1 item, got ${sayoteResults.length}`);
assert.strictEqual(sayoteResults[0].id, 'sayote-chayote', 'Sayote search result must be sayote-chayote');
assert.ok(!sayoteResults.some(r => r.id === 'mung-beans'), 'Must NOT return Mung Beans when searching Sayote');
assert.ok(!sayoteResults.some(r => r.id === 'potatoes'), 'Must NOT return Potatoes when searching Sayote');
assert.ok(!sayoteResults.some(r => r.id === 'cruciferous-greens'), 'Must NOT return Cruciferous Greens when searching Sayote');

// Test standalone filterFoods function
const filteredSayote = filterFoods(LID_DATABASE, 'sayote', 'all', 'all', 'lid');
assert.strictEqual(filteredSayote.length, 1, `filterFoods must return exactly 1 item for sayote, got ${filteredSayote.length}`);
assert.strictEqual(filteredSayote[0].id, 'sayote-chayote');
assert.ok(!filteredSayote.some(r => r.id === 'mung-beans'));

const quickLookups = ['Sayote', 'Patis', 'Isaw', 'Munggo', 'Banana Ketchup'];

for (const pill of quickLookups) {
  const pillResults = searchDatabase(pill, 'ALL', 'ALL', 'lid');
  assert.ok(pillResults.length > 0, `Quick lookup "${pill}" must return matching items`);
  assert.ok(pillResults.length < LID_DATABASE.length, `Quick lookup "${pill}" must filter list (returned ${pillResults.length})`);

  // Verify top result directly matches the pill name or alias
  const topItem = pillResults[0];
  const matchesName = topItem.name.toLowerCase().includes(pill.toLowerCase());
  const matchesAlias = (topItem.aliases || []).some(a => a.toLowerCase().includes(pill.toLowerCase()));
  assert.ok(matchesName || matchesAlias, `Top result for "${pill}" (${topItem.name}) must be a direct match`);

  const pillHtml = renderCheckerTab({
    searchQuery: pill,
    statusFilter: 'ALL',
    categoryFilter: 'ALL',
    searchResults: pillResults,
    activeDiet: 'lid'
  });

  assert.ok(pillHtml.includes(`All Items (${pillResults.length})`), `Badge must reflect ${pillResults.length} items`);
}

// 4. Test Empty Search State
console.log('Test 4: Verify non-matching search shows proper empty message');
const nonExistentQuery = 'NonExistentPinoySnack12345';
const emptyResults = searchDatabase(nonExistentQuery, 'ALL', 'ALL', 'lid');
assert.strictEqual(emptyResults.length, 0, 'Non-existent item must return 0 results');

const emptyHtml = renderCheckerTab({
  searchQuery: nonExistentQuery,
  statusFilter: 'ALL',
  categoryFilter: 'ALL',
  searchResults: emptyResults,
  activeDiet: 'lid'
});

assert.ok(emptyHtml.includes(`No items match "${nonExistentQuery}" under the selected protocol.`), 
  'Must display exact protocol empty match message');
assert.ok(emptyHtml.includes('All Items (0)'), 'Badge must display "All Items (0)"');

// 5. Test Status & Category Filtering combined with Search Query
console.log('Test 5: Verify combined Search Query + Status Filter + Category Filter');
// Banana Ketchup in LID: status is AVOID (due to commercial iodized salt / red dye #3)
const bananaAvoid = searchDatabase('Banana Ketchup', STATUS.AVOID, 'ALL', 'lid');
assert.strictEqual(bananaAvoid.length, 1, 'Banana Ketchup is Avoid under LID');

const bananaSafe = searchDatabase('Banana Ketchup', STATUS.SAFE, 'ALL', 'lid');
assert.strictEqual(bananaSafe.length, 0, 'Banana Ketchup is not Safe under LID');

// 6. Test Multi-Diet Protocol Reactivity in Search
console.log('Test 6: Verify Banana Ketchup reacts across different diets (Avoid in Keto/Diabetic)');
const ketoBanana = searchDatabase('Banana Ketchup', 'ALL', 'ALL', 'pinoy_keto');
assert.strictEqual(ketoBanana.length, 1);
assert.strictEqual(getItemStatus(ketoBanana[0], 'pinoy_keto'), STATUS.AVOID, 'Banana Ketchup must be AVOID in Pinoy Keto');

const diabeticBanana = searchDatabase('Banana Ketchup', 'ALL', 'ALL', 'diabetic');
assert.strictEqual(diabeticBanana.length, 1);
assert.strictEqual(getItemStatus(diabeticBanana[0], 'diabetic'), STATUS.AVOID, 'Banana Ketchup must be AVOID in Diabetic');

console.log('\n✅ All Search Tab Filtering & Quick Lookup Tests Passed Successfully!');
