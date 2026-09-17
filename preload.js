const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zhuoxu', {
  getOverview: () => ipcRenderer.invoke('app:overview'),
  refreshDesktop: () => ipcRenderer.invoke('desktop:refresh'),
  scanApps: () => ipcRenderer.invoke('apps:scan'),
  addShortcut: (item) => ipcRenderer.invoke('shortcut:add', item),
  removeDesktopItem: (itemPath) => ipcRenderer.invoke('desktop:remove', itemPath),
  classify: (items) => ipcRenderer.invoke('desktop:classify', items),
  setCategoryOverride: (itemId, categoryId) => ipcRenderer.invoke('classification:set-override', { itemId, categoryId }),
  resetCategoryOverrides: () => ipcRenderer.invoke('classification:reset-overrides'),
  getCurrentDisplay: () => ipcRenderer.invoke('display:get-current'),
  saveIconSize: (iconSize) => ipcRenderer.invoke('layout:set-icon-size', iconSize),
  arrange: (payload) => ipcRenderer.invoke('layout:arrange', payload),
  undo: () => ipcRenderer.invoke('layout:undo'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  testApi: (settings) => ipcRenderer.invoke('settings:test', settings),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
});
