# OpenCut UI 组件对比报告

## OpenCut 中的 UI 组件（共 58 个）

根据 `OpenCut-main/apps/web/src/components/ui` 目录：

1. accordion.tsx
2. alert-dialog.tsx
3. alert.tsx
4. aspect-ratio.tsx
5. audio-player.tsx
6. avatar.tsx
7. badge.tsx
8. breadcrumb.tsx
9. button.tsx ✅
10. calendar.tsx
11. card.tsx ✅
12. carousel.tsx
13. chart.tsx
14. checkbox.tsx ✅
15. collapsible.tsx
16. color-picker.tsx ✅
17. command.tsx
18. context-menu.tsx ✅
19. dialog.tsx ✅
20. draggable-item.tsx (在 lib/opencut/components/ui/)
21. drawer.tsx
22. dropdown-menu.tsx ✅
23. editable-timecode.tsx ✅
24. font-picker.tsx ✅
25. form.tsx
26. hover-card.tsx
27. image-timeline-treatment.tsx
28. input-otp.tsx
29. input-with-back.tsx ✅
30. input.tsx ✅
31. label.tsx ✅
32. menubar.tsx
33. navigation-menu.tsx
34. pagination.tsx
35. phone-input.tsx
36. popover.tsx ✅
37. progress.tsx ✅
38. prose.tsx
39. radio-group.tsx ✅
40. resizable.tsx ✅
41. scroll-area.tsx ✅
42. select.tsx ✅
43. separator.tsx ✅
44. sheet.tsx ✅
45. sidebar.tsx
46. skeleton.tsx
47. slider.tsx ✅
48. sonner.tsx
49. split-button.tsx ✅
50. sponsor-button.tsx
51. switch.tsx
52. table.tsx
53. tabs.tsx ✅
54. textarea.tsx ✅
55. toast.tsx ✅
56. toaster.tsx
57. toggle-group.tsx
58. toggle.tsx
59. tooltip.tsx ✅
60. video-player.tsx

## 项目中已有的 UI 组件（共 25 个）

根据 `components/ui` 目录：

1. button.tsx ✅
2. card.tsx ✅
3. checkbox.tsx ✅
4. color-picker.tsx ✅
5. context-menu.tsx ✅
6. dialog.tsx ✅
7. dropdown-menu.tsx ✅
8. editable-timecode.tsx ✅
9. font-picker.tsx ✅
10. input-with-back.tsx ✅
11. input.tsx ✅
12. label.tsx ✅
13. popover.tsx ✅
14. progress.tsx ✅
15. radio-group.tsx ✅
16. resizable.tsx ✅
17. scroll-area.tsx ✅
18. select.tsx ✅
19. separator.tsx ✅
20. sheet.tsx ✅
21. slider.tsx ✅
22. split-button.tsx ✅
23. tabs.tsx ✅
24. textarea.tsx ✅
25. tooltip.tsx ✅
26. toast.tsx ✅ (项目中有 toast-notification.tsx)

## 缺失的 UI 组件（共 33 个）

以下组件在 OpenCut 中存在，但项目中还没有：

1. **accordion.tsx** - 手风琴组件
2. **alert-dialog.tsx** - 警告对话框
3. **alert.tsx** - 警告提示
4. **aspect-ratio.tsx** - 宽高比组件（在 lib/opencut/components/ui/ 中）
5. **audio-player.tsx** - 音频播放器
6. **avatar.tsx** - 头像组件
7. **badge.tsx** - 徽章组件
8. **breadcrumb.tsx** - 面包屑导航
9. **calendar.tsx** - 日历组件
10. **carousel.tsx** - 轮播图
11. **chart.tsx** - 图表组件
12. **collapsible.tsx** - 可折叠组件
13. **command.tsx** - 命令面板
14. **drawer.tsx** - 抽屉组件
15. **form.tsx** - 表单组件
16. **hover-card.tsx** - 悬停卡片
17. **image-timeline-treatment.tsx** - 图片时间线处理
18. **input-otp.tsx** - OTP 输入
19. **menubar.tsx** - 菜单栏
20. **navigation-menu.tsx** - 导航菜单
21. **pagination.tsx** - 分页组件
22. **phone-input.tsx** - 电话输入
23. **prose.tsx** - 散文样式
24. **sidebar.tsx** - 侧边栏
25. **skeleton.tsx** - 骨架屏
26. **sonner.tsx** - Sonner toast 通知
27. **sponsor-button.tsx** - 赞助按钮
28. **switch.tsx** - 开关组件
29. **table.tsx** - 表格组件
30. **toaster.tsx** - Toast 容器
31. **toggle-group.tsx** - 切换组
32. **toggle.tsx** - 切换按钮
33. **video-player.tsx** - 视频播放器

## 当前 OpenCut 代码中实际使用的组件

根据 `lib/opencut` 目录中的导入分析，以下组件是**实际被使用的**：

✅ **已复制且在使用中：**
- button.tsx
- checkbox.tsx
- color-picker.tsx
- context-menu.tsx
- dialog.tsx
- dropdown-menu.tsx
- editable-timecode.tsx
- font-picker.tsx
- input.tsx
- input-with-back.tsx
- label.tsx
- popover.tsx
- progress.tsx
- resizable.tsx
- scroll-area.tsx
- select.tsx
- separator.tsx
- sheet.tsx
- slider.tsx
- split-button.tsx
- tabs.tsx
- textarea.tsx
- tooltip.tsx

## 建议

1. **优先复制实际使用的组件** - 当前所有被使用的组件都已复制 ✅
2. **按需复制其他组件** - 如果后续功能需要，再复制其他组件
3. **注意特殊组件** - `aspect-ratio.tsx` 和 `draggable-item.tsx` 在 `lib/opencut/components/ui/` 目录中，这是正确的

## 总结

✅ **所有 OpenCut 代码中实际使用的 UI 组件都已复制完成！**

剩余未复制的组件都是 OpenCut 中定义但当前集成代码中未使用的组件。如果后续需要这些功能，可以按需复制。

