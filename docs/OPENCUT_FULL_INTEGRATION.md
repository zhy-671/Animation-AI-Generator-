# OpenCut 完整集成指南

本文档说明如何将 OpenCut 编辑器的全部功能集成到项目中。

## 前提条件

1. OpenCut 源代码已下载到 `OpenCut-main/` 目录
2. Node.js 环境已配置

## 集成步骤

### 1. 运行集成脚本

```bash
node scripts/integrate-opencut.js
```

这个脚本会：
- 复制 OpenCut 的核心文件到 `lib/opencut/`
- 适配所有导入路径

### 2. 更新 tsconfig.json

在 `tsconfig.json` 的 `paths` 中添加：

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/lib/opencut/*": ["./lib/opencut/*"]
    }
  }
}
```

### 3. 安装依赖

检查 `OpenCut-main/apps/web/package.json` 并安装缺失的依赖：

```bash
npm install @ffmpeg/core @ffmpeg/ffmpeg @ffmpeg/util
npm install react-resizable-panels
npm install @hello-pangea/dnd
# ... 其他依赖
```

### 4. 更新 opencut-editor.tsx

更新 `components/storyboard/opencut-editor.tsx` 以使用复制的组件：

```tsx
import { PreviewPanel } from "@/lib/opencut/components/editor/preview-panel";
import { Timeline } from "@/lib/opencut/components/editor/timeline";
import { MediaPanel } from "@/lib/opencut/components/editor/media-panel";
import { PropertiesPanel } from "@/lib/opencut/components/editor/properties-panel";
import { EditorProvider } from "@/lib/opencut/components/providers/editor-provider";
// ... 其他导入
```

### 5. 配置 OpenCut Stores

确保 OpenCut 的 stores 正确初始化：

- `useProjectStore` - 项目管理
- `useTimelineStore` - 时间线状态
- `useMediaStore` - 媒体文件管理
- `usePlaybackStore` - 播放控制
- `usePanelStore` - 面板布局

### 6. 数据适配

在 `opencut-editor.tsx` 中，将 `videoClips` 转换为 OpenCut 的格式：

```tsx
// 添加媒体文件到 media store
videoClips.forEach((clip) => {
  addMediaFile({
    id: clip.id,
    url: clip.url,
    name: `Clip ${clip.sceneNumber}-${clip.shotNumber}`,
    type: 'video',
    thumbnail: clip.thumbnail,
    duration: clip.duration,
  });
});

// 创建时间线轨道
const timelineTrack = {
  id: "track-media-1",
  name: "Video Track",
  type: "media",
  elements: videoClips.map((clip) => ({
    id: clip.id,
    name: `Clip ${clip.sceneNumber}-${clip.shotNumber}`,
    duration: clip.duration,
    startTime: clip.startTime,
    trimStart: 0,
    trimEnd: 0,
    type: "media",
    mediaId: clip.id,
  })),
  muted: false,
  isMain: true,
};
```

## OpenCut 功能特性

集成后，你将获得：

1. **完整的时间线编辑**
   - 多轨道支持（视频、音频、文本）
   - 拖拽排序
   - 裁剪和调整
   - 吸附对齐

2. **实时预览**
   - Canvas 渲染
   - 帧缓存优化
   - 音频同步播放

3. **媒体管理**
   - 媒体库面板
   - 拖拽添加媒体
   - 缩略图预览

4. **属性编辑**
   - 元素属性面板
   - 文本编辑
   - 音频控制

5. **导出功能**
   - 视频导出
   - 无水印

## 故障排除

### 导入路径错误

如果遇到导入路径错误，检查：
1. `tsconfig.json` 中的路径配置
2. 复制的文件路径是否正确
3. 导入语句是否已适配

### 依赖缺失

运行 `npm install` 安装所有依赖，特别是：
- `@ffmpeg/*` - 视频处理
- `react-resizable-panels` - 可调整面板
- `@hello-pangea/dnd` - 拖拽功能

### Store 初始化错误

确保在使用 OpenCut 组件前初始化所有必要的 stores。

## 参考

- OpenCut 官方仓库: https://github.com/OpenCut-app/OpenCut
- OpenCut 文档: 查看 `OpenCut-main/` 目录中的文档

