import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/storyboard/generate-content
 * 生成故事内容（纯文本剧本）
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prompt } = body;

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
        body: JSON.stringify({
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
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DashScope API error:", {
        status: response.status,
        error: errorText,
      });
      return NextResponse.json(
        {
          error: `DashScope API error: ${response.status} - ${errorText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    if (!content) {
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

    return NextResponse.json({
      success: true,
      data: {
        title: title,
        content: content,
      },
    });
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

