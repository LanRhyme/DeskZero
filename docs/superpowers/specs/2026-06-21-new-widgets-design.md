# 新增内置小组件设计文档

> 日期：2026-06-21
> 状态：待审核
> 范围：新增 5 个内置桌面小组件

## 概述

在现有 4 个内置小组件（时钟、便签、系统监控、一言）基础上，新增 5 个小组件：日历、待办事项、音乐播放器、倒计时/纪念日、天气。所有新小组件完全遵循现有架构模式，保持视觉风格一致（毛玻璃、半透明背景、圆角卡片），支持高度自定义。

## 架构决策

**方案：遵循现有 Widget 架构，逐个实现**

- 每个新小组件在 `src/components/Widget/widgets/` 下创建独立组件文件
- 实现 `WidgetComponentProps` 接口（来自 `@/types/widget`）
- 在 `WidgetRegistry.ts` 注册，包含 `widgetType`、`name`、`icon`、`defaultSize`、`defaultConfig`
- 在 `WidgetSettingsPanel.ts` 的 `renderContentSpecific()` 中添加对应配置面板
- 配置通过 `config.config?.key || defaultValue` 模式读取
- 实时预览通过 `useEffect` 监听配置变化 → `updateContainerStyle` 同步到 store

**持久化策略：**
- 日历事件、待办事项、倒计时事件 → 新增 SQLite 表（通过 Tauri IPC 命令 CRUD）
- 天气数据 → 前端内存缓存，不持久化（定时刷新）
- 音乐播放器 → 读取系统播放状态，不持久化

**新增 SQLite 表：** 在 `src-tauri/src/storage/db.rs` 的 `init_db()` 中添加建表语句，遵循 `INSERT ... ON CONFLICT DO UPDATE` 的 UPSERT 规范。

## 小组件清单

| 小组件 | 文件名 | 默认尺寸 | 图标 | 说明 |
|--------|--------|---------|------|------|
| 日历 | `CalendarWidget.tsx` | 3×3 | `Calendar` | 月视图 + 农历 + 节假日 + 事件标记 |
| 待办事项 | `TodoWidget.tsx` | 2×3 | `CheckSquare` | 待办清单 + 优先级 + 截止日期 |
| 音乐播放器 | `MusicWidget.tsx` | 3×1.5 | `Music` | 系统音乐信息 + 播放控制 |
| 倒计时/纪念日 | `CountdownWidget.tsx` | 2×2 | `Timer` | 倒计时 + 正计数 + 多事件支持 |
| 天气 | `WeatherWidget.tsx` | 3×1.5 | `CloudSun` | 当前天气 + 预报 + 详细信息 |

---

## 1. 日历小组件（CalendarWidget）

### 视觉设计
- 月视图网格（7列 × 5-6行），顶部显示年月和左右切换箭头
- 今天日期用强调色圆圈高亮
- 周末日期用稍浅颜色区分
- 农历日期显示在公历日期下方（小字号）
- 节假日用小红点标记，法定假日日期文字标红
- 事件标记：日期下方显示小圆点（最多3个，不同颜色代表不同事件）

### 自定义配置项

| 配置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 显示农历 | toggle | true | 农历日期显示在公历下方 |
| 显示节假日 | toggle | true | 标记中国法定节假日和调休 |
| 显示事件标记 | toggle | true | 日期下方显示事件圆点 |
| 星期起始日 | select | 周一 | 周一 / 周日 |
| 字体颜色 | color | theme | 主题/强调/渐变/自定义hex |
| 内容大小比例 | slider | 1.0 | 0.6x - 1.6x |

### 数据模型

SQLite 表 `calendar_events`：
```sql
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,       -- YYYY-MM-DD
    title TEXT NOT NULL,
    color TEXT DEFAULT '#ef4444'
)
```

### 后端命令
- `get_calendar_events(year: i32, month: i32) -> Result<Vec<CalendarEvent>, String>`
- `add_calendar_event(event: CalendarEvent) -> Result<(), String>`
- `delete_calendar_event(id: String) -> Result<(), String>`

### 农历实现
使用前端纯 JS 农历库（如 `lunar-javascript`），无需后端支持。在前端根据公历日期计算农历显示。

---

## 2. 待办事项小组件（TodoWidget）

### 视觉设计
- 顶部显示标题"待办事项"和添加按钮（+ 图标）
- 待办列表项：左侧 checkbox，中间文本（支持截断），右侧删除按钮（hover 显示）
- 优先级标记：左侧彩色竖条（高=红、中=橙、低=蓝）
- 截止日期显示在文本下方（小字号，过期标红）
- 底部显示统计信息（如"3/7 已完成"）
- 已完成项文字加删除线，可折叠隐藏

### 自定义配置项

| 配置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 字体颜色 | color | theme | 主题/强调/渐变/自定义hex |
| 字体大小比例 | slider | 1.0 | 0.6x - 1.6x |
| 显示优先级 | toggle | true | 左侧彩色竖条 |
| 显示截止日期 | toggle | true | 文本下方小字 |
| 默认排序方式 | select | 添加时间 | 添加时间/优先级/截止日期 |
| 隐藏已完成 | toggle | false | 折叠已完成项 |

### 数据模型

SQLite 表 `todo_items`：
```sql
CREATE TABLE IF NOT EXISTS todo_items (
    id TEXT PRIMARY KEY,
    container_id TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',  -- 'high' | 'medium' | 'low'
    due_date TEXT,                    -- YYYY-MM-DD, nullable
    completed INTEGER DEFAULT 0,     -- 0/1
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
)
```

### 后端命令
- `get_todo_items(container_id: String) -> Result<Vec<TodoItem>, String>`
- `add_todo_item(item: TodoItem) -> Result<(), String>`
- `update_todo_item(item: TodoItem) -> Result<(), String>`
- `delete_todo_item(id: String) -> Result<(), String>`
- `reorder_todo_items(items: Vec<(String, i32)>) -> Result<(), String>`

### 前端行为
- 添加：点击 + 按钮，输入框内按回车确认
- 完成：点击 checkbox，文字加删除线动画
- 删除：hover 显示 × 按钮，点击后直接删除（无需确认）
- 编辑：双击文本进入编辑模式
- 排序：拖拽排序或按配置自动排序

---

## 3. 音乐播放器小组件（MusicWidget）

### 视觉设计
- 左侧：专辑封面缩略图（圆角正方形，无封面时显示音符图标占位）
- 中间：歌曲名（粗体截断）+ 艺术家名（小字号）
- 下方：进度条（细线条，可拖拽）+ 当前时间/总时长
- 底部：播放控制按钮组（上一首 / 播放暂停 / 下一首），居中排列
- 整体风格简洁，适配小尺寸容器

### 自定义配置项

| 配置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 字体颜色 | color | theme | 主题/强调/渐变/自定义hex |
| 显示专辑封面 | toggle | true | 左侧封面缩略图 |
| 显示进度条 | toggle | true | 进度条 + 时间显示 |
| 按钮大小比例 | slider | 1.0 | 0.8x - 1.4x |

### 后端实现

通过 Windows `GlobalSystemMediaTransportControls` API 获取系统当前播放信息。

Tauri 命令：
- `get_music_status() -> Result<MusicStatus, String>` — 返回当前播放状态
- `music_play_pause() -> Result<(), String>` — 播放/暂停
- `music_next() -> Result<(), String>` — 下一首
- `music_prev() -> Result<(), String>` — 上一首
- `music_seek(position_ms: u64) -> Result<(), String>` — 跳转进度

返回数据结构：
```rust
#[derive(Serialize, Deserialize)]
pub struct MusicStatus {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub position_ms: u64,
    pub is_playing: bool,
    pub cover_path: Option<String>,  // 封面图本地路径
}
```

### 封面图处理
后端读取系统媒体封面缓存路径，通过 Tauri `convertFileSrc()` 转为前端可访问的 asset URL。

### 前端轮询
每秒调用 `get_music_status()` 更新状态（与 System Monitor 的轮询模式一致）。当无音乐播放时显示"未在播放"占位状态。

---

## 4. 倒计时/纪念日小组件（CountdownWidget）

### 视觉设计
- 卡片式列表，每个事件占一行
- 倒计时模式：左侧事件名，右侧显示"X天 HH:MM:SS"（实时跳动）
- 纪念日模式：左侧事件名，右侧显示"已过去 X 天"
- 顶部可切换显示模式（倒计时/纪念日/混合）
- 添加按钮位于右上角（+ 图标）
- 点击添加按钮弹出内联表单：事件名 + 日期选择 + 模式选择
- 预设日期快捷按钮（新年、春节、中秋、国庆、生日）

### 自定义配置项

| 配置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 字体颜色 | color | theme | 主题/强调/渐变/自定义hex |
| 字体大小比例 | slider | 1.0 | 0.6x - 1.6x |
| 显示秒数 | toggle | true | 倒计时是否显示秒 |
| 默认显示模式 | select | 混合 | 倒计时/纪念日/混合 |
| 显示预设快捷按钮 | toggle | true | 添加时显示预设日期 |

### 数据模型

SQLite 表 `countdown_events`：
```sql
CREATE TABLE IF NOT EXISTS countdown_events (
    id TEXT PRIMARY KEY,
    container_id TEXT NOT NULL,
    title TEXT NOT NULL,
    target_date TEXT NOT NULL,  -- YYYY-MM-DD
    mode TEXT DEFAULT 'countdown',  -- 'countdown' | 'anniversary'
    created_at TEXT NOT NULL
)
```

### 后端命令
- `get_countdown_events(container_id: String) -> Result<Vec<CountdownEvent>, String>`
- `add_countdown_event(event: CountdownEvent) -> Result<(), String>`
- `update_countdown_event(event: CountdownEvent) -> Result<(), String>`
- `delete_countdown_event(id: String) -> Result<(), String>`

### 前端行为
- 每秒更新一次时间差计算（useEffect + setInterval）
- 倒计时到 0 时显示"到了！"并高亮动画
- 预设日期自动计算当年的下一个 occurrence（如今年的春节、中秋）
- 拖拽排序支持

---

## 5. 天气小组件（WeatherWidget）

### 视觉设计
- 左侧：大型天气图标（晴/多云/雨/雪/雾等 SVG 图标，支持动态效果如飘雨、飘雪）
- 右侧：当前温度（大字号）+ 天气状况文字 + 城市名
- 下方：未来 3 天预报条（小图标 + 最高/最低温）
- 底部：详细信息行（湿度 | 风力 | 气压，小图标 + 数值）

### 自定义配置项

| 配置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 温度单位 | select | 摄氏 | 摄氏 / 华氏 |
| 字体颜色 | color | theme | 主题/强调/渐变/自定义hex |
| 显示详细信息 | toggle | true | 湿度/风力/气压 |
| 显示多日预报 | toggle | true | 未来3天预报条 |
| 显示天气图标动画 | toggle | true | 飘雨/飘雪等动画效果 |
| 内容大小比例 | slider | 1.0 | 0.6x - 1.6x |
| 更新频率 | select | 1小时 | 30分/1小时/3小时 |

### 天气 API 接入

使用和风天气 API（免费额度足够）。

后端 Tauri 命令：
- `get_weather(location: Option<String>) -> Result<WeatherData, String>` — 获取天气数据
- `get_location_by_ip() -> Result<String, String>` — 通过 IP 获取城市名

返回数据结构：
```rust
#[derive(Serialize, Deserialize)]
pub struct WeatherData {
    pub city: String,
    pub temp: f32,
    pub feels_like: f32,
    pub humidity: i32,
    pub wind_speed: f32,
    pub pressure: i32,
    pub icon: String,        // "100" = 晴, "101" = 多云, etc.
    pub text: String,        // "晴", "多云"
    pub forecast: Vec<DayForecast>,
}

#[derive(Serialize, Deserialize)]
pub struct DayForecast {
    pub date: String,
    pub icon_day: String,
    pub text_day: String,
    pub temp_max: f32,
    pub temp_min: f32,
}
```

### 缓存策略
前端缓存天气数据到内存，超过设定频率才重新请求。请求失败时显示上次缓存数据。

### API Key 管理
首次使用天气小组件时，弹出提示让用户输入和风天气 API Key（免费注册获取），存储在本地 settings 中。settings 模型新增 `weather_api_key: Option<String>` 字段。

---

## 实现顺序

建议按以下顺序实现（从简到繁）：

1. **倒计时/纪念日** — 最简单的数据模型和 UI，纯前端时间计算
2. **待办事项** — 标准 CRUD 列表，拖拽排序
3. **日历** — 月视图网格 + 农历库集成
4. **天气** — API 集成 + 天气图标动画
5. **音乐播放器** — Windows 系统 API 集成，复杂度最高

## 文件变更清单

### 前端新增文件
- `src/components/Widget/widgets/CalendarWidget.tsx`
- `src/components/Widget/widgets/TodoWidget.tsx`
- `src/components/Widget/widgets/MusicWidget.tsx`
- `src/components/Widget/widgets/CountdownWidget.tsx`
- `src/components/Widget/widgets/WeatherWidget.tsx`

### 前端修改文件
- `src/components/Widget/WidgetRegistry.ts` — 注册 5 个新小组件
- `src/components/Widget/WidgetSettingsPanel.tsx` — 添加 5 个小组件的配置面板
- `src/components/Widget/WidgetSelectorDialog.tsx` — 更新图标映射

### 后端新增文件
- `src-tauri/src/commands/calendar.rs` — 日历事件 CRUD
- `src-tauri/src/commands/todo.rs` — 待办事项 CRUD
- `src-tauri/src/commands/countdown.rs` — 倒计时事件 CRUD
- `src-tauri/src/commands/music.rs` — 系统音乐信息读取
- `src-tauri/src/commands/weather.rs` — 天气 API 请求
- `src-tauri/src/models/calendar.rs` — 日历事件模型
- `src-tauri/src/models/todo.rs` — 待办事项模型
- `src-tauri/src/models/countdown.rs` — 倒计时事件模型
- `src-tauri/src/models/music.rs` — 音乐状态模型
- `src-tauri/src/models/weather.rs` — 天气数据模型
- `src-tauri/src/storage/calendar_store.rs` — 日历事件存储
- `src-tauri/src/storage/todo_store.rs` — 待办事项存储
- `src-tauri/src/storage/countdown_store.rs` — 倒计时事件存储

### 后端修改文件
- `src-tauri/src/storage/db.rs` — 新增 3 张表的建表语句
- `src-tauri/src/lib.rs` — 注册新命令模块
- `src-tauri/src/models/mod.rs` — 导出新模型
- `src-tauri/src/storage/mod.rs` — 导出新 store
- `src-tauri/Cargo.toml` — 可能新增依赖（农历库、HTTP 客户端）

### 新增前端依赖
- `lunar-javascript` — 农历计算库

### 新增 Rust 依赖
- `reqwest` — HTTP 客户端（天气 API 请求）
- `windows` crate — Windows 媒体控制 API（音乐播放器）
