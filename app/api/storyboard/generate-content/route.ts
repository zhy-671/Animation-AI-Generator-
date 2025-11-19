import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/storyboard/generate-content
 * 生成故事内容（纯文本剧本）
 */
export async function POST(request: NextRequest) {
  try {
    // 打印 API 调用开始
    console.log("\n" + "=".repeat(60));
    console.log("🚀 STORY CONTENT GENERATION API CALLED");
    console.log("=".repeat(60));
    console.log("Timestamp:", new Date().toISOString());
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log("❌ User not authenticated");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("✅ User authenticated:", user.id);
    
    const body = await request.json();
    const { prompt } = body;
    
    console.log("📝 Received prompt:", prompt?.substring(0, 100) + (prompt?.length > 100 ? "..." : ""));

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DASHSCOPE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // 构建新的系统提示词
    const systemPrompt = `# Master Anime Story Creator Prompt

You are a **master anime story creator**. Based on the concept and style provided, generate a complete, engaging anime story. Follow this exact structure and rules:

---

## Story Structure

# [Story Title]

## Synopsis

- Write 2–3 paragraphs summarizing the core conflict, appeal, and main plot.  
- Emphasize emotional tension, character motivation, and story hook.

## World Building

### Setting Description

- Describe the world, time period, and environment in detail.  
- Include technology, magic/special abilities, and social dynamics.  
- Each paragraph should be at least 100 words.

### Cultural Elements

- List key cultural traits, social structure, customs, beliefs, politics, or technological advancements.  
- Explain how these elements influence characters and plot.

### Timeline / Historical Context

- State the story's time period.  
- Give a brief historical background and major past events (up to 300 words).

---

## Main Characters

> Limit to 3–4 main characters, no more than 5.  
> Each character description should be at least 3 paragraphs.

### [Character Name] - [Role]

**Background**: Past and present situation  
**Personality**: Key traits and behavioral patterns  
**Motivations**: Driving forces behind their actions  
**Character Arc**: How the character grows and changes through the story

---

## Story Chapters (8–12)

- Each chapter: 3–5 paragraphs  
- Total story length: 2500–4000 words

### Chapter 1: Introduction

- Introduce the world and main character  
- Establish setting and tone  
- Hint at the central conflict

### Chapter 2: Inciting Incident

- Present the main problem or crisis  
- Push the character to begin their journey or take action

### Chapters 3–4: Rising Action

- Introduce complications and obstacles  
- Introduce supporting characters and rivals  
- Challenge the protagonist's skills, beliefs, or relationships

### Chapters 5–6: Conflict Escalation

- Core conflicts intensify  
- Protagonist experiences setbacks or failures  
- Deepen interpersonal or team dynamics

### Chapters 7–8: Climax

- Story reaches its peak tension  
- Reveal key secrets or confront major antagonists  
- Heighten emotional and plot stakes

### Chapters 9–10: Resolution

- Resolve central conflicts  
- Show protagonist's growth  
- Wrap up antagonistic forces or obstacles

### Chapters 11–12: Aftermath

- Show consequences and establish a new balance  
- Highlight changes in relationships and world  
- Leave room for sequels or extended stories

---

## Themes and Messages

- Clearly define core themes (friendship, courage, responsibility, growth, sacrifice, family, etc.)  
- Show how each theme is represented in the plot

## Character Development Arcs

- Detail the emotional and psychological growth of each main character  
- Show how internal and external events shape their behavior

---

## Style Requirements

- Primary Style: [e.g., 2D Anime / Shonen / Healing Fantasy / Sci-Fi Mystery / School Life]  
- Match genre conventions authentically  
- Balance action, plot, and character development  
- Appropriate for target audience age  
- Avoid excessive violence or inappropriate content

---

## Content Guidelines

- Avoid meaningless filler  
- Ensure character motivations and plot logic are consistent  
- Respect cultural authenticity  
- Every main character must have clear motivation and emotional arc  
- Keep story coherent with satisfying climax and resolution  
- Limit violence and conflict to appropriate levels  
- Avoid:  
  - Dumbed-down character behavior  
  - Illogical plot jumps  
  - Over-the-top "chuunibyou" dialogue`;

    const userPrompt = `**User Theme/Concept:** "${prompt.trim()}"

Please create a complete anime story following the Master Anime Story Creator structure. Include all required sections: Synopsis, World Building, Main Characters (3-4 characters), Story Chapters (8-12 chapters, 2500-4000 words total), Themes and Messages, and Character Development Arcs. 

Ensure the story is engaging, emotionally resonant, and follows proper narrative structure with clear introduction, rising action, climax, resolution, and aftermath.`;

    // 构建请求参数
    const requestBody = {
      model: "qwen-plus",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 8000, // Increased to support longer stories (2500-4000 words) with full structure
    };

    // 打印请求参数（服务器端日志）
    console.log("\n" + "=".repeat(60));
    console.log("📤 STORY CONTENT GENERATION API REQUEST");
    console.log("=".repeat(60));
    console.log("API Endpoint:", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
    console.log("Request Method: POST");
    console.log("Request Headers:", JSON.stringify({
      Authorization: `Bearer ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`, // 只显示部分 API Key
      "Content-Type": "application/json",
    }, null, 2));
    console.log("\nRequest Body:");
    console.log(JSON.stringify(requestBody, null, 2));
    console.log("\nSystem Prompt Length:", systemPrompt.length, "characters");
    console.log("\nUser Prompt:");
    console.log(userPrompt);
    console.log("=".repeat(60) + "\n");

    // 调用 DashScope Chat Completions API（使用中国端点，与其他功能保持一致）
    // 如果您的 API 密钥是国际版的，请将下面的 URL 改为：
    // "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
    const response = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `HTTP ${response.status} ${response.statusText}`;
      }
      
      console.error("DashScope API error:", {
        status: response.status,
        error: errorText.substring(0, 500), // Limit error text length
      });
      
      return NextResponse.json(
        {
          error: `DashScope API error: ${response.status}. ${errorText.substring(0, 200)}`,
        },
        { 
          status: 500, // Always return 500 for API errors, not the upstream status
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error("Failed to parse DashScope response as JSON:", parseError);
      return NextResponse.json(
        {
          error: "Invalid response from AI service. Please try again.",
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 打印返回结果（服务器端日志）
    console.log("\n" + "=".repeat(60));
    console.log("📥 STORY CONTENT GENERATION API RESPONSE");
    console.log("=".repeat(60));
    console.log("Response Status:", response.status, response.statusText);
    console.log("\nResponse Headers:");
    console.log(JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    console.log("\nResponse Body (Full):");
    console.log(JSON.stringify(data, null, 2));
    console.log("\nResponse Body (Summary):");
    console.log(JSON.stringify({
      id: data.id,
      model: data.model,
      object: data.object,
      created: data.created,
      choices_count: data.choices?.length || 0,
      usage: data.usage,
      content_length: data.choices?.[0]?.message?.content?.length || 0,
      content_preview: data.choices?.[0]?.message?.content?.substring(0, 200) || "No content",
    }, null, 2));
    console.log("=".repeat(60) + "\n");

    const content = data.choices?.[0]?.message?.content || "";

    if (!content) {
      console.error("No content in DashScope response. Full response:", JSON.stringify(data, null, 2));
      return NextResponse.json(
        { error: "No content in DashScope response" },
        { status: 500 }
      );
    }

    // 提取标题（第一行或前50个字符）
    const lines = content.split('\n');
    let title = lines[0] || "AI生成的剧本";
    if (title.length > 50) {
      title = title.substring(0, 50) + "...";
    }
    // 移除标题中的#号
    title = title.replace(/^#+\s*/, '').trim();

    // 打印最终返回给客户端的数据（服务器端日志）
    const finalResponse = {
      success: true,
      data: {
        title: title,
        content: content,
      },
    };
    console.log("\n" + "=".repeat(60));
    console.log("✅ FINAL API RESPONSE TO CLIENT");
    console.log("=".repeat(60));
    console.log("Response (Content Truncated):");
    console.log(JSON.stringify({
      ...finalResponse,
      data: {
        ...finalResponse.data,
        content: finalResponse.data.content.substring(0, 200) + "... (truncated, full length: " + content.length + " chars)",
      },
    }, null, 2));
    console.log("\nContent Length:", content.length, "characters");
    console.log("Title:", title);
    console.log("=".repeat(60) + "\n");

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error("Error generating story content:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate story content",
      },
      { status: 500 }
    );
  }
}

