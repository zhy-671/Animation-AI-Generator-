-- 为 anim_credits_history 表添加 INSERT 策略
-- 允许用户通过服务端API插入自己的积分历史记录

-- 创建 RLS 策略：允许用户插入自己的积分历史记录
-- 通过验证 customer_id 属于当前用户来确保安全
CREATE POLICY "Users can insert own credits history"
  ON public.anim_credits_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anim_customers
      WHERE anim_customers.id = anim_credits_history.customer_id
      AND anim_customers.user_id = auth.uid()
    )
  );

