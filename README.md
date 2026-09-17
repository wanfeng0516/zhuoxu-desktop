# 桌序 ZhuoXu

桌序是一款 Windows 桌面图标整理客户端。它读取 Explorer 中的真实桌面图标，根据用途分类并重新排列，同时在每次操作前保存布局，支持撤销最近 3 次整理。

## 主要功能

- 全部靠左：按分类顺序纵向填充桌面列。
- 横向分组：同类图标横向排列，并根据当前显示器尺寸自动换行与分区。
- 手动分类：在预览中拖动图标，调整分类结果。
- 布局恢复：每次整理前自动备份，可撤销最近 3 次操作。
- 图标尺寸：每次整理时重新读取当前屏幕尺寸，并应用用户选择的图标大小。
- 应用管理：扫描开始菜单和系统应用，添加或移除桌面快捷方式。
- AI 分类：支持 OpenAI 兼容的 `chat/completions` 接口；API Key 使用 Windows 安全存储加密。

## 安装

1. 从 GitHub Releases 下载 `ZhuoXu-Setup-<版本>-x64.zip`。
2. 解压 ZIP，运行其中的 `ZhuoXu-Setup-<版本>-x64.exe`。
3. 选择安装目录并完成安装。安装器会创建桌面与开始菜单快捷方式。

当前安装包没有代码签名证书。Windows SmartScreen 可能显示“未知发布者”，可在确认文件来自本项目 Release 后选择“更多信息”继续运行。Release 同时提供 `SHA256SUMS.txt` 用于校验文件完整性。

## 系统要求

- Windows 10 或 Windows 11 x64。
- Windows Explorer 桌面正在运行。
- 共享桌面快捷方式的修改可能需要管理员权限。

## 本地开发

需要 Node.js 20 或更高版本。

```powershell
npm ci
npm start
```

运行静态检查：

```powershell
npm run check
```

## 构建安装包

生成 NSIS 安装程序：

```powershell
npm run dist
```

生成安装程序、Release ZIP 和 SHA-256 校验文件：

```powershell
npm run release:prepare
```

产物位于 `release/`。该目录、`node_modules/`、本地配置和日志均已排除，不会进入 Git 仓库。

验证 ZIP 解压、静默安装、快捷方式、卸载项和卸载清理：

```powershell
npm run release:verify
```

## 发布 GitHub Release

仓库包含 `.github/workflows/release.yml`。推送形如 `v0.1.1` 的标签后，GitHub Actions 会在 Windows 环境构建并发布以下文件：

- `ZhuoXu-Setup-0.1.1-x64.exe`
- `ZhuoXu-Setup-0.1.1-x64.zip`
- `SHA256SUMS.txt`

发布标签应与 `package.json` 中的版本一致。

## 隐私与安全

桌面扫描和本地分类默认在本机完成。启用 AI 分类后，程序只向用户配置的 API 服务发送桌面项目名称。API Key 与个人配置保存在 Electron 用户数据目录，不在项目源码或安装包中。

## 许可证

[MIT](LICENSE)
