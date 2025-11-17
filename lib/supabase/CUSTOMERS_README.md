# Supabase 客户和积分管理系统

## 概述

这个系统提供了完整的用户客户管理和积分管理功能，包括：
- 自动为新注册用户创建客户记录
- 自动赠送初始积分（5积分）
- 积分历史记录追踪
- 积分操作（添加、扣除、过期、退款）

## 数据库结构

### 表结构

#### anim_customers
存储用户客户信息

#### credits_history
存储所有积分变动历史

详细结构请参考 `supabase/migrations/001_create_anim_customers.sql`

## 使用方法

### 1. 执行数据库迁移

在 Supabase Dashboard 的 SQL Editor 中执行 `supabase/migrations/001_create_anim_customers.sql`

### 2. 在代码中使用

#### 服务端组件 / API Routes

```typescript
import { getCurrentCustomer, getCredits, getCreditsHistory } from '@/lib/supabase/customers'

// 获取当前用户的客户信息
const customer = await getCurrentCustomer()

// 获取积分余额
const credits = await getCredits()

// 获取积分历史
const history = await getCreditsHistory(50)
```

#### 客户端组件

```typescript
'use client'
import { getCurrentCustomerClient, getCreditsClient } from '@/lib/supabase/customers-client'

// 获取客户信息和积分
const customer = await getCurrentCustomerClient()
const credits = await getCreditsClient()
```

### 3. API 端点

#### GET /api/credits/balance
获取当前用户的积分余额

```typescript
const response = await fetch('/api/credits/balance')
const { credits, customerId } = await response.json()
```

#### GET /api/credits/history?limit=50
获取积分历史记录

```typescript
const response = await fetch('/api/credits/history?limit=50')
const { history, count } = await response.json()
```

#### POST /api/credits/operate
操作积分（添加、扣除等）

```typescript
const response = await fetch('/api/credits/operate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerId: 'customer-uuid',
    amount: 10,
    type: 'add', // 'add' | 'subtract' | 'expire' | 'refund'
    description: 'Purchase credits',
    metadata: { source: 'payment' }
  })
})
```

## 自动功能

### 新用户注册

当新用户在 `auth.users` 表中注册时，系统会自动：
1. 创建 `anim_customers` 记录
2. 赠送 5 个初始积分
3. 在 `credits_history` 中记录赠送历史

### 现有用户迁移

首次执行迁移脚本时，会为所有现有用户：
1. 创建 `anim_customers` 记录
2. 赠送 5 个初始积分
3. 记录积分历史

## 安全策略 (RLS)

- 用户只能查看和更新自己的客户记录
- 用户只能查看自己的积分历史记录
- 所有操作都通过 RLS 策略保护

## 类型定义

```typescript
import type { AnimCustomer, CreditsHistory, CreditOperationParams } from '@/lib/supabase/types'
```

## 注意事项

1. **积分操作**：所有积分操作都应该通过 API Route (`/api/credits/operate`) 进行，确保安全性和一致性
2. **积分检查**：在执行需要消耗积分的操作前，先检查积分是否足够
3. **历史记录**：所有积分变动都会自动记录到 `credits_history` 表中
4. **事务性**：积分操作和历史记录是原子性的，如果历史记录失败，积分更新会回滚

