<div align="center">

  <h1>DeskZero</h1>

  <img src="src-tauri/icons/icon.png" width="128" height="128" />

  <br>
  <br>

  <b>简体中文</b> | <a href="./README.md">English</a>

  <h6>赞助我</h6>

  <a href="https://afdian.com/a/LanRhyme" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/爱发电-@LanRhyme-946ce6?style=for-the-badge&logo=afdian&logoColor=white" alt="爱发电"></a>

  <br>
  <br>

  将您的 Windows 桌面变为一个全新的、可高度自定义的工作区

  基于 Tauri v2 (Rust) + React 构建，嵌入 Windows 桌面图标层运行

</div>

## 主要功能

- **全新桌面体验**：窗口嵌入 Windows 桌面图标层（壁纸与图标之间），与原生桌面融为一体
- **桌面收纳盒**：创建可自定义的容器（类似栅栏/分组），支持普通、目录映射、文件夹、游戏、组件等多种类型
- **目录映射**：将容器映射到磁盘上的现有文件夹，实时同步文件变化
- **桌面小组件**：支持时钟、天气、待办、日历、倒计时、音乐控制、便签、系统监控等小组件
- **高度自定义**：容器颜色、圆角、布局、毛玻璃效果、视差滚动、图标光晕、自定义字体等
- **全局字体设置**：内置思源黑体、霞鹜文楷、缝合像素字体，支持加载本地系统字体
- **桌面文件管理**：支持拖拽、框选、右键菜单、剪贴板操作、批量排序
- **自动备份**：后台定时自动备份桌面布局，支持手动创建快照和一键恢复
- **多显示器支持**：自动检测多显示器配置，适配不同缩放比例
- **高性能**：Rust 后端 + React 前端，占用极少系统资源
- **纯净存储**：所有配置安全存储在 SQLite 数据库中，不产生额外文件

## 软件截图

<div align="center">
  <img src="docs/screenshot.png" width="800" />
</div>

## 安装指南

DeskZero 目前**仅支持 Windows**。

从 [GitHub Releases](https://github.com/LanRhyme/DeskZero/releases) 下载最新版本：

| 版本 | 文件 | 说明 |
|:---:|:---:|:---:|
| 安装版 | `DeskZero_x.x.x_x64-setup.exe` | 标准安装程序 |
| 便携版 | `DeskZero_x.x.x_x64-portable.exe` | 免安装，双击即用 |

## 使用说明

- **启动**：DeskZero 在后台运行，主窗口直接附着到桌面图标层
- **创建容器**：在桌面空白处右键单击，选择创建收纳盒
- **添加项目**：将快捷方式或文件拖放到容器中
- **添加小组件**：右键桌面 → 新建小组件，选择需要的组件类型
- **设置**：右键系统托盘图标 → 设置，可自定义网格、字体、主题、毛玻璃效果等
- **隐藏/显示图标**：双击桌面空白处可切换桌面图标的显示状态

## 技术栈

| 层级 | 技术 |
|:---:|:---:|
| 前端 | React 19 + TypeScript + Tailwind CSS v4 + Zustand + Framer Motion |
| 后端 | Rust + Tauri v2 + rusqlite + tokio |
| 存储 | SQLite (bundled) |
| 构建 | Vite + cargo |

## 开源协议

[GPL-3.0 License](https://opensource.org/licenses/GPL-3.0)
