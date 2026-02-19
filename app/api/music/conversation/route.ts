import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LAOZHANG_ENDPOINT = "https://api.laozhang.ai/v1/chat/completions";
const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY || process.env.Laozhang_API_KEY;
const LAOZHANG_MODEL = "gpt-4o-mini";

const CONVERSATION_SYSTEM_PROMPT = `You are Tunee, a professional music creation assistant. Your role is to help users refine their music ideas through conversation before generating music.

Key Responsibilities:
1. Understand the user's music style and requirements
2. Provide professional suggestions and directions
3. Ask clarifying questions to better understand their vision
4. Offer multiple creative directions for the music
5. Help refine the music description and style

Communication Style:
- Friendly and professional
- Use music industry terminology appropriately
- Provide specific, actionable suggestions
- Show enthusiasm for creative ideas
- Keep responses concise but informative

Response Format:
- Always respond in English
- Provide 2-3 creative directions as suggestions when appropriate
- Use clear, engaging language
- Focus on musical elements: genre, mood, tempo, instrumentation, style

When the user provides a music description:
1. Acknowledge their idea positively
2. Analyze the key elements (genre, mood, style)
3. Suggest 2-3 creative directions
4. Ask if they want to refine any aspect

Example response structure:
- Opening: Acknowledge the style
- Analysis: Break down the key elements
- Suggestions: Provide 2-3 directions with brief descriptions
- Closing: Invite further discussion`;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!LAOZHANG_API_KEY) {
      return NextResponse.json(
        { error: "LAOZHANG_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages, initialPrompt } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Build conversation context
    const conversationMessages = [
      {
        role: "system",
        content: CONVERSATION_SYSTEM_PROMPT,
      },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // Call Laozhang API
    const response = await fetch(LAOZHANG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LAOZHANG_API_KEY}`,
      },
      body: JSON.stringify({
        model: LAOZHANG_MODEL,
        messages: conversationMessages,
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Laozhang API error:", errorText);
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "I understand your music style. Let's explore some creative directions.";

    // Extract suggestions from the response (look for numbered lists or "Direction" keywords)
    const suggestions: string[] = [];
    const lines = assistantMessage.split('\n');
    let currentSuggestion = '';
    
    for (const line of lines) {
      // Look for numbered suggestions (1., 2., 3., etc.)
      const numberedMatch = line.match(/^\d+\.\s*(.+)/);
      if (numberedMatch) {
        if (currentSuggestion) {
          suggestions.push(currentSuggestion.trim());
        }
        currentSuggestion = numberedMatch[1];
      } else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
        // Bullet points
        const bulletMatch = line.match(/[-•]\s*(.+)/);
        if (bulletMatch && currentSuggestion) {
          currentSuggestion += ' ' + bulletMatch[1];
        }
      } else if (line.toLowerCase().includes('direction') && currentSuggestion) {
        // End of suggestion section
        if (currentSuggestion) {
          suggestions.push(currentSuggestion.trim());
          currentSuggestion = '';
        }
      } else if (currentSuggestion && line.trim()) {
        currentSuggestion += ' ' + line.trim();
      }
    }
    
    if (currentSuggestion) {
      suggestions.push(currentSuggestion.trim());
    }

    // If no suggestions found, try to extract from common patterns
    if (suggestions.length === 0) {
      const directionPattern = /(?:direction|suggestion|option)\s*\d*[:\-]\s*([^\n]+)/gi;
      let match;
      while ((match = directionPattern.exec(assistantMessage)) !== null && suggestions.length < 3) {
        suggestions.push(match[1].trim());
      }
    }

    // Limit to 3 suggestions
    const finalSuggestions = suggestions.slice(0, 3);

    return NextResponse.json({
      response: assistantMessage,
      suggestions: finalSuggestions,
    });
  } catch (error) {
    console.error("Error in conversation API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

