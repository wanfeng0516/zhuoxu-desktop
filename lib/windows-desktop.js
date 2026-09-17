const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const execFileAsync = promisify(execFile);
const SHORTCUT_EXTENSIONS = new Set(['.lnk', '.url']);

class WindowsDesktop {
  constructor({ app, shell, baseDir }) {
    this.app = app;
    this.shell = shell;
    this.baseDir = baseDir;
    this.iconCache = new Map();
    this.desktopDirs = [
      app.getPath('desktop'),
      path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')
    ];
  }

  async getIconData(filePath) {
    try {
      const image = await this.app.getFileIcon(filePath, { size: 'normal' });
      return image.isEmpty() ? '' : image.toDataURL();
    } catch {
      return '';
    }
  }

  runtimeScriptPath(fileName) {
    const scriptBase = this.baseDir.includes('app.asar')
      ? this.baseDir.replace('app.asar', 'app.asar.unpacked')
      : this.baseDir;
    return path.join(scriptBase, 'scripts', fileName);
  }

  async extractShellIcons(items) {
    const uncached = items.filter((item) => !this.iconCache.has(item.id));
    let payloadPath = '';
    try {
      if (uncached.length) {
        payloadPath = path.join(os.tmpdir(), `zhuoxu-icons-${process.pid}-${Date.now()}.json`);
        await fs.writeFile(payloadPath, JSON.stringify(uncached), 'utf8');
        const { stdout } = await execFileAsync('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-File', this.runtimeScriptPath('extract-icons.ps1'),
          '-PayloadPath', payloadPath
        ], {
          windowsHide: true,
          timeout: 45000,
          encoding: 'utf8',
          maxBuffer: 30 * 1024 * 1024
        });
        const parsed = JSON.parse(stdout.trim().replace(/^\uFEFF/, ''));
        if (parsed?.ok === false) throw new Error(parsed.error || '图标解析失败。');
        const results = Array.isArray(parsed) ? parsed : [parsed];
        results.forEach((result) => this.iconCache.set(result.id, result.icon || ''));
      }
      return new Map(items.map((item) => [item.id, this.iconCache.get(item.id) || '']));
    } finally {
      if (payloadPath) await fs.unlink(payloadPath).catch(() => {});
    }
  }

  async readShortcut(filePath) {
    try {
      return this.shell.readShortcutLink(filePath);
    } catch {
      return {};
    }
  }

  async mapWithConcurrency(items, mapper, concurrency = 12) {
    const results = new Array(items.length);
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await mapper(items[current], current);
      }
    });
    await Promise.all(workers);
    return results;
  }

  async scanDesktopFiles() {
    const entries = [];
    for (const desktopDir of this.desktopDirs) {
      try {
        const files = await fs.readdir(desktopDir, { withFileTypes: true });
        for (const file of files) {
          if (file.name.toLowerCase() === 'desktop.ini') continue;
          const fullPath = path.join(desktopDir, file.name);
          const extension = file.isDirectory() ? '' : path.extname(file.name).toLowerCase();
          const isShortcut = SHORTCUT_EXTENSIONS.has(extension);
          const shortcut = extension === '.lnk' ? await this.readShortcut(fullPath) : {};
          entries.push({
            id: fullPath.toLowerCase(),
            name: file.isDirectory() ? file.name : path.basename(file.name, extension),
            fileName: file.name,
            path: fullPath,
            targetPath: shortcut.target || '',
            iconPath: shortcut.icon || '',
            iconIndex: shortcut.iconIndex || 0,
            type: file.isDirectory() ? 'folder' : isShortcut ? 'shortcut' : 'file',
            location: desktopDir === this.desktopDirs[0] ? 'user' : 'public',
            canRemove: isShortcut && desktopDir === this.desktopDirs[0]
          });
        }
      } catch {
        // A missing public desktop is valid on managed Windows installations.
      }
    }
    const shortcutItems = entries.filter((item) => item.type === 'shortcut');
    const shellIcons = await this.extractShellIcons(shortcutItems).catch(() => new Map());
    return this.mapWithConcurrency(entries, async (item) => ({
      ...item,
      icon: shellIcons.get(item.id) || await this.getIconData(item.targetPath || item.path)
    }));
  }

  async collectFiles(root, extensions, output = []) {
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return output;
    }
    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        await this.collectFiles(fullPath, extensions, output);
      } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
        output.push(fullPath);
      }
    }
    return output;
  }

  async getStartApps() {
    try {
      const command = '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress';
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        windowsHide: true,
        timeout: 20000,
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024
      });
      if (!stdout.trim()) return [];
      const data = JSON.parse(stdout.replace(/^\uFEFF/, ''));
      return (Array.isArray(data) ? data : [data]).map((entry) => ({
        id: `appx:${entry.AppID}`,
        name: entry.Name,
        fileName: `${entry.Name}.lnk`,
        sourcePath: '',
        appId: entry.AppID,
        targetPath: `shell:AppsFolder\\${entry.AppID}`,
        type: 'appx',
        icon: ''
      }));
    } catch {
      return [];
    }
  }

  async scanInstalledApps() {
    const roots = [
      path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    ].filter(Boolean);
    const shortcutPaths = [];
    for (const root of roots) {
      await this.collectFiles(root, SHORTCUT_EXTENSIONS, shortcutPaths);
    }

    const shortcuts = await this.mapWithConcurrency(shortcutPaths, async (sourcePath) => {
      const extension = path.extname(sourcePath).toLowerCase();
      const shortcut = extension === '.lnk' ? await this.readShortcut(sourcePath) : {};
      return {
        id: sourcePath.toLowerCase(),
        name: path.basename(sourcePath, extension),
        fileName: path.basename(sourcePath),
        sourcePath,
        appId: '',
        targetPath: shortcut.target || sourcePath,
        iconPath: shortcut.icon || '',
        iconIndex: shortcut.iconIndex || 0,
        type: 'start-menu',
        icon: ''
      };
    });

    const shellIcons = await this.extractShellIcons(shortcuts).catch(() => new Map());
    await this.mapWithConcurrency(shortcuts, async (item) => {
      item.icon = shellIcons.get(item.id) || await this.getIconData(item.targetPath || item.sourcePath);
    });

    const appx = await this.getStartApps();
    const seen = new Set();
    return [...shortcuts, ...appx]
      .filter((item) => {
        const key = item.name.trim().toLocaleLowerCase('zh-CN');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  async addShortcut(item) {
    const desktopDir = this.desktopDirs[0];
    const safeName = String(item.name || '应用').replace(/[<>:"/\\|?*]/g, '_');
    let destination = path.join(desktopDir, `${safeName}.lnk`);
    let suffix = 2;
    while (true) {
      try {
        await fs.access(destination);
        destination = path.join(desktopDir, `${safeName} (${suffix++}).lnk`);
      } catch {
        break;
      }
    }

    if (item.sourcePath && SHORTCUT_EXTENSIONS.has(path.extname(item.sourcePath).toLowerCase())) {
      destination = destination.replace(/\.lnk$/i, path.extname(item.sourcePath));
      await fs.copyFile(item.sourcePath, destination);
    } else if (item.appId) {
      const target = path.join(process.env.WINDIR || 'C:\\Windows', 'explorer.exe');
      const ok = this.shell.writeShortcutLink(destination, 'create', {
        target,
        args: `shell:AppsFolder\\${item.appId}`,
        description: `打开 ${item.name}`
      });
      if (!ok) throw new Error('创建应用快捷方式失败。');
    } else {
      throw new Error('该应用缺少可用的启动信息。');
    }
    return { ok: true, destination };
  }

  async removeDesktopItem(itemPath) {
    const resolved = path.resolve(itemPath);
    const parent = path.dirname(resolved).toLowerCase();
    const allowed = this.desktopDirs.map((dir) => path.resolve(dir).toLowerCase());
    if (!allowed.includes(parent)) throw new Error('只能移除桌面根目录中的项目。');

    const extension = path.extname(resolved).toLowerCase();
    if (!SHORTCUT_EXTENSIONS.has(extension)) {
      return {
        ok: false,
        requiresManual: true,
        message: '这是文件或文件夹，不是快捷方式。为避免数据丢失，请在桌面上确认内容后手动处理。'
      };
    }
    if (parent !== allowed[0]) {
      return {
        ok: false,
        requiresManual: true,
        message: '这是所有用户共享的桌面快捷方式，需要管理员权限，请手动处理。'
      };
    }
    await this.shell.trashItem(resolved);
    return { ok: true, message: '快捷方式已移入回收站。' };
  }

  async invokeLayout(action, payload = null) {
    const scriptPath = this.runtimeScriptPath('desktop-layout.ps1');
    let payloadPath = '';
    try {
      if (payload) {
        payloadPath = path.join(os.tmpdir(), `zhuoxu-${process.pid}-${Date.now()}.json`);
        await fs.writeFile(payloadPath, JSON.stringify(payload), 'utf8');
      }
      const args = ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', action];
      if (payloadPath) args.push('-PayloadPath', payloadPath);
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const { stdout, stderr } = await execFileAsync('powershell.exe', args, {
            windowsHide: false,
            timeout: 60000,
            encoding: 'utf8',
            maxBuffer: 5 * 1024 * 1024
          });
          const clean = stdout.trim().replace(/^\uFEFF/, '');
          if (!clean) throw new Error(stderr.trim() || '桌面布局服务未返回结果。');
          const result = JSON.parse(clean);
          if (!result.ok) throw new Error(result.error || '桌面布局操作失败。');
          return result;
        } catch (error) {
          lastError = error;
          const detail = error.stderr?.trim() || error.message;
          const transient = /desktop icon view|desktop process|桌面图标视图/i.test(detail);
          if (error.killed || !transient || attempt === 2) throw error;
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
      throw lastError;
    } catch (error) {
      if (error.killed) throw new Error('桌面布局操作超时。');
      throw new Error(error.stderr?.trim() || error.message);
    } finally {
      if (payloadPath) await fs.unlink(payloadPath).catch(() => {});
    }
  }

  async captureLayout() {
    return this.invokeLayout('capture');
  }

  async getDesktopSnapshot() {
    const [files, layout] = await Promise.all([
      this.scanDesktopFiles(),
      this.captureLayout().catch(() => ({ ok: false, items: [], bounds: { width: 1920, height: 1080 }, iconSize: 48 }))
    ]);
    const fileByName = new Map();
    for (const file of files) {
      fileByName.set(file.name.toLocaleLowerCase('zh-CN'), file);
      fileByName.set(file.fileName.toLocaleLowerCase('zh-CN'), file);
    }
    const matchedPaths = new Set();
    const positioned = (layout.items || []).map((positionedItem) => {
      const file = fileByName.get(positionedItem.name.toLocaleLowerCase('zh-CN'));
      if (file) matchedPaths.add(file.path);
      return {
        ...(file || {
          id: `shell:${positionedItem.name}`,
          name: positionedItem.name,
          fileName: positionedItem.name,
          path: '',
          targetPath: '',
          type: 'system',
          location: 'shell',
          canRemove: false,
          icon: ''
        }),
        shellName: positionedItem.name,
        x: positionedItem.x,
        y: positionedItem.y
      };
    });
    const unpositioned = files
      .filter((file) => !matchedPaths.has(file.path))
      .map((file, index) => ({ ...file, shellName: file.fileName || file.name, x: 22, y: 22 + index * 82 }));
    return {
      items: [...positioned, ...unpositioned],
      bounds: layout.bounds || { width: 1920, height: 1080 },
      iconSize: Number(layout.iconSize) || 48,
      desktopAvailable: Boolean(layout.ok)
    };
  }

  async arrangeLayout(payload) {
    return this.invokeLayout('arrange', payload);
  }

  async restoreLayout(snapshot) {
    return this.invokeLayout('restore', snapshot);
  }
}

module.exports = WindowsDesktop;
