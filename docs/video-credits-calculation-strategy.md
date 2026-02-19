# 视频积分计算策略方案

## 一、问题分析

### 当前情况
- 用户可以选择：5秒/10秒时长，480p/720p/1080p分辨率
- 需要根据用户选择计算积分
- 需要防止用户通过选择低分辨率薅羊毛
- 需要确保盈利70%以上

### 核心挑战
1. **用户选择 vs 实际扣除**：用户选择480p，但按720p扣除，可能引起困惑
2. **时长选择**：5秒和10秒应该有不同的积分扣除
3. **防薅羊毛**：必须强制使用高分辨率费率
4. **用户体验**：需要清晰告知用户实际扣除规则

---

## 二、推荐方案

### 方案A：强制高分辨率费率 + 实际时长（推荐）

#### 核心逻辑
- **时长**：按用户实际选择的时长计算（5秒、10秒等）
- **分辨率费率**：根据订阅计划强制使用高分辨率费率
  - Basic订阅：统一按720p费率（15积分/秒）
  - Pro订阅：统一按1080p费率（24积分/秒）
  - Studio订阅：统一按1080p费率（24积分/秒）
  - 充值用户：统一按720p费率（15积分/秒）
  - Free用户：统一按720p费率（15积分/秒）

#### 计算公式
```
积分 = 强制高分辨率费率 × 用户选择时长
```

#### 示例

| 用户类型 | 用户选择 | 实际扣除费率 | 积分计算 | 总积分 |
|---------|---------|------------|---------|--------|
| Basic订阅 | 5秒 480p | 720p费率 | 15 × 5 | **75积分** |
| Basic订阅 | 10秒 720p | 720p费率 | 15 × 10 | **150积分** |
| Pro订阅 | 5秒 480p | 1080p费率 | 24 × 5 | **120积分** |
| Pro订阅 | 10秒 1080p | 1080p费率 | 24 × 10 | **240积分** |
| 充值用户 | 5秒 480p | 720p费率 | 15 × 5 | **75积分** |
| 充值用户 | 10秒 720p | 720p费率 | 15 × 10 | **150积分** |

#### 优势
- ✅ 时长按用户选择，公平合理
- ✅ 强制高分辨率费率，防止薅羊毛
- ✅ 确保盈利70%以上
- ✅ 逻辑清晰，易于实现

---

### 方案B：分辨率升级策略

#### 核心逻辑
- 用户选择的分辨率会被自动升级到对应的高分辨率
- Basic订阅：480p/720p → 720p费率
- Pro订阅：480p/720p/1080p → 1080p费率
- Studio订阅：720p/1080p → 1080p费率

#### UI显示
```
用户选择：5秒 480p
实际生成：5秒 720p（Basic订阅）
扣除积分：75积分（15积分/秒 × 5秒）
```

#### 优势
- ✅ 用户明确知道实际生成的分辨率
- ✅ 防止薅羊毛
- ✅ 提升用户体验（实际生成更高分辨率）

---

### 方案C：阶梯费率策略

#### 核心逻辑
- 根据用户选择的分辨率和时长，使用不同的费率
- 但确保最低费率也能盈利70%以上

#### 费率表

| 用户类型 | 选择分辨率 | 时长 | 积分/秒 | 说明 |
|---------|-----------|------|--------|------|
| Basic订阅 | 480p | 任意 | 15 | 强制720p费率 |
| Basic订阅 | 720p | 任意 | 15 | 标准费率 |
| Pro订阅 | 480p/720p | 任意 | 24 | 强制1080p费率 |
| Pro订阅 | 1080p | 任意 | 24 | 标准费率 |
| Studio订阅 | 720p | 任意 | 24 | 强制1080p费率 |
| Studio订阅 | 1080p | 任意 | 24 | 标准费率 |

#### 优势
- ✅ 费率清晰
- ✅ 防止薅羊毛
- ✅ 确保盈利

---

## 三、最终推荐：方案A + 方案B结合

### 实施策略

#### 1. 后端计算逻辑（已实现）
```typescript
// lib/subscription/rules.ts
export function calculateVideoCredits(
  plan: SubscriptionPlan, 
  resolution: '480p' | '720p' | '1080p', 
  duration: number
): number {
  // 防薅羊毛：强制使用高分辨率费率
  let actualResolution: '480p' | '720p' | '1080p' = resolution;
  
  if (plan === 'basic') {
    actualResolution = '720p'; // Basic强制720p费率
  } else if (plan === 'pro' || plan === 'studio') {
    actualResolution = '1080p'; // Pro/Studio强制1080p费率
  }
  
  const creditsPerSecond = getVideoCreditsPerSecond(plan, actualResolution);
  return Math.ceil(creditsPerSecond * duration); // 按实际时长计算
}
```

#### 2. 前端显示逻辑（需要实现）

##### 积分预览组件
```typescript
function VideoCreditsPreview({ 
  plan, 
  selectedResolution, 
  selectedDuration 
}) {
  // 计算实际扣除费率
  let actualResolution = selectedResolution;
  let creditsPerSecond = 0;
  
  if (plan === 'basic') {
    actualResolution = '720p';
    creditsPerSecond = 15;
  } else if (plan === 'pro' || plan === 'studio') {
    actualResolution = '1080p';
    creditsPerSecond = 24;
  } else {
    // 充值用户或Free用户
    actualResolution = '720p';
    creditsPerSecond = 15;
  }
  
  const totalCredits = creditsPerSecond * selectedDuration;
  
  return (
    <div className="credits-preview">
      <p>您选择：{selectedDuration}秒 {selectedResolution}</p>
      {selectedResolution !== actualResolution && (
        <p className="text-yellow-500">
          ⚠️ {plan === 'basic' ? 'Basic订阅' : plan === 'pro' ? 'Pro订阅' : 'Studio订阅'} 
          将按 {actualResolution} 费率扣除
        </p>
      )}
      <p>扣除积分：{totalCredits}积分（{creditsPerSecond}积分/秒 × {selectedDuration}秒）</p>
    </div>
  );
}
```

##### 分辨率选择器增强
```typescript
function ResolutionSelector({ plan, value, onChange }) {
  const resolutions = getAvailableResolutions(plan);
  
  return (
    <Select value={value} onValueChange={onChange}>
      {resolutions.map(res => (
        <SelectItem key={res} value={res}>
          <div className="flex items-center justify-between">
            <span>{res}</span>
            {plan === 'basic' && res === '480p' && (
              <span className="text-xs text-yellow-500 ml-2">
                (将按720p费率扣除)
              </span>
            )}
            {plan === 'pro' && (res === '480p' || res === '720p') && (
              <span className="text-xs text-yellow-500 ml-2">
                (将按1080p费率扣除)
              </span>
            )}
          </div>
        </SelectItem>
      ))}
    </Select>
  );
}
```

---

## 四、UI/UX优化建议

### 1. 积分预览卡片
在视频生成页面显示：
```
┌─────────────────────────────────┐
│ 视频生成积分预览                  │
├─────────────────────────────────┤
│ 您选择：5秒 480p                  │
│ ⚠️ Basic订阅将按720p费率扣除      │
│                                  │
│ 扣除积分：75积分                  │
│ (15积分/秒 × 5秒)                 │
│                                  │
│ [确认生成]                        │
└─────────────────────────────────┘
```

### 2. 分辨率选择器提示
```
分辨率选择：
○ 480p ⚠️ 将按720p费率扣除（Basic订阅）
● 720p ✓ 标准费率
```

### 3. 时长选择器
```
时长选择：
○ 5秒  → 扣除75积分（15积分/秒 × 5秒）
● 10秒 → 扣除150积分（15积分/秒 × 10秒）
```

### 4. 积分余额检查
```
当前余额：200积分
生成5秒720p视频需要：75积分
生成后余额：125积分
```

---

## 五、实施步骤

### 步骤1：更新积分计算函数（已完成）
- ✅ `calculateVideoCredits` 已实现防薅羊毛机制
- ✅ 按实际时长计算积分

### 步骤2：创建积分预览组件
- 创建 `components/video-credits-preview.tsx`
- 显示用户选择和实际扣除规则
- 实时计算并显示积分

### 步骤3：更新分辨率选择器
- 在选择器中显示实际扣除费率提示
- 区分用户选择和实际扣除

### 步骤4：更新时长选择器
- 显示不同时长的积分扣除
- 实时更新积分预览

### 步骤5：更新积分余额检查
- 使用 `calculateVideoCredits` 检查余额
- 显示生成后余额

---

## 六、代码实现示例

### 积分预览组件实现

```typescript
// components/video-credits-preview.tsx
import { calculateVideoCredits } from '@/lib/subscription/rules';
import { type SubscriptionPlan } from '@/lib/subscription/rules';

interface VideoCreditsPreviewProps {
  plan: SubscriptionPlan;
  selectedResolution: '480p' | '720p' | '1080p';
  selectedDuration: number;
  currentBalance?: number;
}

export function VideoCreditsPreview({
  plan,
  selectedResolution,
  selectedDuration,
  currentBalance,
}: VideoCreditsPreviewProps) {
  // 计算实际扣除费率
  let actualResolution = selectedResolution;
  let creditsPerSecond = 0;
  let rateExplanation = '';
  
  if (plan === 'basic') {
    actualResolution = '720p';
    creditsPerSecond = 15;
    if (selectedResolution === '480p') {
      rateExplanation = 'Basic订阅将按720p费率扣除，防止低分辨率滥用';
    }
  } else if (plan === 'pro' || plan === 'studio') {
    actualResolution = '1080p';
    creditsPerSecond = 24;
    if (selectedResolution === '480p' || selectedResolution === '720p') {
      rateExplanation = `${plan === 'pro' ? 'Pro' : 'Studio'}订阅将按1080p费率扣除，享受最高质量`;
    }
  } else {
    // 充值用户或Free用户
    actualResolution = '720p';
    creditsPerSecond = 15;
    rateExplanation = '充值用户统一按720p费率扣除';
  }
  
  const totalCredits = calculateVideoCredits(plan, selectedResolution, selectedDuration);
  const remainingBalance = currentBalance !== undefined ? currentBalance - totalCredits : undefined;
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">积分扣除预览</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">您选择：</span>
          <span className="text-white">
            {selectedDuration}秒 {selectedResolution}
          </span>
        </div>
        
        {selectedResolution !== actualResolution && (
          <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <span className="text-yellow-500">⚠️</span>
            <span className="text-yellow-400 text-xs">{rateExplanation}</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-400">扣除费率：</span>
          <span className="text-white">
            {creditsPerSecond}积分/秒 ({actualResolution})
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">总积分：</span>
          <span className="text-white font-semibold">
            {totalCredits}积分
          </span>
        </div>
        
        {currentBalance !== undefined && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-400">当前余额：</span>
              <span className="text-white">{currentBalance}积分</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">生成后余额：</span>
              <span className={remainingBalance !== undefined && remainingBalance < 0 ? 'text-red-400' : 'text-white'}>
                {remainingBalance !== undefined ? remainingBalance : '--'}积分
              </span>
            </div>
            {remainingBalance !== undefined && remainingBalance < 0 && (
              <div className="text-red-400 text-xs mt-1">
                积分不足，请先充值
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

---

## 七、盈利验证

### 按最低积分价格（¥0.072/积分）计算

| 用户类型 | 选择 | 积分 | 成本 | 收入 | 利润 | 利润率 |
|---------|------|------|------|------|------|--------|
| Basic订阅 | 5秒480p | 75 | ¥3 | ¥5.4 | ¥2.4 | **+80%** ✅ |
| Basic订阅 | 10秒720p | 150 | ¥6 | ¥10.8 | ¥4.8 | **+80%** ✅ |
| Pro订阅 | 5秒480p | 120 | ¥5 | ¥8.64 | ¥3.64 | **+72.8%** ✅ |
| Pro订阅 | 10秒1080p | 240 | ¥10 | ¥17.28 | ¥7.28 | **+72.8%** ✅ |
| 充值用户 | 5秒480p | 75 | ¥3 | ¥5.4 | ¥2.4 | **+80%** ✅ |
| 充值用户 | 10秒720p | 150 | ¥6 | ¥10.8 | ¥4.8 | **+80%** ✅ |

**结论**：所有方案都能盈利70%以上 ✅

---

## 八、总结

### 核心策略
1. **时长**：按用户实际选择计算（5秒、10秒等）
2. **分辨率费率**：根据订阅计划强制使用高分辨率费率
3. **防薅羊毛**：Basic按720p费率，Pro/Studio按1080p费率
4. **用户体验**：清晰显示实际扣除规则和积分

### 实施要点
- ✅ 后端逻辑已实现（`calculateVideoCredits`）
- ⚠️ 需要创建积分预览组件
- ⚠️ 需要更新分辨率选择器UI
- ⚠️ 需要更新时长选择器UI

### 优势
- ✅ 时长按用户选择，公平合理
- ✅ 强制高分辨率费率，防止薅羊毛
- ✅ 确保盈利70%以上
- ✅ 用户体验清晰透明

