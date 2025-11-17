import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // 使用 service role key 创建 admin 客户端以绕过 RLS
    // 如果没有设置 service role key，则使用 anon key（可能无法绕过 RLS）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not set');
      return NextResponse.json(
        { videos: [], error: 'Supabase URL is not configured' },
        { status: 500 }
      );
    }
    
    if (!supabaseServiceKey) {
      console.error('Neither SUPABASE_SERVICE_ROLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set');
      return NextResponse.json(
        { videos: [], error: 'Supabase API key is not configured' },
        { status: 500 }
      );
    }
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Using service role key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Service key length:', supabaseServiceKey.length);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // 查找指定邮箱的用户
    const exampleEmail = 'gareaukeenan3155@gmail.com';
    console.log('Looking for user with email:', exampleEmail);
    
    // 通过 anim_customers 表查找用户ID（因为该表有 email 字段）
    const { data: customerData, error: customerError } = await supabase
      .from('anim_customers')
      .select('user_id, email')
      .eq('email', exampleEmail)
      .single();
    
    console.log('Customer query result:', { customerData, customerError });
    
    if (customerError || !customerData) {
      console.error('Error finding user by email:', customerError);
      // 检查是否是 API key 错误
      if (customerError?.message?.includes('Invalid API key') || customerError?.code === 'PGRST301') {
        return NextResponse.json(
          { 
            videos: [], 
            error: 'Invalid API key. Please check your SUPABASE_SERVICE_ROLE_KEY in .env.local',
            debug: { 
              customerError: customerError?.message,
              hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
              url: supabaseUrl
            } 
          },
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      // 如果找不到用户，返回空数组而不是错误
      return NextResponse.json(
        { videos: [], error: customerError?.message || 'User not found', debug: { customerError } },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    const userId = customerData.user_id;
    console.log('Found user ID:', userId);
    
    // 查询该用户的所有已完成视频
    const { data: videos, error: videosError } = await supabase
      .from('anim_videos')
      .select('video_url, prompt, created_at, status')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);
    
    console.log('Videos query result:', { 
      count: videos?.length || 0, 
      videos: videos?.slice(0, 3), // 只打印前3个
      error: videosError 
    });
    
    if (videosError) {
      console.error('Error fetching videos:', videosError);
      // 检查是否是 API key 错误
      if (videosError?.message?.includes('Invalid API key') || videosError?.code === 'PGRST301') {
        return NextResponse.json(
          { 
            videos: [], 
            error: 'Invalid API key. Please check your SUPABASE_SERVICE_ROLE_KEY in .env.local',
            debug: { 
              videosError: videosError?.message,
              hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
              url: supabaseUrl
            } 
          },
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      return NextResponse.json(
        { videos: [], error: videosError.message, debug: { videosError } },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    // 如果没有视频，返回空数组
    if (!videos || videos.length === 0) {
      console.log('No videos found for user:', userId);
      return NextResponse.json(
        { videos: [], message: 'No videos found for this user' },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    // 格式化视频数据
    const formattedVideos = videos.map((video, index) => {
      // 从 video_url 提取文件名
      const urlParts = video.video_url.split('/');
      const filename = urlParts[urlParts.length - 1] || `video-${index + 1}.mp4`;
      
      // 生成标题（使用 prompt 或默认标题）
      const title = video.prompt 
        ? (video.prompt.length > 50 ? video.prompt.substring(0, 50) + '...' : video.prompt)
        : `AI-Generated Animation Example ${index + 1}`;
      
      return {
        url: video.video_url,
        filename: filename,
        title: title
      };
    });

    console.log('Formatted videos count:', formattedVideos.length);
    
    return NextResponse.json(
      { videos: formattedVideos },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/videos:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        videos: [],
        details: error instanceof Error ? error.message : String(error)
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

