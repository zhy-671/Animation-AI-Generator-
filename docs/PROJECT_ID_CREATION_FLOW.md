# 项目 ID 创建和存储流程

## 概述

项目 ID 是项目的唯一标识符，由数据库自动生成（UUID 格式），在项目创建时自动分配并存储到数据库中。

## 项目 ID 的生成方式

项目 ID 由 PostgreSQL 数据库自动生成，使用 `gen_random_uuid()` 函数：

```sql
CREATE TABLE IF NOT EXISTS public.anim_storyboard_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... 其他字段
);
```

- **类型**：UUID（通用唯一标识符）
- **生成方式**：数据库自动生成（`DEFAULT gen_random_uuid()`）
- **特点**：全局唯一，无需手动指定

## 项目 ID 的创建时机

项目 ID 在以下两种情况下创建：

### 1. 通过 `/api/storyboard/projects` POST 端点创建

**位置**：`app/api/storyboard/projects/route.ts`

**触发场景**：
- 用户在故事内容编辑器中点击"下一步"按钮
- 前端调用 `POST /api/storyboard/projects` 创建新项目

**流程**：
```typescript
// 1. 前端发送请求
const response = await fetch("/api/storyboard/projects", {
  method: "POST",
  body: JSON.stringify({
    title: title,
    content: content,
    story_outline: story_outline
  })
});

// 2. 后端插入数据库（项目 ID 自动生成）
const { data: project, error: insertError } = await supabase
  .from("anim_storyboard_projects")
  .insert(insertData)
  .select()
  .single();

// 3. 返回项目 ID
return NextResponse.json({
  success: true,
  data: {
    id: project.id,  // ← 项目 ID 在这里返回
    title: project.title,
    // ...
  }
});
```

**相关前端代码**：
- `components/storyboard/story-content-editor.tsx` (第 228-247 行)
- `components/storyboard/story-script-page.tsx` (第 286-307 行)

### 2. 通过 `/api/storyboard/create-project` POST 端点创建

**位置**：`app/api/storyboard/create-project/route.ts`

**触发场景**：
- 用户在项目创建表单中点击"生成分镜"按钮
- 如果 URL 中没有 `projectId` 参数，或者项目不存在，则创建新项目

**流程**：
```typescript
// 1. 检查是否有 projectId
let projectId = project_id; // 从请求参数获取

// 2. 如果有 projectId，尝试更新现有项目
if (projectId) {
  const { data: updatedProject, error: updateError } = await supabase
    .from("anim_storyboard_projects")
    .update({ /* ... */ })
    .eq("id", projectId)
    .select()
    .single();
  
  if (updatedProject) {
    projectId = updatedProject.id;
  } else {
    projectId = null; // 项目不存在，重置为 null
  }
}

// 3. 如果没有 projectId 或更新失败，创建新项目
if (!projectId) {
  const { data: newProject, error: insertError } = await supabase
    .from("anim_storyboard_projects")
    .insert({
      user_id: user.id,
      title: projectTitle,
      content: "",
      status_script: true,
      status_settings: false,
      status_storyboard: false,
      status_video: false,
    })
    .select()
    .single();

  projectId = newProject.id; // ← 项目 ID 在这里获取
}
```

**相关前端代码**：
- `components/storyboard/project-create-form.tsx` (第 356-462 行)

## 项目 ID 的存储位置

### 数据库存储

项目 ID 存储在 `anim_storyboard_projects` 表中：

```sql
-- 主表
anim_storyboard_projects
  - id (UUID, PRIMARY KEY) ← 项目 ID 存储在这里

-- 关联表（通过 project_id 外键关联）
anim_story_scripts
  - project_id (UUID, FOREIGN KEY)
anim_story_outlines
  - project_id (UUID, FOREIGN KEY)
anim_characters
  - project_id (UUID, FOREIGN KEY)
anim_scenes
  - project_id (UUID, FOREIGN KEY)
anim_project_step_status
  - project_id (UUID, FOREIGN KEY)
```

### 前端存储

项目 ID 在前端通过以下方式存储和传递：

1. **SessionStorage**：
   ```typescript
   sessionStorage.setItem("storyboardProjectId", projectId);
   ```

2. **URL 参数**：
   ```typescript
   router.push(`/storyboard/project/${projectId}/create`);
   // 或
   router.push(`/storyboard/create?projectId=${projectId}`);
   ```

3. **路由参数**（Next.js 动态路由）：
   ```typescript
   // 路由：/storyboard/project/[id]/create
   // URL：/storyboard/project/123e4567-e89b-12d3-a456-426614174000/create
   // 组件通过 params.id 获取项目 ID
   ```

## 项目 ID 的使用流程

### 完整流程示例

1. **用户创建故事内容**
   ```
   用户输入 → 点击"下一步" → POST /api/storyboard/projects
   → 数据库插入 → 返回项目 ID → 存储到 sessionStorage
   → 跳转到 /storyboard/project/{projectId}/create
   ```

2. **用户编辑项目设置**
   ```
   访问 /storyboard/project/{projectId}/create
   → 从 URL 参数获取 projectId
   → 加载项目数据
   → 显示项目设置表单
   ```

3. **用户生成分镜**
   ```
   点击"生成分镜" → POST /api/storyboard/create-project?projectId={projectId}
   → 如果项目不存在，创建新项目并返回新的 projectId
   → 生成分镜数据并保存
   ```

## 关键代码位置

### 后端 API

- **创建项目**：`app/api/storyboard/projects/route.ts` (POST)
- **创建项目并生成内容**：`app/api/storyboard/create-project/route.ts` (POST)
- **查询项目步骤状态**：`app/api/storyboard/project-step-status/route.ts` (GET)

### 前端组件

- **项目创建表单**：`components/storyboard/project-create-form.tsx`
- **故事内容编辑器**：`components/storyboard/story-content-editor.tsx`
- **故事脚本页面**：`components/storyboard/story-script-page.tsx`

### 数据库迁移

- **项目表结构**：`supabase/migrations/010_create_storyboard_projects.sql`
- **项目步骤状态表**：`supabase/migrations/014_create_project_step_status.sql`

## 注意事项

1. **项目 ID 是自动生成的**：不需要在前端或后端手动生成 UUID
2. **项目 ID 在插入时生成**：只有在数据库插入操作成功后才会有项目 ID
3. **项目 ID 是全局唯一的**：使用 UUID 格式，确保全局唯一性
4. **项目 ID 不可修改**：一旦创建，项目 ID 不会改变
5. **项目 ID 用于关联**：所有相关的数据表都通过 `project_id` 外键关联到项目

## 相关表结构

```sql
-- 主项目表
anim_storyboard_projects
  id (UUID, PRIMARY KEY) ← 项目 ID

-- 项目步骤状态表（自动创建）
anim_project_step_status
  project_id (UUID, FOREIGN KEY) ← 关联项目 ID
  step_script (BOOLEAN)
  step_settings (BOOLEAN)
  step_storyboard (BOOLEAN)
  step_video (BOOLEAN)

-- 其他关联表
anim_story_scripts (project_id)
anim_story_outlines (project_id)
anim_characters (project_id)
anim_scenes (project_id)
```

## 总结

- **创建时机**：在数据库插入 `anim_storyboard_projects` 表时自动生成
- **存储位置**：数据库主表 `id` 字段（UUID 类型）
- **获取方式**：通过 `.select().single()` 在插入后获取
- **传递方式**：通过 API 响应返回给前端，前端存储在 sessionStorage 和 URL 中
- **使用场景**：用于关联所有项目相关的数据（脚本、大纲、角色、场景等）

