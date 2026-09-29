const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('main process protects the application instance and JSON persistence', () => {
  const source = read('main.js');
  assert.match(source, /requestSingleInstanceLock\(\)/);
  assert.match(source, /second-instance/);
  assert.match(source, /handle\.sync\(\)/);
  assert.match(source, /fs\.rename\(temporaryPath, filePath\)/);
  assert.match(source, /enqueueSettingsOperation/);
  assert.match(source, /return enqueueSettingsOperation\(async \(\) =>/);
});

test('application library keeps stable identities', () => {
  const source = read('lib/windows-desktop.js');
  const renderer = read('src/renderer.js');
  assert.match(source, /identity: `appx:/);
  assert.match(source, /identity: shortcut\.target/);
  assert.doesNotMatch(source, /const key = item\.name\.trim\(\)\.toLocaleLowerCase/);
  assert.match(renderer, /function applicationIdentity\(item\)/);
  assert.match(renderer, /desktopIdentities/);
});

test('layout operations have capacity and stable-index guards', () => {
  const source = read('scripts/desktop-layout.ps1');
  const main = read('main.js');
  assert.match(source, /shellIndices/);
  assert.match(source, /TakeByIndex/);
  assert.match(source, /totalCapacity/);
  assert.match(main, /enqueueDesktopOperation/);
  assert.match(main, /validateArrangePayload/);
});

test('release workflow runs the quality gate before packaging', () => {
  const workflow = read('.github/workflows/release.yml');
  assert.match(workflow, /run: npm run check/);
});
