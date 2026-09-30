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

test('desktop arrangement keeps snap-to-grid and category row boundaries', () => {
  const source = read('scripts/desktop-layout.ps1');
  const renderer = read('src/renderer.js');
  assert.match(source, /SetCurrentFolderFlags\(FWF_AUTOARRANGE \| FWF_SNAPTOGRID, FWF_SNAPTOGRID\)/);
  assert.doesNotMatch(source, /SetCurrentFolderFlags\(FWF_AUTOARRANGE \| FWF_SNAPTOGRID, 0\)/);
  assert.match(source, /GetGridOrigin\(current, gridX, true\)/);
  assert.match(source, /WaitForPositions\(ref listView/);
  assert.match(source, /int horizontalWidth = Math\.Max\(gridX, bounds\.width \/ 2\)/);
  assert.match(source, /int horizontalOriginY = 0/);
  assert.match(renderer, /horizontalLayoutGrid\(width, height\)\.columns/);
  assert.doesNotMatch(source, /const halfWidth =/);
  assert.match(source, /if \(size > 0 && column != 0\)/);
  assert.match(renderer, /if \(column !== 0\)/);
});

test('desktop icon size display follows Explorer current size', () => {
  const renderer = read('src/renderer.js');
  assert.match(renderer, /state\.currentIconSize \|\| result\.settings\?\.iconSize/);
  assert.match(renderer, /state\.currentIconSize \|\| overview\.settings\?\.iconSize/);
});

test('classification requests allow slow model responses without losing body timeout handling', () => {
  const source = read('main.js');
  assert.match(source, /const API_CLASSIFICATION_TIMEOUT_MS = 120_000/);
  assert.match(source, /raw = await response\.text\(\)/);
  assert.match(source, /requestChat\(settings, apiKey, messages, 900, API_CLASSIFICATION_TIMEOUT_MS\)/);
  assert.match(source, /requestChat\(settings, apiKey, \[/);
  assert.match(source, /30, API_TEST_TIMEOUT_MS/);
});

test('desktop view lookup does not depend on localized Explorer titles', () => {
  const source = read('scripts/desktop-layout.ps1');
  assert.match(source, /FindWindow\("Progman", null\)/);
  assert.match(source, /FindDescendant\(progman, "SHELLDLL_DefView"\)/);
  assert.match(source, /FindDescendant\(shellView, "SysListView32"\)/);
});

test('release workflow runs the quality gate before packaging', () => {
  const workflow = read('.github/workflows/release.yml');
  assert.match(workflow, /run: npm run check/);
});

test('default distribution build creates setup and portable executables', () => {
  const packageJson = JSON.parse(read('package.json'));
  const buildScript = read('scripts/build-installer.ps1');
  assert.match(packageJson.scripts.dist, /-Target all/);
  assert.match(packageJson.scripts['dist:setup'], /-Target nsis/);
  assert.match(packageJson.scripts['dist:portable'], /-Target portable/);
  assert.match(buildScript, /@\('nsis', 'portable'\)/);
});
