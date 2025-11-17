# OpenCut 集成文档

## 概述

本文档说明如何将 [OpenCut](https://github.com/OpenCut-app/OpenCut) 视频编辑器集成到当前项目中。

## OpenCut 简介

OpenCut 是一个开源的视频编辑器，提供：
- Timeline-based editing（基于时间轴的编辑）
- Multi-track support（多轨道支持）
- Real-time preview（实时预览）
- No watermarks or subscriptions（无水印、无订阅）

## 集成方案

### 方案 1: 直接集成核心组件（推荐）

1. **克隆 OpenCut 仓库**
   ```bash
   git clone https://github.com/OpenCut-app/OpenCut.git
   cd OpenCut/apps/web
   ```

2. **查看核心组件结构**
   - `src/components/` - UI 和编辑器组件
   - `src/hooks/` - 自定义 React hooks
   - `src/lib/` - 工具和 API 逻辑
   - `src/stores/` - 状态管理（Zustand）

3. **提取所需组件**
   - Timeline 组件
   - Track 组件
   - Preview 组件
   - Control bar 组件

4. **安装依赖**
   ```bash
   npm install zustand  # 如果使用状态管理
   ```

### 方案 2: 使用 iframe 嵌入（简单但受限）

如果 OpenCut 提供了独立部署版本，可以通过 iframe 嵌入：

```tsx
<iframe 
  src="https://opencut.app/editor" 
  className="w-full h-full"
  allow="camera; microphone; fullscreen"
/>
```

### 方案 3: 参考架构重新实现（当前方案）

基于 OpenCut 的架构和设计理念，创建符合项目需求的编辑器组件。

## 当前实现

已创建 `opencut-editor.tsx` 组件作为集成入口点。

### 下一步计划

1. **研究 OpenCut 的核心组件**
   - Timeline 实现
   - Track 管理
   - 视频预览
   - 控制条

2. **提取和适配组件**
   - 复制相关组件代码
   - 适配项目的数据结构
   - 调整样式以匹配项目主题

3. **集成状态管理**
   - 使用 Zustand 或 React Context
   - 管理视频轨道、字幕、配音等状态

4. **实现核心功能**
   - 视频加载和预览
   - 时间轴编辑
   - 轨道操作（添加、删除、移动）
   - 导出功能

## 参考资源

- [OpenCut GitHub](https://github.com/OpenCut-app/OpenCut)
- [OpenCut 官网](https://opencut.app)
- [OpenCut 文档](https://github.com/OpenCut-app/OpenCut/blob/main/README.md)

## 注意事项

1. **许可证**: OpenCut 使用 MIT 许可证，可以自由使用和修改
2. **依赖**: 确保安装所有必需的依赖包
3. **兼容性**: 检查 React 和 Next.js 版本兼容性
4. **性能**: 大型视频文件可能需要优化处理

