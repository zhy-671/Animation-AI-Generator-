import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 获取用户信息，带重试逻辑处理网络错误
 * @param supabase Supabase 客户端
 * @param maxRetries 最大重试次数（默认2次）
 * @returns 用户对象和错误信息
 */
export async function getUserWithRetry(
  supabase: SupabaseClient,
  maxRetries: number = 2
): Promise<{ user: any; error: any; isNetworkError: boolean }> {
  let user = null;
  let authError = null;
  let isNetworkError = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
      authError = result.error;

      // 检查是否是网络错误
      const isNetworkErr = authError && (
        authError.message?.includes('fetch failed') ||
        authError.message?.includes('timeout') ||
        authError.message?.includes('Connect Timeout') ||
        authError.message?.includes('UND_ERR_CONNECT_TIMEOUT')
      );

      // 如果成功获取用户或错误不是网络错误，跳出重试循环
      if (user || (authError && !isNetworkErr)) {
        isNetworkError = false;
        break;
      }

      // 如果是网络错误且还有重试机会，等待后重试
      if (attempt < maxRetries && isNetworkErr) {
        isNetworkError = true;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 递增延迟
        continue;
      }

      if (isNetworkErr) {
        isNetworkError = true;
      }
    } catch (error) {
      // 捕获网络错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkErr = errorMessage.includes('fetch failed') ||
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('Connect Timeout') ||
                          errorMessage.includes('UND_ERR_CONNECT_TIMEOUT');

      if (isNetworkErr && attempt < maxRetries) {
        isNetworkError = true;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      authError = error;
      if (isNetworkErr) {
        isNetworkError = true;
      }
      break;
    }
  }

  return { user, error: authError, isNetworkError };
}

