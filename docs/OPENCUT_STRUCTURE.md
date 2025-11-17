# OpenCut 项目结构分析

## 已下载位置
`OpenCut-main/` 目录

## 核心目录结构

### 1. 编辑器组件 (`apps/web/src/components/editor/`)
包含 34 个编辑器相关组件文件，主要包括：
- Timeline 组件
- Track 组件
- Preview 组件
- Control bar 组件
- 其他编辑器 UI 组件

### 2. 状态管理 (`apps/web/src/stores/`)
使用 Zustand 进行状态管理，包含：
- `editor-store.ts` - 编辑器主状态
- `timeline-store.ts` - 时间轴状态
- `playback-store.ts` - 播放控制状态
- `media-store.ts` - 媒体文件状态
- `project-store.ts` - 项目状态
- `scene-store.ts` - 场景状态
- `sounds-store.ts` - 音频状态
- `stickers-store.ts` - 贴纸状态
- `text-properties-store.ts` - 文本属性状态
- `panel-store.ts` - 面板状态
- `keybindings-store.ts` - 快捷键绑定状态

### 3. Hooks (`apps/web/src/hooks/`)
自定义 React Hooks：
- `use-timeline-playhead.ts` - 播放头控制
- `use-timeline-zoom.ts` - 时间轴缩放
- `use-timeline-element-resize.ts` - 元素调整大小
- `use-timeline-snapping.ts` - 对齐功能
- `use-playback-controls.ts` - 播放控制
- `use-editor-actions.ts` - 编辑器操作
- `use-drag-drop.ts` - 拖拽功能
- 等等...

### 4. 工具库 (`apps/web/src/lib/`)
核心工具函数：
- `timeline.ts` - 时间轴计算工具
- `timeline-renderer.ts` - 时间轴渲染
- `export.ts` - 导出功能
- `media-processing.ts` - 媒体处理
- `video-cache.ts` - 视频缓存
- `time.ts` - 时间格式化工具

### 5. 类型定义 (`apps/web/src/types/`)
TypeScript 类型定义：
- `timeline.ts` - 时间轴类型
- `editor.ts` - 编辑器类型
- `media.ts` - 媒体类型
- `playback.ts` - 播放类型
- `project.ts` - 项目类型

## 主要依赖

从 `package.json` 可以看到主要依赖：
- `zustand` - 状态管理
- `framer-motion` - 动画库
- `@ffmpeg/ffmpeg` - 视频处理
- `@hello-pangea/dnd` - 拖拽功能
- `react-resizable-panels` - 可调整面板
- `lucide-react` - 图标库

## 集成建议

1. **提取核心组件**
   - 从 `components/editor/` 提取需要的组件
   - 适配到当前项目的组件结构

2. **集成状态管理**
   - 使用 Zustand stores 管理编辑器状态
   - 适配到当前项目的数据结构

3. **集成 Hooks**
   - 使用 OpenCut 的自定义 hooks
   - 可能需要调整以适应项目需求

4. **集成工具函数**
   - 使用 timeline 和 media-processing 工具
   - 适配导出和缓存功能

## 下一步

查看具体的编辑器组件实现，了解如何集成到当前项目中。

