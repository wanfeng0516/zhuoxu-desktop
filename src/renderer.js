const api = window.zhuoxu;
const ICON_SIZE_MIN = 32;
const ICON_SIZE_MAX = 96;

const state = {
  view: 'organize',
  mode: 'left',
  desktop: [],
  installed: null,
  categories: [],
  historyCount: 0,
  manualOverrideCount: 0,
  desktopAvailable: false,
  bounds: { width: 1920, height: 1080 },
  display: { width: 1920, height: 1080, workAreaWidth: 1920, workAreaHeight: 1040, scaleFactor: 1 },
  iconSize: 48,
  currentIconSize: 48,
  settings: null,
  dragType: '',
  draggedItemId: '',
  draggedCategory: '',
  modalResolver: null
};

const elements = {};

function cacheElements() {
  const ids = [
    'desktopStateDot', 'desktopStateLabel', 'sourceBadge', 'refreshButton', 'desktopNotice',
    'desktopNoticeText', 'iconCount', 'categoryCount', 'desktopPreview', 'previewLoading',
    'categoryStrip', 'categoryOrder', 'iconSizeSlider', 'iconSizeValue', 'screenResolution',
    'screenScale', 'manualCountBadge', 'resetCategoriesButton',
    'arrangeButton', 'undoButton', 'undoLabel', 'historyNote',
    'rescanAppsButton', 'librarySearch', 'searchCount', 'desktopLibraryCount',
    'installedLibraryCount', 'desktopAppList', 'installedAppList', 'settingsForm', 'endpointInput',
    'modelInput', 'apiKeyInput', 'toggleKeyButton', 'useAiInput', 'fallbackInput', 'testApiButton',
    'connectionTitle', 'connectionDescription', 'keyState', 'fallbackState', 'modalBackdrop',
    'modalIcon', 'modalTitle', 'modalMessage', 'modalCancel', 'modalConfirm', 'toastRegion'
  ];
  ids.forEach((id) => { elements[id] = document.getElementById(id); });
}

function syncIcons(root = document) {
  if (window.lucide) {
    window.lucide.createIcons({ root, attrs: { 'stroke-width': 1.7 } });
  }
}

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconElement(name) {
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', name);
  return icon;
}

function normalizedName(value) {
  return String(value || '').trim().toLocaleLowerCase('zh-CN');
}

function normalizeIconSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 48;
  return Math.min(ICON_SIZE_MAX, Math.max(ICON_SIZE_MIN, Math.round(parsed)));
}

function previewMetrics() {
  const scale = Math.min(1.75, Math.max(0.72, state.iconSize / 48));
  const icon = Math.round(28 * scale);
  const itemWidth = Math.max(40, Math.round(48 * scale));
  const itemHeight = icon + Math.max(15, Math.round(17 * scale));
  return {
    icon,
    itemWidth,
    itemHeight,
    cellWidth: itemWidth + Math.max(1, Math.round(scale)),
    cellHeight: itemHeight + Math.max(1, Math.round(scale)),
    labelSize: Math.min(10, Math.max(7, Math.round(8 * Math.sqrt(scale))))
  };
}

function showToast(message, type = 'success') {
  const toast = makeElement('div', `toast${type === 'error' ? ' is-error' : ''}`);
  toast.append(iconElement(type === 'error' ? 'circle-alert' : 'circle-check'));
  toast.append(makeElement('span', '', message));
  elements.toastRegion.append(toast);
  syncIcons(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(10px)';
    window.setTimeout(() => toast.remove(), 220);
  }, 3600);
}

function errorMessage(error) {
  return error?.message || String(error) || '操作失败。';
}

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('is-busy', busy);
}

async function withBusy(button, work) {
  setBusy(button, true);
  try {
    return await work();
  } finally {
    setBusy(button, false);
  }
}

function openModal({ title, message, confirmText = '确认', cancelText = '取消', warning = false, info = false }) {
  if (state.modalResolver) state.modalResolver(false);
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modalConfirm.textContent = confirmText;
  elements.modalCancel.textContent = cancelText;
  elements.modalCancel.classList.toggle('is-hidden', info);
  elements.modalIcon.classList.toggle('is-warning', warning);
  elements.modalIcon.replaceChildren(iconElement(warning ? 'triangle-alert' : info ? 'info' : 'sparkles'));
  elements.modalBackdrop.classList.remove('is-hidden');
  syncIcons(elements.modalIcon);
  elements.modalConfirm.focus();
  return new Promise((resolve) => { state.modalResolver = resolve; });
}

function closeModal(result) {
  elements.modalBackdrop.classList.add('is-hidden');
  const resolve = state.modalResolver;
  state.modalResolver = null;
  if (resolve) resolve(result);
}

function setNotice(message) {
  elements.desktopNotice.classList.toggle('is-hidden', !message);
  elements.desktopNoticeText.textContent = message || '';
}

function updateDesktopState() {
  elements.desktopStateDot.classList.remove('is-online', 'is-offline');
  elements.desktopStateDot.classList.add(state.desktopAvailable ? 'is-online' : 'is-offline');
  elements.desktopStateLabel.textContent = state.desktopAvailable ? '服务已连接' : '服务不可用';
}

function categoryById(categoryId) {
  return state.categories.find((category) => category.id === categoryId) || state.categories.at(-1);
}

function groupedDesktop() {
  return state.categories.map((category) => ({
    ...category,
    items: state.desktop.filter((item) => item.category === category.id)
  }));
}

function renderSummary() {
  elements.iconCount.textContent = String(state.desktop.length);
  const activeCategories = new Set(state.desktop.map((item) => item.category));
  elements.categoryCount.textContent = String(activeCategories.size);
  const baseSource = state.classificationSource === 'ai' ? 'AI 分类' : '本地分类';
  const sourceText = state.manualOverrideCount ? `${baseSource} · 手动 ${state.manualOverrideCount}` : baseSource;
  const badgeIcon = state.manualOverrideCount ? 'hand' : state.classificationSource === 'ai' ? 'sparkles' : 'cpu';
  elements.sourceBadge.replaceChildren(iconElement(badgeIcon), makeElement('span', '', sourceText));
  syncIcons(elements.sourceBadge);
}

function appInitial(name) {
  return String(name || '?').trim().slice(0, 1).toLocaleUpperCase('zh-CN');
}

function buildPreviewIcon(item, color) {
  const metrics = previewMetrics();
  const node = makeElement('div', 'preview-item');
  const category = categoryById(item.category);
  node.title = `${item.name} · ${category?.label || '未分类'}${item.manualCategory ? ' · 手动调整' : ''}`;
  node.draggable = true;
  node.dataset.itemId = item.id;
  node.classList.toggle('is-manual', Boolean(item.manualCategory));
  node.style.setProperty('--preview-item-width', `${metrics.itemWidth}px`);
  node.style.setProperty('--preview-item-height', `${metrics.itemHeight}px`);
  node.style.setProperty('--preview-icon-size', `${metrics.icon}px`);
  node.style.setProperty('--preview-label-size', `${metrics.labelSize}px`);
  const icon = makeElement('div', 'preview-icon');
  icon.style.setProperty('--item-color', color);
  if (item.icon) {
    const image = document.createElement('img');
    image.src = item.icon;
    image.alt = '';
    image.draggable = false;
    image.addEventListener('error', () => {
      icon.replaceChildren(document.createTextNode(appInitial(item.name)));
    }, { once: true });
    icon.append(image);
  } else {
    icon.textContent = appInitial(item.name);
  }
  node.append(icon, makeElement('span', '', item.name));
  node.addEventListener('dragstart', (event) => {
    state.dragType = 'item';
    state.draggedItemId = item.id;
    state.draggedCategory = '';
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-zhuoxu-item', item.id);
    event.dataTransfer.setData('text/plain', item.name);
    node.classList.add('is-dragging');
    elements.desktopPreview.classList.add('is-dragging-item');
  });
  node.addEventListener('dragend', clearDragState);
  node.addEventListener('dragover', (event) => {
    const dragged = state.desktop.find((entry) => entry.id === state.draggedItemId);
    if (state.dragType !== 'item' || !dragged || dragged.id === item.id || dragged.category === item.category) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    node.classList.add('is-drop-target');
  });
  node.addEventListener('dragleave', () => node.classList.remove('is-drop-target'));
  node.addEventListener('drop', (event) => {
    if (state.dragType !== 'item') return;
    event.preventDefault();
    event.stopPropagation();
    const itemId = state.draggedItemId;
    clearDragState();
    reassignItem(itemId, item.category);
  });
  return node;
}

function previewPositions(groups, width, height) {
  const margin = 12;
  const { cellWidth, cellHeight } = previewMetrics();
  const positions = [];

  if (state.mode === 'left') {
    const rows = Math.max(1, Math.floor((height - margin * 2) / cellHeight));
    let index = 0;
    groups.forEach((group) => group.items.forEach((item) => {
      positions.push({ item, color: group.color, x: margin + Math.floor(index / rows) * cellWidth, y: margin + (index % rows) * cellHeight });
      index += 1;
    }));
    return positions;
  }

  const halfWidth = Math.max(cellWidth + margin * 2, width / 2);
  const columns = Math.max(1, Math.floor((halfWidth - margin * 2) / cellWidth));
  const maxRows = Math.max(1, Math.floor((height - margin * 2) / cellHeight));
  let side = 0;
  let row = 0;
  groups.forEach((group) => {
    if (!group.items.length) return;
    const neededRows = Math.max(1, Math.ceil(group.items.length / columns));
    if (side === 0 && row + neededRows > maxRows) {
      side = 1;
      row = 0;
    }
    group.items.forEach((item, index) => {
      const localRow = row + Math.floor(index / columns);
      positions.push({
        item,
        color: group.color,
        x: margin + side * halfWidth + (index % columns) * cellWidth,
        y: margin + localRow * cellHeight
      });
    });
    row += neededRows;
    if (side === 1 && row >= maxRows) row = 0;
  });
  return positions;
}

function renderPreview() {
  elements.previewLoading.classList.add('is-hidden');
  elements.desktopPreview.querySelectorAll('.preview-item, .preview-overflow').forEach((node) => node.remove());
  if (!state.desktop.length) {
    const empty = makeElement('div', 'preview-loading');
    empty.classList.add('preview-overflow-state');
    empty.append(iconElement('monitor-dot'), makeElement('span', '', '桌面暂时没有可排列的图标'));
    elements.desktopPreview.append(empty);
    syncIcons(empty);
    return;
  }

  elements.desktopPreview.querySelectorAll('.preview-overflow-state').forEach((node) => node.remove());
  const metrics = previewMetrics();
  const positions = previewPositions(groupedDesktop(), elements.desktopPreview.clientWidth, elements.desktopPreview.clientHeight);
  let visible = 0;
  positions.forEach((position, index) => {
    if (index >= 70 || position.y + metrics.itemHeight > elements.desktopPreview.clientHeight || position.x + metrics.itemWidth > elements.desktopPreview.clientWidth) return;
    const node = buildPreviewIcon(position.item, position.color);
    node.style.left = `${position.x}px`;
    node.style.top = `${position.y}px`;
    node.style.animationDelay = `${Math.min(index * 14, 250)}ms`;
    elements.desktopPreview.append(node);
    visible += 1;
  });
  if (visible < positions.length) {
    elements.desktopPreview.append(makeElement('span', 'preview-overflow', `+${positions.length - visible}`));
  }
}

function renderCategoryStrip() {
  elements.categoryStrip.replaceChildren();
  groupedDesktop().filter((group) => group.items.length).forEach((group) => {
    const chip = makeElement('span', 'category-chip');
    const key = document.createElement('i');
    key.style.setProperty('--chip-color', group.color);
    chip.append(key, makeElement('span', '', group.label), makeElement('strong', '', String(group.items.length)));
    elements.categoryStrip.append(chip);
  });
}

function moveCategory(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const from = state.categories.findIndex((item) => item.id === fromId);
  const to = state.categories.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return;
  const [moved] = state.categories.splice(from, 1);
  state.categories.splice(to, 0, moved);
  renderCategoryOrder();
  renderCategoryStrip();
  renderPreview();
}

function clearDragState() {
  document.querySelectorAll('.is-dragging, .is-drop-target').forEach((node) => node.classList.remove('is-dragging', 'is-drop-target'));
  elements.desktopPreview?.classList.remove('is-dragging-item');
  state.dragType = '';
  state.draggedItemId = '';
  state.draggedCategory = '';
}

function renderManualState() {
  const count = state.manualOverrideCount;
  elements.manualCountBadge.classList.toggle('is-hidden', count === 0);
  elements.manualCountBadge.querySelector('span').textContent = String(count);
  elements.resetCategoriesButton.disabled = count === 0;
}

function renderSizeControl() {
  const iconSize = normalizeIconSize(state.iconSize);
  state.iconSize = iconSize;
  elements.iconSizeSlider.value = String(iconSize);
  elements.iconSizeSlider.style.setProperty('--range-progress', `${((iconSize - ICON_SIZE_MIN) / (ICON_SIZE_MAX - ICON_SIZE_MIN)) * 100}%`);
  elements.iconSizeValue.textContent = `${iconSize} px`;

  const display = state.display || {};
  const width = Number(display.width) || Number(state.bounds.width) || 1920;
  const height = Number(display.height) || Number(state.bounds.height) || 1080;
  const workAreaWidth = Number(display.workAreaWidth) || width;
  const workAreaHeight = Number(display.workAreaHeight) || height;
  const scale = Math.round((Number(display.scaleFactor) || 1) * 100);
  elements.screenResolution.textContent = `${width} × ${height}`;
  elements.screenScale.textContent = `${scale}% 缩放`;
  elements.desktopPreview.style.aspectRatio = `${workAreaWidth} / ${workAreaHeight}`;
  elements.desktopPreview.style.setProperty('--desktop-grid', `${Math.max(24, Math.round(previewMetrics().cellWidth * 0.65))}px`);
}

async function reassignItem(itemId, categoryId) {
  const item = state.desktop.find((entry) => entry.id === itemId);
  const category = categoryById(categoryId);
  if (!item || !category || item.category === categoryId) return;
  const previousCategory = item.category;
  const previousManual = Boolean(item.manualCategory);
  item.category = categoryId;
  item.manualCategory = true;
  state.manualOverrideCount = state.desktop.filter((entry) => entry.manualCategory).length;
  renderOrganize();
  try {
    await api.setCategoryOverride(item.id, categoryId);
    showToast(`已将“${item.name}”调整到“${category.label}”。`);
  } catch (error) {
    item.category = previousCategory;
    item.manualCategory = previousManual;
    state.manualOverrideCount = state.desktop.filter((entry) => entry.manualCategory).length;
    renderOrganize();
    showToast(errorMessage(error), 'error');
  }
}

function renderCategoryOrder() {
  elements.categoryOrder.replaceChildren();
  const counts = new Map(groupedDesktop().map((group) => [group.id, group.items.length]));
  state.categories.forEach((category) => {
    const row = makeElement('div', 'order-row');
    row.draggable = true;
    row.dataset.categoryId = category.id;
    row.title = '调整分类顺序或接收桌面图标';
    const key = makeElement('i', 'color-key');
    key.style.setProperty('--row-color', category.color);
    row.append(iconElement('grip-vertical'), key, makeElement('span', '', category.label), makeElement('strong', '', String(counts.get(category.id) || 0)));
    row.addEventListener('dragstart', (event) => {
      state.dragType = 'category';
      state.draggedCategory = category.id;
      state.draggedItemId = '';
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-zhuoxu-category', category.id);
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', clearDragState);
    row.addEventListener('dragover', (event) => {
      if (state.dragType !== 'item' && state.dragType !== 'category') return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (state.dragType === 'item') row.classList.add('is-drop-target');
    });
    row.addEventListener('dragleave', (event) => {
      if (!row.contains(event.relatedTarget)) row.classList.remove('is-drop-target');
    });
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      const dragType = state.dragType;
      const itemId = state.draggedItemId;
      const categoryId = state.draggedCategory;
      clearDragState();
      if (dragType === 'item') reassignItem(itemId, category.id);
      else moveCategory(categoryId, category.id);
    });
    elements.categoryOrder.append(row);
  });
  syncIcons(elements.categoryOrder);
}

function renderHistory() {
  const count = state.historyCount;
  elements.undoButton.disabled = count === 0 || !state.desktopAvailable;
  elements.undoLabel.textContent = count ? `撤销 · ${count}` : '撤销';
  elements.historyNote.textContent = count ? `已有 ${count}/3 份布局备份` : '暂无布局备份';
}

function renderOrganize() {
  updateDesktopState();
  renderSummary();
  renderSizeControl();
  renderPreview();
  renderCategoryStrip();
  renderCategoryOrder();
  renderManualState();
  renderHistory();
}

function listMeta(item, installed = false) {
  if (installed) return item.type === 'appx' ? '系统应用' : '开始菜单';
  if (item.type === 'shortcut') return item.location === 'public' ? '共享快捷方式' : '桌面快捷方式';
  if (item.type === 'folder') return '文件夹 · 受保护';
  if (item.type === 'system') return '系统桌面图标';
  return '文件 · 受保护';
}

function createAppRow(item, installed = false) {
  const row = makeElement('div', 'app-row');
  const visual = makeElement('div', 'app-row-icon');
  if (item.icon) {
    const image = document.createElement('img');
    image.src = item.icon;
    image.alt = '';
    visual.append(image);
  } else {
    visual.textContent = appInitial(item.name);
    const category = categoryById(item.category);
    if (category) visual.style.background = category.color;
  }
  const copy = makeElement('div', 'app-row-copy');
  copy.append(makeElement('strong', '', item.name), makeElement('span', '', listMeta(item, installed)));
  const action = makeElement('button', `row-action ${installed ? 'add' : item.canRemove ? 'remove' : 'locked'}`);
  action.type = 'button';
  const actionName = installed ? '添加到桌面' : item.canRemove ? '移入回收站' : '此项目需要手动处理';
  action.title = actionName;
  action.setAttribute('aria-label', actionName);
  action.append(iconElement(installed ? 'plus' : item.canRemove ? 'trash-2' : 'shield-alert'));
  action.addEventListener('click', () => installed ? addApplication(item, action) : removeDesktopEntry(item, action));
  row.append(visual, copy, action);
  return row;
}

function libraryItems() {
  const query = normalizedName(elements.librarySearch.value);
  const desktopNames = new Set(state.desktop.map((item) => normalizedName(item.name)));
  const desktop = state.desktop.filter((item) => !query || normalizedName(`${item.name} ${item.targetPath}`).includes(query));
  const available = (state.installed || []).filter((item) => {
    if (desktopNames.has(normalizedName(item.name))) return false;
    return !query || normalizedName(`${item.name} ${item.targetPath}`).includes(query);
  });
  return { desktop, available };
}

function emptyList(message) {
  const empty = makeElement('div', 'list-empty');
  empty.append(iconElement('search-x'), makeElement('span', '', message));
  return empty;
}

function renderLibrary() {
  const { desktop, available } = libraryItems();
  elements.desktopAppList.replaceChildren();
  elements.installedAppList.replaceChildren();
  elements.desktopLibraryCount.textContent = String(desktop.length);
  elements.installedLibraryCount.textContent = state.installed === null ? '—' : String(available.length);
  elements.searchCount.textContent = String(desktop.length + available.length);

  if (desktop.length) desktop.forEach((item) => elements.desktopAppList.append(createAppRow(item)));
  else elements.desktopAppList.append(emptyList('没有匹配的桌面项目'));

  if (state.installed === null) {
    const loading = makeElement('div', 'list-empty loading-list');
    loading.append(makeElement('span', 'loading-mark'), makeElement('span', '', '正在扫描应用'));
    elements.installedAppList.append(loading);
  } else if (available.length) {
    available.forEach((item) => elements.installedAppList.append(createAppRow(item, true)));
  } else {
    elements.installedAppList.append(emptyList('没有可添加的匹配应用'));
  }
  syncIcons(document.querySelector('[data-view-panel="library"]'));
}

async function loadInstalledApps(force = false) {
  if (state.installed !== null && !force) return;
  state.installed = null;
  renderLibrary();
  try {
    state.installed = await api.scanApps();
  } catch (error) {
    state.installed = [];
    showToast(errorMessage(error), 'error');
  }
  renderLibrary();
}

async function addApplication(item, button) {
  await withBusy(button, async () => {
    try {
      await api.addShortcut(item);
      showToast(`${item.name} 已添加到桌面。`);
      await refreshOverview(false);
      renderLibrary();
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  });
}

async function removeDesktopEntry(item, button) {
  if (!item.canRemove) {
    await openModal({
      title: '请手动处理此项目',
      message: item.type === 'system'
        ? '这是 Windows 系统桌面图标，桌序不会直接删除。请在“桌面图标设置”中控制其显示。'
        : '这是正式文件或文件夹，不是快捷方式。为避免数据丢失，请在桌面上确认内容后手动处理。',
      confirmText: '知道了',
      warning: true,
      info: true
    });
    return;
  }
  const confirmed = await openModal({
    title: '移除桌面快捷方式',
    message: `“${item.name}”将被移入回收站，不会卸载对应应用。`,
    confirmText: '移入回收站',
    warning: true
  });
  if (!confirmed) return;
  await withBusy(button, async () => {
    try {
      const result = await api.removeDesktopItem(item.path);
      if (result.requiresManual) {
        await openModal({ title: '请手动处理此项目', message: result.message, confirmText: '知道了', warning: true, info: true });
        return;
      }
      showToast(result.message || '快捷方式已移入回收站。');
      await refreshOverview(false);
      renderLibrary();
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  });
}

function populateSettings() {
  if (!state.settings) return;
  elements.endpointInput.value = state.settings.endpoint || '';
  elements.modelInput.value = state.settings.model || '';
  elements.apiKeyInput.value = '';
  elements.apiKeyInput.placeholder = state.settings.hasApiKey ? '已安全保存（留空保持不变）' : 'sk-...';
  elements.useAiInput.checked = Boolean(state.settings.useAi);
  elements.fallbackInput.checked = state.settings.localFallback !== false;
  updateConnectionSummary();
}

function currentSettingsForm() {
  return {
    endpoint: elements.endpointInput.value.trim(),
    model: elements.modelInput.value.trim(),
    apiKey: elements.apiKeyInput.value.trim(),
    useAi: elements.useAiInput.checked,
    localFallback: elements.fallbackInput.checked
  };
}

function updateConnectionSummary() {
  const useAi = elements.useAiInput.checked;
  const hasKey = Boolean(elements.apiKeyInput.value.trim() || state.settings?.hasApiKey);
  elements.connectionTitle.textContent = useAi ? 'AI 分类模式' : '本地模式';
  elements.connectionDescription.textContent = useAi
    ? '整理时仅发送应用名称，由已配置模型返回分类结果。'
    : '当前使用内置规则完成应用分类。';
  elements.keyState.textContent = hasKey ? '已配置' : '未保存';
  elements.fallbackState.textContent = elements.fallbackInput.checked ? '本地继续' : '中止整理';
}

async function refreshOverview(showSuccess = true) {
  const result = await api.refreshDesktop();
  const previousOrder = state.categories.map((item) => item.id);
  state.desktop = result.items || [];
  state.classificationSource = result.classificationSource;
  state.historyCount = result.historyCount || 0;
  state.manualOverrideCount = result.manualOverrideCount || 0;
  state.desktopAvailable = Boolean(result.desktopAvailable);
  state.bounds = result.bounds || state.bounds;
  state.display = result.display || state.display;
  state.settings = result.settings || state.settings;
  state.iconSize = normalizeIconSize(result.settings?.iconSize ?? state.iconSize);
  state.currentIconSize = Number(result.currentIconSize) || state.currentIconSize;
  state.categories = previousOrder.length
    ? previousOrder.map((id) => result.categories.find((category) => category.id === id)).filter(Boolean)
    : result.categories;
  setNotice(result.warning || (!result.desktopAvailable ? '未连接到 Windows 桌面图标视图。预览与应用管理仍可使用，但暂时不能执行排列。' : ''));
  renderOrganize();
  if (showSuccess) showToast('桌面状态已更新。');
}

async function arrangeDesktop() {
  if (!state.desktopAvailable) {
    showToast('Windows 桌面服务当前不可用。', 'error');
    return;
  }
  try {
    state.display = await api.getCurrentDisplay();
    renderSizeControl();
    renderPreview();
  } catch (error) {
    showToast(`读取当前屏幕失败：${errorMessage(error)}`, 'error');
    return;
  }
  const confirmed = await openModal({
    title: '整理当前桌面',
    message: `已重新检测当前屏幕为 ${state.display.width} × ${state.display.height}。将按“${state.mode === 'left' ? '全部靠左' : '横向分组'}”调整 ${state.desktop.length} 个图标，并应用 ${state.iconSize}px 图标尺寸。当前布局会先备份，可撤销最近 3 次操作。`,
    confirmText: '开始整理'
  });
  if (!confirmed) return;

  await withBusy(elements.arrangeButton, async () => {
    try {
      const groups = groupedDesktop().map((group) => ({
        id: group.id,
        label: group.label,
        items: group.items.map((item) => ({
          name: item.name,
          fileName: item.fileName || item.name,
          shellName: item.shellName || item.fileName || item.name
        }))
      }));
      const result = await api.arrange({ mode: state.mode, iconSize: state.iconSize, groups });
      state.display = result.display || state.display;
      state.historyCount = result.historyCount;
      state.currentIconSize = Number(result.iconSize) || state.iconSize;
      state.iconSize = normalizeIconSize(state.currentIconSize);
      state.settings = { ...(state.settings || {}), iconSize: state.iconSize };
      renderSizeControl();
      renderHistory();
      showToast(`已按 ${state.currentIconSize}px 整理 ${result.moved || 0} 个桌面图标。`);
      await refreshOverview(false);
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  });
}

async function undoLayout() {
  await withBusy(elements.undoButton, async () => {
    try {
      const result = await api.undo();
      state.historyCount = result.historyCount;
      if (result.iconSize) {
        state.iconSize = normalizeIconSize(result.iconSize);
        state.currentIconSize = Number(result.iconSize);
        await api.saveIconSize(state.iconSize);
        renderSizeControl();
      }
      renderHistory();
      showToast(`已恢复 ${result.moved || 0} 个图标的位置。`);
      await refreshOverview(false);
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  });
}

async function resetManualCategories() {
  if (!state.manualOverrideCount) return;
  const confirmed = await openModal({
    title: '重置手动分类',
    message: `将清除 ${state.manualOverrideCount} 个图标的手动分类，并恢复当前 AI 或本地规则的分类结果。`,
    confirmText: '重置分类',
    warning: true
  });
  if (!confirmed) return;
  await withBusy(elements.resetCategoriesButton, async () => {
    try {
      await api.resetCategoryOverrides();
      await refreshOverview(false);
      showToast('手动分类已重置。');
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  });
  renderManualState();
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  document.querySelectorAll('[data-view-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
  if (view === 'library') loadInstalledApps();
  if (view === 'settings') populateSettings();
  if (view === 'organize') window.requestAnimationFrame(renderPreview);
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  document.querySelectorAll('.segment').forEach((button) => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll('.segment').forEach((item) => item.classList.toggle('is-active', item === button));
    renderPreview();
  }));

  elements.refreshButton.addEventListener('click', () => withBusy(elements.refreshButton, async () => {
    try { await refreshOverview(); } catch (error) { showToast(errorMessage(error), 'error'); }
  }));
  elements.arrangeButton.addEventListener('click', arrangeDesktop);
  elements.undoButton.addEventListener('click', undoLayout);
  elements.resetCategoriesButton.addEventListener('click', resetManualCategories);
  elements.iconSizeSlider.addEventListener('input', () => {
    state.iconSize = normalizeIconSize(elements.iconSizeSlider.value);
    renderSizeControl();
    renderPreview();
  });
  elements.iconSizeSlider.addEventListener('change', async () => {
    try {
      const result = await api.saveIconSize(state.iconSize);
      state.iconSize = normalizeIconSize(result.iconSize);
      state.settings = { ...(state.settings || {}), iconSize: state.iconSize };
      renderSizeControl();
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  });
  elements.librarySearch.addEventListener('input', renderLibrary);
  elements.rescanAppsButton.addEventListener('click', () => withBusy(elements.rescanAppsButton, async () => loadInstalledApps(true)));

  elements.toggleKeyButton.addEventListener('click', () => {
    const visible = elements.apiKeyInput.type === 'text';
    elements.apiKeyInput.type = visible ? 'password' : 'text';
    elements.toggleKeyButton.replaceChildren(iconElement(visible ? 'eye' : 'eye-off'));
    syncIcons(elements.toggleKeyButton);
  });
  elements.useAiInput.addEventListener('change', updateConnectionSummary);
  elements.fallbackInput.addEventListener('change', updateConnectionSummary);
  elements.apiKeyInput.addEventListener('input', updateConnectionSummary);

  elements.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const submitButton = elements.settingsForm.querySelector('[type="submit"]');
    withBusy(submitButton, async () => {
      try {
        state.settings = await api.saveSettings(currentSettingsForm());
        populateSettings();
        showToast('接口设置已保存。');
        await refreshOverview(false);
      } catch (error) {
        showToast(errorMessage(error), 'error');
      }
    });
  });

  elements.testApiButton.addEventListener('click', () => withBusy(elements.testApiButton, async () => {
    try {
      await api.testApi(currentSettingsForm());
      showToast('连接成功，接口可以正常响应。');
    } catch (error) {
      showToast(`连接失败：${errorMessage(error)}`, 'error');
    }
  }));

  elements.modalCancel.addEventListener('click', () => closeModal(false));
  elements.modalConfirm.addEventListener('click', () => closeModal(true));
  elements.modalBackdrop.addEventListener('click', (event) => {
    if (event.target === elements.modalBackdrop && !elements.modalCancel.classList.contains('is-hidden')) closeModal(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.modalBackdrop.classList.contains('is-hidden')) closeModal(false);
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.view === 'organize') renderPreview();
    }, 100);
  });
}

async function init() {
  cacheElements();
  bindEvents();
  syncIcons();
  try {
    const overview = await api.getOverview();
    state.desktop = overview.items || [];
    state.classificationSource = overview.classificationSource;
    state.categories = overview.categories || [];
    state.historyCount = overview.historyCount || 0;
    state.manualOverrideCount = overview.manualOverrideCount || 0;
    state.desktopAvailable = Boolean(overview.desktopAvailable);
    state.bounds = overview.bounds || state.bounds;
    state.settings = overview.settings;
    state.display = overview.display || state.display;
    state.iconSize = normalizeIconSize(overview.settings?.iconSize ?? overview.currentIconSize);
    state.currentIconSize = Number(overview.currentIconSize) || state.iconSize;
    setNotice(overview.warning || (!overview.desktopAvailable ? '未连接到 Windows 桌面图标视图。预览与应用管理仍可使用，但暂时不能执行排列。' : ''));
    renderOrganize();
    populateSettings();
  } catch (error) {
    elements.previewLoading.classList.add('is-hidden');
    state.desktopAvailable = false;
    updateDesktopState();
    setNotice(errorMessage(error));
    showToast(errorMessage(error), 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
