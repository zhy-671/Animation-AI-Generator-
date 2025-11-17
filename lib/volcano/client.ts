/**
 * 火山引擎客户端封装
 * 用于调用火山引擎的 AI 模型进行故事创作和图片生成
 */

interface StoryGenerationRequest {
  prompt: string;
  referenceImage?: string; // base64 编码的图片
  readerGroup?: "儿童" | "青少年" | "成人" | "全年龄";
  style?: string; // 风格参数
}

interface StoryGenerationResponse {
  title: string;
  summary: string;
  scenes: string[];
  scenes_detail: string[];
}

interface ImageGenerationRequest {
  prompts: string[];
  referenceImage?: string;
  style?: string; // 风格参数
}

interface ImageGenerationResponse {
  images: string[]; // 图片 URL 数组
}

class VolcanoClient {
  private apiKey: string;
  private baseUrl: string;
  private storyModel: string;
  private imageModel: string;

  constructor() {
    this.apiKey = process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY || "";
    this.baseUrl = process.env.VOLCANO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
    // 从环境变量读取模型名称，如果没有配置则使用默认值
    // 注意：火山引擎使用端点ID格式（ep-xxxxx-xxxxx）或模型名称
    this.storyModel = process.env.VOLCANO_STORY_MODEL || process.env.VOLCANO_MODEL || "";
    this.imageModel = process.env.VOLCANO_IMAGE_MODEL || "doubao-seedream-4.0";
    
    if (!this.apiKey) {
      console.warn("VOLCANO_API_KEY or ARK_API_KEY is not set");
    }
    
    if (!this.storyModel) {
      console.warn("VOLCANO_STORY_MODEL is not set, please configure it in .env.local");
    }
  }

  /**
   * 调用 doubao-seed-1.6 模型进行故事创作
   */
  async generateStory(request: StoryGenerationRequest): Promise<StoryGenerationResponse> {
    const systemPrompt = `# 角色

你是一位**动画剧本大师**，请根据用户提供的文本（文章、故事或描述），生成**线性连贯、生动有趣、情绪丰富、情感共鸣的动画剧本分镜**，整个故事必须**严格围绕用户输入的主题或内容展开**。要求如下：

## 核心要求
1. **主题驱动**：故事、分镜、文案、画面描述必须紧扣用户提供的文本主题，不得偏离。
2. **人物保持一致性**：角色外观、服饰和性格在整个故事中不可改变。
3. **分镜拆分→文案→画面描述严格一一对应**，按故事时间线推进，不允许错位。
4. **情绪共鸣**：故事必须围绕“共情”和“情绪价值”展开。
5. **分镜数量**：5~10个关键分镜，遵循叙事弧线（开端→发展→高潮→结局）。

## 分镜输出要求
1. **文案（scenes）**：每个分镜50字左右，传递情绪，引发共鸣，禁止英文引号。
2. **画面描述（scenes_detail）**：
   - 构图（特写、远景等）
   - 光影、色彩
   - 角色表情与动作
   - 场景环境细节
   - 可直接用于图片生成

## 输出格式（JSON）
{
  "title": "书名",
  "summary": "30字内故事总结",
  "scenes": [
    "分镜1文案",
    "分镜2文案"
  ],
  "scenes_detail": [
    "图片1：详细画面描述",
    "图片2：详细画面描述"
  ]
}

## 安全限制
- 禁止暴力、血腥、色情、仇恨、歧视、违法或危险行为。
- 内容需普遍适宜，符合社会可接受的艺术创作范围。

## 说明
用户提供一段文本或主题，AI需自动：
1. 提取文本的核心主题、情节和情绪。
2. 拆分成5~10个关键分镜。
3. 为每个分镜生成对应文案和画面描述，保证顺序绑定、人物一致性和主题聚焦。

## 输出格式要求

整理成以下JSON格式，scenes 和 scenes_detail 要与分镜保持顺序一致，一一对应，最多10个（不能超过10个）：

{  
  "title": "书名",
  "summary": "30字内的总结",
  "scenes": [
    "分镜1的文案，用50字篇幅传递情绪和情感，引发读者共鸣，语言风格需符合设定。",
    "分镜2的文案"
  ],
  "scenes_detail": [
    "图片1：这是第一页的画面描述。必须以'图片'+序号开头。要有强烈的视觉感，详细描述构图（如特写、远景）、光影、色彩、角色表情、动作和环境细节，符合生图提示词的要求。",
    "图片2："
  ]
}`;

    const userPrompt = `读者群：${request.readerGroup || "全年龄"}
用户提示词：${request.prompt}
${request.referenceImage ? "用户提供了参考图，请参考参考图的风格和内容。" : ""}
${request.style ? `动画风格要求：${request.style === "2d" ? "2D动画风格" : request.style === "3d" ? "3D动画风格" : request.style === "anime" ? "日本二次元风格" : request.style === "clay" ? "粘土动画风格" : request.style === "comic" ? "美式漫画风格" : request.style === "cartoon" ? "动漫风格" : request.style === "cyberpunk" ? "赛博朋克风格" : ""}。请在画面描述中体现这种风格特点。` : ""}

请根据以上要求创作故事，并严格按照 JSON 格式输出。`;

    try {
      if (!this.storyModel) {
        throw new Error("VOLCANO_STORY_MODEL is not configured. Please set it in .env.local file.");
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.storyModel,
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
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Volcano API request details:", {
          url: `${this.baseUrl}/chat/completions`,
          model: this.storyModel,
          status: response.status,
          error: errorText,
        });
        throw new Error(`Volcano API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      // 提取 JSON 内容
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const storyData = JSON.parse(jsonMatch[0]) as StoryGenerationResponse;

      // 验证数据格式
      if (!storyData.title || !storyData.summary || !storyData.scenes || !storyData.scenes_detail) {
        throw new Error("Invalid story data format");
      }

      if (storyData.scenes.length !== storyData.scenes_detail.length) {
        throw new Error("Scenes and scenes_detail length mismatch");
      }

      if (storyData.scenes.length > 10) {
        storyData.scenes = storyData.scenes.slice(0, 10);
        storyData.scenes_detail = storyData.scenes_detail.slice(0, 10);
      }

      return storyData;
    } catch (error) {
      console.error("Error generating story:", error);
      throw error;
    }
  }

  /**
   * 调用 doubao-seedream-4.0 模型生成图片
   */
  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      // 风格提示词映射
      const stylePrompts: Record<string, string> = {
        "2d": "2D动画风格，平面动画效果",
        "3d": "3D动画风格，立体三维效果",
        "anime": "日本二次元风格，日式动漫风格",
        "clay": "粘土动画风格，粘土材质效果",
        "comic": "美式漫画风格，美漫风格",
        "cartoon": "动漫风格，卡通动画效果",
        "cyberpunk": "赛博朋克风格，未来科技感",
      };
      const stylePrompt = request.style ? stylePrompts[request.style] || "" : "";
      
      const imagePromises = request.prompts.map(async (prompt, index) => {
        // 如果 prompt 中已经包含风格，就不重复添加
        const finalPrompt = stylePrompt && !prompt.includes(stylePrompt) 
          ? `${prompt}，${stylePrompt}` 
          : prompt;
        
        const response = await fetch(`${this.baseUrl}/images/generations`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.imageModel,
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            ...(request.referenceImage && { reference_image: request.referenceImage }),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Volcano API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.data?.[0]?.url || "";
      });

      const images = await Promise.all(imagePromises);
      return { images };
    } catch (error) {
      console.error("Error generating images:", error);
      throw error;
    }
  }

  /**
   * 上传图片到火山存储 storybooks bucket
   */
  async uploadImage(imageUrl: string, filename: string): Promise<string> {
    try {
      // 导入 TOS 客户端
      const { tosClient } = await import('./storage');
      
      // 从 URL 下载并上传到火山存储
      return await tosClient.uploadImageFromUrl(imageUrl, filename);
    } catch (error) {
      console.error("Error uploading image to TOS:", error);
      // 如果上传失败，返回原 URL
      return imageUrl;
    }
  }
}

export const volcanoClient = new VolcanoClient();
export type { StoryGenerationRequest, StoryGenerationResponse, ImageGenerationRequest, ImageGenerationResponse };

