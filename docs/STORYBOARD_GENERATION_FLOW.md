# 分镜生成完整流程文档

## 概述

分镜生成功能使用 **通义千问（Qwen2）** 生成结构化分镜脚本，然后使用 **通义万相（WanX）** 依次生成对应的图像，最后整合成完整的分镜预览。

## 完整流程

### 1. 前端触发（`components/generator/animation-generator-form.tsx`）

#### 1.1 用户操作
- 用户输入文本提示词
- 选择动画风格（2d、3d、anime等）
- 勾选"分镜模式"复选框
- 点击"生成分镜"按钮

#### 1.2 前置检查
```typescript
// 检查积分余额（需要20积分）
const STORYBOARD_CREDITS = 20;
const balanceCheck = await checkCreditsBalance(STORYBOARD_CREDITS);

if (!balanceCheck.sufficient) {
  alert("积分不足！");
  return;
}
```

#### 1.3 发送请求
```typescript
// 构建 FormData
const formDataToSend = new FormData();
formDataToSend.append("prompt", `${textPrompt}，${stylePrompt}`);
formDataToSend.append("style", model); // 动画风格
formDataToSend.append("readerGroup", readerGroup);

// 发送到后端 API
const response = await fetch("/api/scenes/generate", {
  method: "POST",
  body: formDataToSend,
});
```

---

### 2. 后端处理（`app/api/scenes/generate/route.ts`）

#### 2.1 接收请求
- 解析 FormData：`prompt`、`style`、`readerGroup`、`referenceImage`（可选）
- 验证用户身份（Supabase Auth）

#### 2.2 步骤1：生成分镜JSON（Qwen2）
```typescript
// 调用通义千问生成结构化分镜脚本
const storyboardData = await qwen2Client.generateStoryboard({
  prompt: prompt,
  style: style,
});
```

**Qwen2 返回的数据结构：**
```json
{
  "title": "动漫标题",
  "summary": "故事概要",
  "style": "画风风格描述",
  "scenes": [
    {
      "scene_id": 1,
      "scene_title": "场景标题",
      "description": "画面描述",
      "camera": "镜头语言",
      "dialogue": ["对白1", "对白2"],
      "image_prompt": "英文图像提示词",
      "duration": "持续时间（秒）"
    }
  ]
}
```

#### 2.3 步骤2：立即保存分镜脚本到数据库
```typescript
// 创建分镜主记录（anim_scenes表）
const scene = await createScene({
  title: storyboardData.title,
  summary: storyboardData.summary,
  scenes: storyboardData.scenes.map((scene) => ({
    sceneNumber: scene.scene_id,
    text: scene.description,
    sceneDetail: scene.description,
    sceneTitle: scene.scene_title,
    camera: scene.camera,
    dialogue: scene.dialogue,
    sceneDuration: scene.duration,
    imageUrl: null, // ⚠️ 初始为null，图片生成成功后会更新
  })),
  fullJsonData: { /* 完整JSON数据 */ },
});

// 获取分镜项ID（用于后续更新图片URL）
const sceneItems = await supabase
  .from('anim_scene_items')
  .select('id, scene_number')
  .eq('scene_id', scene.id)
  .order('scene_number');
```

**数据库表结构：**
- `anim_scenes`：分镜主表（title, summary, metadata）
- `anim_scene_items`：分镜项表（scene_number, text, scene_detail, image_url, metadata）

#### 2.4 步骤3：依次生成图片（WanX）

**重要：采用顺序生成策略，避免API限流**

```typescript
for (let i = 0; i < storyboardData.scenes.length; i++) {
  const sceneItem = sceneItems[i];
  const scene = storyboardData.scenes[i];
  
  // 3.1 提交图像生成任务
  const task = await wanXImageClient.submitImageTask({
    prompt: scene.image_prompt, // Qwen2生成的英文提示词
    style: style,
    size: "1280*1280",
    n: 1,
  });
  
  // 3.2 轮询任务状态（优化的轮询策略）
  const status = await wanXImageClient.pollImageTaskStatus(task.taskId, {
    initialInterval: 3000,    // 前30秒每3秒查询一次
    maxInterval: 10000,       // 之后最多每10秒查询一次
    initialPeriod: 30000,     // 初始快速轮询周期30秒
    timeout: 120000,          // 总超时时间2分钟
  });
  
  // 3.3 图片生成成功后的处理
  if (status.status === "SUCCEEDED" && status.images) {
    const imageUrl = status.images[0];
    
    // 3.3.1 上传到火山引擎TOS存储
    try {
      const filename = `${userId}/scene-${Date.now()}-${i}.png`;
      uploadedImageUrl = await tosClient.uploadImageFromUrl(imageUrl, filename);
    } catch (uploadError) {
      // 如果TOS上传失败，使用DashScope返回的原始URL
      uploadedImageUrl = imageUrl;
    }
    
    // 3.3.2 更新数据库中的图片URL
    await supabase
      .from('anim_scene_items')
      .update({ image_url: uploadedImageUrl })
      .eq('id', sceneItem.id);
  } else {
    // 图片生成失败，标记为失败但继续处理
    imageGenerationFailed = true;
  }
  
  // 3.4 等待1秒再提交下一个任务（避免速率限制）
  if (i < storyboardData.scenes.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

**轮询策略说明：**
- **前30秒**：每3秒查询一次（快速响应）
- **30秒后**：间隔逐渐增加，最多每10秒查询一次（避免限流）
- **总超时**：2分钟（120秒）

#### 2.5 步骤4：返回结果
```typescript
return NextResponse.json({
  success: true,
  data: {
    sceneId: scene.id,              // 分镜主记录ID
    title: storyboardData.title,
    summary: storyboardData.summary,
    scenes: [
      {
        text: scene.description,
        sceneDetail: scene.description,
        imageUrl: uploadedImageUrl || null,  // 图片URL或null
        sceneNumber: scene.scene_id,
        sceneTitle: scene.scene_title,
        camera: scene.camera,
        dialogue: scene.dialogue,
        duration: scene.duration,
        imageGenerationFailed: false,         // 图片生成是否失败
        sceneItemId: sceneItem.id,            // 分镜项ID（用于前端更新）
      }
    ],
    fullJsonData: { /* 完整JSON数据 */ },
  },
});
```

---

### 3. 前端接收并显示（`components/generator/animation-generator-form.tsx`）

#### 3.1 接收响应
```typescript
const result = await response.json();

if (result.success && result.data) {
  // 映射后端返回的数据到前端状态
  const newImages: GeneratedImage[] = result.data.scenes.map((scene, index) => ({
    id: `img-${Date.now()}-${index}`,
    imageUrl: scene.imageUrl || null,
    text: scene.text,
    sceneDetail: scene.sceneDetail,
    sceneTitle: scene.sceneTitle,
    camera: scene.camera,
    dialogue: scene.dialogue,
    sceneDuration: scene.duration,
    sceneItemId: scene.sceneItemId,  // 用于后续更新数据库
    imageGenerationFailed: scene.imageGenerationFailed,
  }));
```

#### 3.2 更新状态
```typescript
// 1. 先设置分镜数据
setGeneratedImages(newImages);

// 2. 设置sceneId
setCurrentSceneId(result.data.sceneId);

// 3. 立即更新 isGenerating 状态
setIsGenerating(false);

// 4. 强制触发重新渲染
await new Promise(resolve => setTimeout(resolve, 0));
```

#### 3.3 扣除积分
```typescript
const deductResult = await deductStoryboardCredits({
  sceneId: result.data.sceneId,
  sceneCount: newImages.length,
});

if (!deductResult.success) {
  // 延迟显示alert，确保UI已更新
  setTimeout(() => {
    alert(`分镜生成成功，但积分扣除失败：${deductResult.error}`);
  }, 500);
} else {
  // 更新积分余额显示
  const updatedBalance = await checkCreditsBalance(0);
  setCreditsBalance(updatedBalance.balance);
}
```

#### 3.4 滚动到预览区域
```typescript
setTimeout(() => {
  const previewSection = document.getElementById('scene-preview-section');
  if (previewSection) {
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}, 300);
```

---

### 4. 分镜预览区域显示逻辑

#### 4.1 显示条件
```typescript
{formData.inputType === "text" && isSceneMode && (
  <div id="scene-preview-section">
    {isGenerating && generatedImages.length === 0 ? (
      // 显示"生成中..."
    ) : generatedImages.length > 0 ? (
      // 显示分镜预览（即使图片还在生成或失败）
    ) : null}
  </div>
)}
```

#### 4.2 每个分镜项的显示
- **场景编号**：`sceneNumber`
- **场景标题**：`sceneTitle`
- **画面描述**：`text` / `sceneDetail`
- **镜头语言**：`camera`
- **对白**：`dialogue`（数组）
- **持续时间**：`duration`
- **图片显示**：
  - 如果 `imageUrl` 存在 → 显示图片
  - 如果 `imageGenerationFailed && !imageUrl` → 显示默认占位图
  - 否则 → 显示上传图片占位符
- **生成视频按钮**：
  - 如果 `!imageUrl` → 禁用按钮
  - 否则 → 可以生成视频

---

### 5. 用户操作更新数据库

#### 5.1 删除图片
```typescript
// 前端：更新本地状态
setGeneratedImages(prev => prev.map(img => 
  img.id === imageId ? { ...img, imageUrl: '' } : img
));

// 调用API更新数据库
await fetch(`/api/scenes/items/${sceneItemId}`, {
  method: "PATCH",
  body: JSON.stringify({ imageUrl: null }),
});
```

#### 5.2 上传图片
```typescript
// 1. 上传到TOS存储
const uploadResponse = await fetch('/api/scenes/upload-image', {
  method: 'POST',
  body: formData,
});

// 2. 获取上传后的URL
const imageUrl = uploadResult.data.url;

// 3. 更新本地状态
setGeneratedImages(prev => prev.map(img => 
  img.id === imageId ? { ...img, imageUrl } : img
));

// 4. 更新数据库
await fetch(`/api/scenes/items/${sceneItemId}`, {
  method: "PATCH",
  body: JSON.stringify({ imageUrl }),
});
```

#### 5.3 重新生成图片
- 前端调用 `/api/scenes/generate`（如果需要重新生成整个分镜）
- 或调用图像生成API单独生成某个场景的图片
- 成功后更新数据库中的 `image_url`

---

## 数据库表结构

### `anim_scenes`（分镜主表）
- `id`：主键
- `user_id`：用户ID
- `title`：标题
- `summary`：概要
- `cover_image_url`：封面图URL
- `metadata`：完整JSON数据（JSONB）
- `created_at`、`updated_at`：时间戳

### `anim_scene_items`（分镜项表）
- `id`：主键
- `scene_id`：关联分镜主表ID
- `scene_number`：场景编号
- `text`：文本描述
- `scene_detail`：画面描述
- `image_url`：图片URL（初始为null，图片生成成功后更新）
- `video_url`：视频URL（生成视频后更新）
- `metadata`：元数据（JSONB，包含scene_title、camera、dialogue、scene_duration）
- `created_at`、`updated_at`：时间戳

---

## 关键技术点

### 1. JSON解析和清理（`lib/dashscope/qwen2.ts`）
- **问题**：Qwen2返回的JSON可能包含中文引号、控制字符等
- **解决方案**：
  1. 提取JSON对象（使用大括号计数）
  2. 清理控制字符（`cleanJsonString`函数）
  3. 替换中文引号为ASCII引号
  4. 修复数组格式问题（状态机方法）
  5. 多次尝试解析，逐步修复

### 2. 图片生成策略（`lib/dashscope/wanx-image.ts`）
- **异步API**：使用 `/image-synthesis` 端点
- **任务提交**：返回 `taskId`
- **状态轮询**：使用 `/tasks/{taskId}` 查询状态
- **轮询策略**：
  - 前30秒：每3秒查询一次
  - 30秒后：间隔逐渐增加（最多10秒）
  - 总超时：2分钟

### 3. 顺序生成避免限流
- **问题**：并行提交多个任务会触发API限流（429错误）
- **解决方案**：
  - 使用 `for` 循环顺序处理
  - 每个任务完成后才提交下一个
  - 任务之间等待1秒

### 4. 数据库更新时机
- **分镜脚本**：Qwen2生成后立即保存（`image_url` 为 `null`）
- **图片URL**：每张图片生成成功后立即更新对应分镜项的 `image_url`
- **用户操作**：删除/上传图片时同步更新数据库

### 5. 错误处理
- **图片生成失败**：标记 `imageGenerationFailed = true`，继续处理其他场景
- **TOS上传失败**：使用DashScope返回的原始URL
- **积分扣除失败**：延迟显示alert，不影响分镜显示

---

## 环境变量配置

```env
# DashScope API配置
DASHSCOPE_API_KEY=sk-xxxxx
QWEN_MODEL=qwen-plus              # Qwen2模型（可选：qwen-max、qwen-turbo）
WANX_IMAGE_MODEL=wan2.5-t2i-preview  # WanX图像模型

# 火山引擎TOS配置
VOLCANO_TOS_ACCESS_KEY_ID=xxxxx
VOLCANO_TOS_SECRET_ACCESS_KEY=xxxxx
VOLCANO_TOS_REGION=cn-hongkong
VOLCANO_TOS_ENDPOINT=https://tos-cn-hongkong.volces.com
VOLC_TOS_BUCKET=storybooks          # 图片存储桶
VOLC_TOS_STORYVIDEO_BUCKET=storyvideo  # 视频存储桶
```

---

## 积分消耗规则

- **分镜生成**：固定消耗 **20积分**
- **扣除时机**：分镜生成成功后立即扣除
- **扣除失败处理**：显示警告，但不影响分镜显示

---

## 总结

1. **分镜脚本先保存**：Qwen2生成JSON后立即保存到数据库（图片URL为null）
2. **图片依次生成**：使用顺序策略，避免API限流
3. **实时更新数据库**：每张图片生成成功后立即更新对应分镜项的图片URL
4. **前端立即显示**：收到响应后立即显示分镜脚本，即使图片还在生成
5. **用户操作同步**：删除/上传图片时同步更新数据库

