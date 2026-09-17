const { app, BrowserWindow, ipcMain, safeStorage, shell, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const WindowsDesktop = require('./lib/windows-desktop');

let mainWindow;
let desktop;

const DEFAULT_SETTINGS = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4.1-mini',
  useAi: false,
  localFallback: true,
  iconSize: null,
  encryptedApiKey: ''
};

const ICON_SIZE_MIN = 32;
const ICON_SIZE_MAX = 96;

function normalizeIconSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 48;
  return Math.min(ICON_SIZE_MAX, Math.max(ICON_SIZE_MIN, Math.round(parsed)));
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function historyPath() {
  return path.join(app.getPath('userData'), 'layout-history.json');
}

function categoryOverridesPath() {
  return path.join(app.getPath('userData'), 'category-overrides.json');
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function readSettings() {
  const saved = await readJson(settingsPath(), {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    iconSize: saved.iconSize == null ? null : normalizeIconSize(saved.iconSize)
  };
}

function decryptApiKey(settings) {
  if (!settings.encryptedApiKey) return '';
  try {
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(Buffer.from(settings.encryptedApiKey, 'base64'));
  } catch {
    return '';
  }
}

function publicSettings(settings) {
  const { encryptedApiKey, ...visible } = settings;
  return { ...visible, hasApiKey: Boolean(encryptedApiKey) };
}

async function saveSettings(input) {
  const current = await readSettings();
  const next = {
    ...current,
    endpoint: String(input.endpoint || '').trim(),
    model: String(input.model || '').trim(),
    useAi: Boolean(input.useAi),
    localFallback: input.localFallback !== false
  };

  if (input.clearApiKey) {
    next.encryptedApiKey = '';
  } else if (input.apiKey) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('当前系统无法使用 Windows 安全存储。');
    }
    next.encryptedApiKey = safeStorage.encryptString(String(input.apiKey)).toString('base64');
  }

  await writeJson(settingsPath(), next);
  return publicSettings(next);
}

async function saveIconSize(iconSize) {
  const settings = await readSettings();
  settings.iconSize = normalizeIconSize(iconSize);
  await writeJson(settingsPath(), settings);
  return { iconSize: settings.iconSize };
}

function getDisplayInfo() {
  const display = mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const scaleFactor = Number(display.scaleFactor) || 1;
  return {
    id: String(display.id),
    label: display.label || '当前显示器',
    width: Math.round(display.size.width * scaleFactor),
    height: Math.round(display.size.height * scaleFactor),
    workAreaWidth: Math.round(display.workAreaSize.width * scaleFactor),
    workAreaHeight: Math.round(display.workAreaSize.height * scaleFactor),
    scaleFactor
  };
}

function normalizeEndpoint(endpoint) {
  const clean = endpoint.trim().replace(/\/+$/, '');
  if (!clean) throw new Error('请填写 API 请求地址。');
  if (/\/chat\/completions$/i.test(clean)) return clean;
  if (/\/v1$/i.test(clean)) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
}

async function requestChat(settings, apiKey, messages, maxTokens = 500) {
  const response = await fetch(normalizeEndpoint(settings.endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' }
    }),
    signal: AbortSignal.timeout(20000)
  });

  const raw = await response.text();
  if (!response.ok) {
    let detail = raw;
    try {
      const parsed = JSON.parse(raw);
      detail = parsed.error?.message || raw;
    } catch {
      // Keep the provider response as-is.
    }
    throw new Error(`API ${response.status}: ${String(detail).slice(0, 220)}`);
  }
  const data = JSON.parse(raw);
  return data.choices?.[0]?.message?.content || '';
}

const CATEGORIES = [
  { id: 'system', label: '系统工具', color: '#64707c' },
  { id: 'creative', label: '设计与剪辑', color: '#db6c4c' },
  { id: 'three_d', label: '三维与引擎', color: '#9b6fb0' },
  { id: 'develop', label: '开发工具', color: '#2876c8' },
  { id: 'office', label: '日常办公', color: '#1e8a78' },
  { id: 'cloud', label: '网盘与下载', color: '#d59a31' },
  { id: 'game', label: '游戏与启动器', color: '#b94b5f' },
  { id: 'files', label: '文件与项目', color: '#728d44' }
];

const LEGACY_CATEGORY_ALIASES = {
  communicate: 'office',
  media: 'game'
};

const CATEGORY_RULES = [
  ['system', /windows security|control panel|recycle bin|this pc|computer|setting|explorer|security|驱动|控制面板|此电脑|回收站|系统/i],
  ['cloud', /迅雷|thunder|夸克网盘|百度网盘|阿里云盘|onedrive|dropbox|cloud drive|网盘|云盘/i],
  ['game', /steam|sakurafrp|三角洲行动|人渣|plain craft launcher|(?:^|\s)pcl(?:\s|$)|yy语音|雷神加速器|epic games|battle\.net|minecraft|游戏|加速器/i],
  ['three_d', /3ds max|maxon cinema|cinema 4d|blender|unreal engine|unity(?: hub|\s*20)|rizomuv|substance 3d|corona image editor|autocad|maya|houdini|zbrush|建模|渲染/i],
  ['creative', /after effects|photoshop|premiere|illustrator|figma|sketch|剪映|ev录屏|davinci|canva|视频剪辑|录屏|剪辑|平面设计/i],
  ['develop', /visual studio|visual studio code|intellij|docker|vmware|arduino|anaconda|spyder|jupyter|微信开发者工具|draw\.io|github|git|postman|terminal|powershell|cmd(?:\.exe)?|python|node(?:\.js)?|idea|webstorm|pycharm|数据库|开发|终端/i],
  ['office', /豆包|codex|flclash|京东桌面版|qq音乐|腾讯会议|(?:^|\s)ima(?:\s|$)|cxhelper|wechat|微信|(?:^|\s)qq(?:\s|$)|语雀|word|excel|powerpoint|typora|office|outlook|wps|notion|obsidian|xmind|calendar|todo|teams|slack|zoom|dingtalk|钉钉|飞书|meeting|mail|邮箱|会议|文档|表格|演示|笔记|日历/i],
  ['files', /文件|文件夹|project|workspace|项目|资料/i]
];

const CATEGORY_GUIDE = {
  system: 'Windows 系统入口和维护工具。示例：此电脑、回收站、控制面板。',
  creative: '平面设计、视频剪辑和录屏。示例：After Effects、Photoshop、剪映、EV录屏。',
  three_d: '三维建模、渲染、CAD 和游戏引擎。示例：Blender、3ds Max、Cinema 4D、RizomUV、Substance、Corona、AutoCAD、Unity、Unreal。',
  develop: '编程、虚拟化和开发辅助工具。示例：Visual Studio、VS Code、IntelliJ IDEA、Docker、VMware、Arduino、Anaconda、Spyder、Jupyter、微信开发者工具、draw.io。',
  office: '日常高频应用、AI 助手、沟通和文档办公。示例：豆包、Codex、FlClash、京东桌面版、QQ音乐、腾讯会议、ima、CxHelper、微信、QQ、语雀、Word、Excel、PowerPoint、Typora。',
  cloud: '下载器与网盘客户端。示例：迅雷、夸克网盘、百度网盘、阿里云盘。',
  game: '游戏、服务器启动器和游戏加速工具。示例：Steam、SakuraFrp、三角洲行动、人渣、Plain Craft Launcher、YY语音、雷神加速器。',
  files: '文件夹、项目目录、非快捷方式文件，以及名称带 .bat、.cmd、.ps1 的脚本快捷方式。示例：TCU、Study、competition、三维实习、3Dwork、QQ音乐自动暂停.bat。'
};

function normalizeCategoryId(categoryId) {
  return LEGACY_CATEGORY_ALIASES[categoryId] || categoryId;
}

function localClassify(items) {
  return items.map((item) => {
    if (item.type === 'folder' || item.type === 'file') return { ...item, category: 'files' };
    if (item.type === 'system') return { ...item, category: 'system' };
    if (/\.(?:bat|cmd|ps1)(?:\s|$)/i.test(`${item.name || ''} ${item.fileName || ''}`)) return { ...item, category: 'files' };
    const haystack = `${item.name || ''} ${item.fileName || ''} ${item.targetPath || ''}`;
    const category = CATEGORY_RULES.find(([, rule]) => rule.test(haystack))?.[0] || 'files';
    return { ...item, category };
  });
}

function parseClassification(content, items) {
  const fenced = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(fenced);
  const assignments = parsed.assignments || parsed;
  const allowed = new Set(CATEGORIES.map((category) => category.id));
  return items.map((item) => ({
    ...item,
    category: allowed.has(normalizeCategoryId(assignments[item.name])) ? normalizeCategoryId(assignments[item.name]) : 'files'
  }));
}

async function readCategoryOverrides() {
  const saved = await readJson(categoryOverridesPath(), {});
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

function applyCategoryOverrides(items, overrides) {
  const allowed = new Set(CATEGORIES.map((category) => category.id));
  let manualOverrideCount = 0;
  const applied = items.map((item) => {
    const category = normalizeCategoryId(overrides[item.id]);
    const manualCategory = allowed.has(category);
    if (manualCategory) manualOverrideCount += 1;
    return {
      ...item,
      category: manualCategory ? category : item.category,
      manualCategory
    };
  });
  return { items: applied, manualOverrideCount };
}

async function setCategoryOverride(itemId, categoryId) {
  const allowed = new Set(CATEGORIES.map((category) => category.id));
  if (!itemId || typeof itemId !== 'string' || itemId.length > 2048) throw new Error('桌面项目标识无效。');
  if (!allowed.has(categoryId)) throw new Error('分类标识无效。');
  const overrides = await readCategoryOverrides();
  overrides[itemId] = categoryId;
  await writeJson(categoryOverridesPath(), overrides);
  return { ok: true, manualOverrideCount: Object.keys(overrides).length };
}

async function resetCategoryOverrides() {
  await writeJson(categoryOverridesPath(), {});
  return { ok: true, manualOverrideCount: 0 };
}

async function classifyItems(items) {
  const [settings, overrides] = await Promise.all([readSettings(), readCategoryOverrides()]);
  const locallyClassified = localClassify(items);
  const finalize = (classifiedItems, source, warning) => ({
    ...applyCategoryOverrides(classifiedItems, overrides),
    source,
    warning
  });
  if (!settings.useAi) return finalize(locallyClassified, 'local');

  const apiKey = decryptApiKey(settings);
  if (!apiKey) {
    if (settings.localFallback) return finalize(locallyClassified, 'local', '未配置 API Key，已使用本地规则。');
    throw new Error('AI 分类已启用，但尚未配置 API Key。');
  }

  const localSuggestionById = new Map(locallyClassified.map((item) => [item.id, item.category]));
  const classificationInput = items.map((item) => ({
    name: item.name,
    type: item.type,
    localSuggestion: localSuggestionById.get(item.id) || 'files'
  }));
  const categoryList = CATEGORIES.map((item) => `${item.id}=${item.label}`).join(', ');
  const categoryGuide = CATEGORIES.map((item) => `${item.id}: ${CATEGORY_GUIDE[item.id]}`).join('\n');
  const manualExamples = items
    .filter((item) => overrides[item.id])
    .map((item) => `${item.name}=${normalizeCategoryId(overrides[item.id])}`)
    .join(', ');
  const messages = [
    {
      role: 'system',
      content: `你是个人 Windows 桌面分类器。只能从以下类别中选择：${categoryList}。

分类边界：
${categoryGuide}

必须遵循以下偏好：
1. 优先采用用户已有的手动分类示例；这些示例高于通用知识。${manualExamples ? ` 当前示例：${manualExamples}。` : ''}
2. 文件夹、非快捷方式文件，以及名称带 .bat、.cmd、.ps1 的脚本快捷方式归入 files，即使名称中含有开发、3D、音乐或游戏词语。
3. 不要只按厂商分类：After Effects、Photoshop 属于 creative；Substance 3D 属于 three_d。
4. Codex、豆包、ima 等日常 AI 助手归入 office；微信开发者工具归入 develop。
5. localSuggestion 是按用户偏好生成的本地建议。没有充分理由时保持该建议。

返回 JSON 对象，格式为 {"assignments":{"原始名称":"category_id"}}。必须逐字保留全部原始名称，不得遗漏、改名或添加项目。`
    },
    { role: 'user', content: JSON.stringify(classificationInput) }
  ];

  try {
    const content = await requestChat(settings, apiKey, messages, 900);
    return finalize(parseClassification(content, items), 'ai');
  } catch (error) {
    if (settings.localFallback) {
      return finalize(locallyClassified, 'local', `AI 分类失败，已使用本地规则：${error.message}`);
    }
    throw error;
  }
}

async function loadHistory() {
  const history = await readJson(historyPath(), []);
  return Array.isArray(history) ? history.slice(-3) : [];
}

async function pushHistory(snapshot) {
  const history = await loadHistory();
  history.push({
    capturedAt: new Date().toISOString(),
    items: snapshot.items || [],
    bounds: snapshot.bounds,
    iconSize: snapshot.iconSize
  });
  await writeJson(historyPath(), history.slice(-3));
  return Math.min(history.length, 3);
}

async function getOverview() {
  const [snapshot, settings, history] = await Promise.all([
    desktop.getDesktopSnapshot(),
    readSettings(),
    loadHistory()
  ]);
  const classified = await classifyItems(snapshot.items);
  return {
    items: classified.items,
    classificationSource: classified.source,
    manualOverrideCount: classified.manualOverrideCount,
    warning: classified.warning,
    categories: CATEGORIES,
    settings: publicSettings(settings),
    historyCount: history.length,
    desktopAvailable: snapshot.desktopAvailable,
    bounds: snapshot.bounds,
    display: getDisplayInfo(),
    currentIconSize: snapshot.iconSize
  };
}

function installIpcHandlers() {
  ipcMain.handle('app:overview', getOverview);
  ipcMain.handle('desktop:refresh', getOverview);
  ipcMain.handle('apps:scan', () => desktop.scanInstalledApps());
  ipcMain.handle('shortcut:add', async (_event, item) => desktop.addShortcut(item));
  ipcMain.handle('desktop:remove', async (_event, itemPath) => desktop.removeDesktopItem(itemPath));
  ipcMain.handle('desktop:classify', async (_event, items) => classifyItems(items));
  ipcMain.handle('classification:set-override', async (_event, input) => setCategoryOverride(input?.itemId, input?.categoryId));
  ipcMain.handle('classification:reset-overrides', resetCategoryOverrides);
  ipcMain.handle('display:get-current', getDisplayInfo);
  ipcMain.handle('layout:set-icon-size', async (_event, iconSize) => saveIconSize(iconSize));
  ipcMain.handle('settings:get', async () => publicSettings(await readSettings()));
  ipcMain.handle('settings:save', async (_event, settings) => saveSettings(settings));
  ipcMain.handle('settings:test', async (_event, input) => {
    const current = await readSettings();
    const settings = { ...current, ...input };
    const apiKey = input.apiKey || decryptApiKey(current);
    if (!apiKey) throw new Error('请填写 API Key。');
    const content = await requestChat(settings, apiKey, [
      { role: 'system', content: '返回 JSON：{"status":"ok"}' },
      { role: 'user', content: '测试连接' }
    ], 30);
    return { ok: true, response: content.slice(0, 120) };
  });
  ipcMain.handle('layout:arrange', async (_event, payload) => {
    const windowBounds = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null;
    const wasMaximized = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized());
    const wasFullScreen = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen());
    const display = getDisplayInfo();
    const before = await desktop.captureLayout();
    if (!before.items?.length) throw new Error('未能读取桌面图标，请确认 Windows Explorer 正在运行。');
    const historyCount = await pushHistory(before);
    try {
      const result = await desktop.arrangeLayout({
        ...payload,
        iconSize: normalizeIconSize(payload?.iconSize)
      });
      await saveIconSize(result.iconSize);
      return { ...result, historyCount, display };
    } catch (error) {
      const history = await loadHistory();
      history.pop();
      await writeJson(historyPath(), history);
      throw error;
    } finally {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (wasFullScreen && !mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
        else if (wasMaximized && !mainWindow.isMaximized()) mainWindow.maximize();
        else if (!wasFullScreen && !wasMaximized && windowBounds) mainWindow.setBounds(windowBounds, false);
      }
    }
  });
  ipcMain.handle('layout:undo', async () => {
    const history = await loadHistory();
    if (!history.length) throw new Error('没有可撤销的桌面布局。');
    const snapshot = history.pop();
    const result = await desktop.restoreLayout(snapshot);
    await writeJson(historyPath(), history);
    return { ...result, historyCount: history.length };
  });
  ipcMain.handle('shell:open-external', async (_event, url) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('只允许打开 HTTP 链接。');
    await shell.openExternal(url);
    return true;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1060,
    minHeight: 700,
    show: false,
    backgroundColor: '#f3f4f1',
    title: '桌序',
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) event.preventDefault();
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  desktop = new WindowsDesktop({ app, shell, baseDir: __dirname });
  installIpcHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

process.on('uncaughtException', (error) => {
  console.error(error);
});
