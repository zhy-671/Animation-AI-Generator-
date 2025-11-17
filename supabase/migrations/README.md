# Supabase 数据库迁移说明

## 文件说明

`001_create_anim_customers.sql` - 创建用户客户表和积分历史表的迁移脚本

## 执行步骤

### 方法 1: 通过 Supabase Dashboard 执行

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 点击 **New query**
5. 复制 `001_create_anim_customers.sql` 文件中的所有内容
6. 粘贴到 SQL Editor 中
7. 点击 **Run** 执行

### 方法 2: 通过 Supabase CLI 执行

```bash
# 安装 Supabase CLI（如果还没有）
npm install -g supabase

# 登录 Supabase
supabase login

# 链接到你的项目
supabase link --project-ref your-project-ref

# 执行迁移
supabase db push
```

## 表结构说明

### anim_customers 表

存储用户客户信息，每个用户对应一条记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 关联 auth.users.id，唯一 |
| email | TEXT | 用户邮箱 |
| credits | INTEGER | 积分余额，默认5 |
| creem_customer_id | TEXT | Creem 客户ID |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |
| metadata | JSONB | 元数据 |

### credits_history 表

记录所有积分变动历史。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| customer_id | UUID | 关联 anim_customers.id |
| amount | INTEGER | 积分数量 |
| type | TEXT | 类型：add/subtract/expire/refund |
| description | TEXT | 描述 |
| created_at | TIMESTAMPTZ | 创建时间 |
| metadata | JSONB | 元数据 |

## 功能说明

### 自动创建客户记录

当新用户在 `auth.users` 表中注册时，触发器会自动：
1. 在 `anim_customers` 表中创建对应记录
2. 赠送 5 个初始积分
3. 在 `credits_history` 表中记录积分赠送历史

### 现有用户迁移

脚本会自动为所有现有的 `auth.users` 用户创建 `anim_customers` 记录（如果还没有的话），并赠送 5 个初始积分。

### 安全策略 (RLS)

- 用户只能查看和更新自己的客户记录
- 用户只能查看自己的积分历史记录
- 所有操作都通过 RLS 策略保护

## 注意事项

1. **首次执行**：脚本会为所有现有用户创建记录，如果用户很多可能需要一些时间
2. **重复执行**：脚本使用 `CREATE TABLE IF NOT EXISTS`，可以安全地重复执行
3. **触发器**：触发器会在每次新用户注册时自动执行
4. **积分管理**：所有积分变动都应该通过 `credits_history` 表记录，确保可追溯性

