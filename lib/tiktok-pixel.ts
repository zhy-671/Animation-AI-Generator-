/**
 * TikTok Pixel 事件追踪工具
 */

declare global {
  interface Window {
    ttq?: any;
  }
}

/**
 * 发送 TikTok Pixel 事件
 * @returns {boolean} 是否成功发送事件
 */
export function trackTikTokEvent(eventName: string, eventData?: Record<string, any>): boolean {
  if (typeof window === 'undefined') {
    console.warn('[TikTok Pixel] Window is undefined');
    return false;
  }
  
  // 检查 ttq 是否存在
  if (!window.ttq) {
    console.warn('[TikTok Pixel] TikTok Pixel not loaded. window.ttq is:', window.ttq);
    console.warn('[TikTok Pixel] Waiting for TikTok Pixel to load...');
    
    // 等待 TikTok Pixel 加载（最多等待 5 秒）
    let retryCount = 0;
    const maxRetries = 10;
    const checkInterval = setInterval(() => {
      retryCount++;
      if (window.ttq) {
        clearInterval(checkInterval);
        console.log('[TikTok Pixel] TikTok Pixel loaded, sending event now');
        try {
          // 检查 ttq 实例
          const instances = window.ttq._i || {};
          const instanceIds = Object.keys(instances);
          console.log('[TikTok Pixel] TikTok Pixel instances:', instanceIds);
          
          if (eventData) {
            window.ttq.track(eventName, eventData);
            console.log(`[TikTok Pixel] Event ${eventName} tracked successfully (after wait)`);
            console.log('[TikTok Pixel] Event data:', eventData);
            
            // 验证事件是否被添加到队列
            const queue = window.ttq._i?.[instanceIds[0]] || [];
            console.log('[TikTok Pixel] Event queue length:', queue.length);
            console.log('[TikTok Pixel] Last event in queue:', queue[queue.length - 1]);
            
            return true;
          } else {
            window.ttq.track(eventName);
            console.log(`[TikTok Pixel] Event ${eventName} tracked successfully (after wait, no data)`);
            return true;
          }
        } catch (error) {
          console.error('[TikTok Pixel] Error tracking TikTok event (after wait):', error);
          return false;
        }
      } else if (retryCount >= maxRetries) {
        clearInterval(checkInterval);
        console.error('[TikTok Pixel] TikTok Pixel failed to load after 5 seconds');
        return false;
      }
    }, 500);
    
    return false;
  }

  try {
    console.log(`[TikTok Pixel] Tracking event: ${eventName}`, eventData);
    console.log('[TikTok Pixel] window.ttq type:', typeof window.ttq);
    console.log('[TikTok Pixel] window.ttq methods:', Object.keys(window.ttq));
    
    // 检查 ttq 实例
    const instances = window.ttq._i || {};
    const instanceIds = Object.keys(instances);
    console.log('[TikTok Pixel] TikTok Pixel instances:', instanceIds);
    console.log('[TikTok Pixel] TikTok Pixel instance data:', instances);
    
    // 检查当前队列长度
    const queueBefore = window.ttq._i?.[instanceIds[0]] || [];
    console.log('[TikTok Pixel] Event queue length before:', queueBefore.length);
    
    if (eventData) {
      window.ttq.track(eventName, eventData);
      console.log(`[TikTok Pixel] Event ${eventName} tracked successfully`);
      console.log('[TikTok Pixel] Event data:', eventData);
    } else {
      window.ttq.track(eventName);
      console.log(`[TikTok Pixel] Event ${eventName} tracked successfully (no data)`);
    }
    
    // 验证事件是否被添加到队列
    setTimeout(() => {
      const queueAfter = window.ttq._i?.[instanceIds[0]] || [];
      console.log('[TikTok Pixel] Event queue length after:', queueAfter.length);
      console.log('[TikTok Pixel] Last event in queue:', queueAfter[queueAfter.length - 1]);
      
      if (queueAfter.length > queueBefore.length) {
        console.log('[TikTok Pixel] ✅ Event successfully added to queue');
      } else {
        console.warn('[TikTok Pixel] ⚠️ Event may not have been added to queue');
      }
    }, 100);
    
    return true;
  } catch (error) {
    console.error('[TikTok Pixel] Error tracking TikTok event:', error);
    console.error('[TikTok Pixel] Error details:', error instanceof Error ? error.stack : error);
    return false;
  }
}

/**
 * 发送 CompletePayment 事件（购买积分或订阅成功）
 * @returns {boolean} 是否成功发送事件
 */
export function trackCompletePayment(params: {
  content_type?: string;
  value?: number;
  currency?: string;
  content_name?: string;
  content_id?: string;
}): boolean {
  const eventData = {
    content_type: params.content_type || 'product',
    value: params.value,
    currency: params.currency || 'USD',
    content_name: params.content_name,
    content_id: params.content_id,
  };
  
  console.log('[TikTok Pixel] trackCompletePayment called with:', eventData);
  const result = trackTikTokEvent('CompletePayment', eventData);
  console.log('[TikTok Pixel] trackCompletePayment result:', result);
  return result;
}

/**
 * 发送 ViewContent 事件（查看内容页面）
 */
export function trackViewContent(params?: {
  content_type?: string;
  content_name?: string;
  content_id?: string;
  value?: number;
  currency?: string;
}) {
  trackTikTokEvent('ViewContent', {
    content_type: params?.content_type || 'product',
    content_name: params?.content_name,
    content_id: params?.content_id,
    value: params?.value,
    currency: params?.currency || 'USD',
  });
}

