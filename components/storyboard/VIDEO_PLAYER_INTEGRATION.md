# 视频播放器集成说明

## 概述

已成功集成了两个开源视频播放器库，用于改进视频编辑和预览功能：

1. **react-player** - 轻量级、功能丰富的 React 视频播放器
2. **Video.js** - 专业级视频播放器，支持多种格式和插件

## 已安装的依赖

```json
{
  "react-player": "^2.x.x",
  "video.js": "^8.x.x",
  "@videojs/themes": "^1.x.x"
}
```

## 组件说明

### 1. EnhancedVideoPlayer (react-player)

**位置**: `components/storyboard/enhanced-video-player.tsx`

**特点**:
- 基于 react-player，支持多种视频格式（MP4, WebM, HLS, DASH等）
- 轻量级，易于集成
- 支持播放控制、音量控制、进度跟踪
- 自动处理跨域和播放错误

**使用示例**:
```tsx
<EnhancedVideoPlayer
  url={videoUrl}
  isPlaying={isPlaying}
  volume={volume}
  isMuted={isMuted}
  currentTime={currentTime}
  onPlay={() => setIsPlaying(true)}
  onPause={() => setIsPlaying(false)}
  onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
  onDuration={(duration) => setTotalDuration(duration)}
  onEnded={() => switchToNextVideo()}
/>
```

### 2. VideoJSPlayer (Video.js)

**位置**: `components/storyboard/videojs-player.tsx`

**特点**:
- 专业级视频播放器
- 支持插件系统
- 高度可定制
- 支持多种视频格式和流媒体协议

**使用示例**:
```tsx
<VideoJSPlayer
  options={{
    autoplay: false,
    controls: true,
    responsive: true,
    fluid: true,
    sources: [{
      src: videoUrl,
      type: 'video/mp4'
    }]
  }}
  onReady={(player) => console.log('Player ready', player)}
  onPlay={() => setIsPlaying(true)}
  onPause={() => setIsPlaying(false)}
/>
```

## 在 VideoEditor 中的使用

`video-editor.tsx` 现在支持两种播放器模式：

1. **react-player** (默认) - 使用 `EnhancedVideoPlayer` 组件
2. **native** - 使用原生 HTML5 video 元素

可以通过 `playerType` 状态变量切换播放器类型：

```tsx
const [playerType, setPlayerType] = useState<"native" | "react-player">("react-player");
```

## 优势对比

### react-player 优势
- ✅ 轻量级，包体积小
- ✅ 支持多种视频源（YouTube, Vimeo, 本地文件等）
- ✅ React 原生支持，易于集成
- ✅ 自动处理格式兼容性

### Video.js 优势
- ✅ 专业级功能
- ✅ 丰富的插件生态
- ✅ 高度可定制
- ✅ 支持高级流媒体协议（HLS, DASH）

### 原生 video 元素优势
- ✅ 零依赖
- ✅ 浏览器原生支持
- ✅ 性能最优

## 未来改进建议

1. **添加播放器选择器**: 在设置中允许用户选择偏好的播放器
2. **集成 FFmpeg.wasm**: 用于客户端视频处理（裁剪、合并等）
3. **添加视频预览缩略图**: 使用 react-player 的 `light` 模式
4. **支持更多视频格式**: 通过 Video.js 插件扩展格式支持
5. **添加播放速度控制**: 两个播放器都支持播放速度调整

## 故障排除

### react-player 相关问题
- 如果视频无法播放，检查 CORS 设置
- 确保视频 URL 格式正确
- 检查浏览器控制台的错误信息

### Video.js 相关问题
- 确保正确导入 CSS 文件
- 检查视频格式是否被浏览器支持
- 查看 Video.js 控制台日志

## 参考资料

- [react-player 文档](https://github.com/cookpete/react-player)
- [Video.js 文档](https://videojs.com/)
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/)

