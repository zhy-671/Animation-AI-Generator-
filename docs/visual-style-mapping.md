# 画风选择对应值映射表

## 设置页面画风选项 (project-create-form.tsx)

| 显示标签 | value 值 | 说明 |
|---------|----------|------|
| 2D动画 | `"2d"` | 2D动画风格 |
| 3D动漫 | `"3d"` | 3D动漫风格 |
| 日本二次元 | `"anime"` | 日本二次元风格 |
| 赛博朋克 | `"cyberpunk"` | 赛博朋克风格 |
| 粘土动画 | `"clay"` | 粘土动画风格 |
| 美式漫画 | `"comic"` | 美式漫画风格 |
| 卡通风格 | `"cartoon"` | 卡通风格 |
| 3D卡通 | `"realistic"` | 3D卡通风格（注意：value是"realistic"） |

## 生成图片时的提示词映射 (character-edit-modal.tsx)

| value 值 | 对应的英文提示词 |
|---------|-----------------|
| `"2d"` | `"2D animation style"` |
| `"3d"` | `"3D animation style, 3D rendered"` |
| `"anime"` | `"anime style, Japanese animation"` |
| `"cyberpunk"` | `"cyberpunk style, futuristic"` |
| `"clay"` | `"clay animation style, stop motion"` |
| `"comic"` | `"comic book style, Western comic"` |
| `"cartoon"` | `"cartoon style, animated"` |
| `"realistic"` | `"realistic style, photorealistic"` |

## 数据流程

1. **设置页面选择** → 用户点击画风选项，`value` 值保存到 `formData.visualStyle`
2. **传递给弹窗** → `visualStyle={formData.visualStyle}` 传递给 `CharacterEditModal`
3. **生成图片** → `buildImagePrompt` 函数使用 `styleMap[visualStyle]` 查找对应的提示词
4. **构建提示词** → 提示词添加到图片生成请求中

## 注意事项

- ✅ 所有画风选项的 `value` 值都在 `styleMap` 中有对应的映射
- ✅ 如果找不到对应的映射，会使用默认值 `"2d"` → `"2D animation style"`
- ⚠️ `"realistic"` 的显示标签是"3D卡通"，但 value 值是 `"realistic"`，提示词是 `"realistic style, photorealistic"`








