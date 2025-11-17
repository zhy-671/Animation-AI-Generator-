CREATE TABLE IF NOT EXISTS public.anim_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 5,
  creem_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anim_customers_user_id ON public.anim_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_anim_customers_email ON public.anim_customers(email);
CREATE INDEX IF NOT EXISTS idx_anim_customers_creem_customer_id ON public.anim_customers(creem_customer_id);

-- 启用 Row Level Security (RLS)
ALTER TABLE public.anim_customers ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能查看和更新自己的记录
CREATE POLICY "Users can view own customer record"
  ON public.anim_customers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own customer record"
  ON public.anim_customers
  FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- 创建 anim_credits_history 表
-- =====================================================

CREATE TABLE IF NOT EXISTS public.anim_credits_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.anim_customers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('add', 'subtract', 'expire', 'refund')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_credits_history_customer_id ON public.anim_credits_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_credits_history_created_at ON public.anim_credits_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credits_history_type ON public.anim_credits_history(type);

-- 启用 Row Level Security (RLS)
ALTER TABLE public.anim_credits_history ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能查看自己的积分历史
CREATE POLICY "Users can view own credits history"
  ON public.anim_credits_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_customers
      WHERE anim_customers.id = anim_credits_history.customer_id
      AND anim_customers.user_id = auth.uid()
    )
  );

-- =====================================================
-- 创建更新 updated_at 的触发器函数
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 anim_customers 表添加自动更新 updated_at 的触发器
DROP TRIGGER IF EXISTS update_anim_customers_updated_at ON public.anim_customers;
CREATE TRIGGER update_anim_customers_updated_at
  BEFORE UPDATE ON public.anim_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 创建自动为新用户创建 anim_customer 记录的触发器函数
-- =====================================================

-- 自动为新用户创建customer记录的触发器
-- 当用户在auth.users表中注册时，自动在anim_customers表中创建对应记录

-- 创建函数：自动创建customer记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_customer_id UUID;
BEGIN
  -- 为新注册用户自动创建customer记录
  INSERT INTO public.anim_customers (
    user_id,
    email,
    credits,
    creem_customer_id,
    created_at,
    updated_at,
    metadata
  ) VALUES (
    NEW.id,
    NEW.email,
    5, -- 新用户赠送5积分
    'auto_' || NEW.id::text, -- 自动生成的creem_customer_id
    NOW(),
    NOW(),
    jsonb_build_object(
      'source', 'auto_registration',
      'initial_credits', 5,
      'registration_date', NOW()
    )
  ) RETURNING id INTO new_customer_id;

  -- 记录初始积分赠送历史
  INSERT INTO public.anim_credits_history (
    customer_id,
    amount,
    type,
    description,
    created_at,
    metadata
  ) VALUES (
    new_customer_id,
    5,
    'add',
    'Welcome bonus for new user registration',
    NOW(),
    jsonb_build_object(
      'source', 'welcome_bonus',
      'user_registration', true
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：在用户注册时自动触发
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 为现有的auth.users创建customer记录（如果还没有的话）
INSERT INTO public.anim_customers (
  user_id,
  email,
  credits,
  creem_customer_id,
  created_at,
  updated_at,
  metadata
)
SELECT 
  au.id,
  au.email,
  5, -- 赠送5积分
  'existing_' || au.id::text,
  au.created_at,
  NOW(),
  jsonb_build_object(
    'source', 'existing_user_migration',
    'initial_credits', 5,
    'migration_date', NOW()
  )
FROM auth.users au
LEFT JOIN public.anim_customers c ON au.id = c.user_id
WHERE c.user_id IS NULL; -- 只为没有customer记录的用户创建

-- 为现有用户添加初始积分历史记录
INSERT INTO public.anim_credits_history (
  customer_id,
  amount,
  type,
  description,
  created_at,
  metadata
)
SELECT 
  c.id,
  5,
  'add',
  'Welcome bonus for existing user',
  NOW(),
  jsonb_build_object(
    'source', 'existing_user_bonus',
    'migration', true
  )
FROM public.anim_customers c
LEFT JOIN public.anim_credits_history ch ON c.id = ch.customer_id AND ch.type = 'add' AND ch.description = 'Welcome bonus for existing user'
WHERE ch.id IS NULL
AND c.creem_customer_id LIKE 'existing_%'; -- 只为刚迁移的现有用户添加

-- 成功提示
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'anim_customers table created successfully!';
    RAISE NOTICE 'anim_credits_history table created successfully!';
    RAISE NOTICE 'Auto-create anim_customer trigger has been created successfully!';
    RAISE NOTICE 'All existing users now have customer records with 5 initial credits.';
    RAISE NOTICE 'New users will automatically get anim_customer records when they register.';
    RAISE NOTICE '========================================';
END $$;