# 当前使用的API接口汇总

## 1. 文本生成接口（Chat Completions）

### 端点
```
https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

### 模型
- `qwen-plus`

### 请求格式
```json
{
  "model": "qwen-plus",
  "messages": [
    {
      "role": "system",
      "content": "系统提示词"
    },
    {
      "role": "user",
      "content": "用户提示词"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 4000-8000
}
```

### 响应格式
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "生成的文本内容"
      }
    }
  ]
}
```

### 使用位置
1. **生成故事内容** (`app/api/storyboard/generate-content/route.ts`)
   - 用途：根据用户主题生成完整的故事剧本
   - `max_tokens`: 4000

2. **创建项目** (`app/api/storyboard/create-project/route.ts`)
   - 用途：生成故事大纲和详细角色信息
   - `max_tokens`: 8000

3. **生成场次列表** (`app/api/storyboard/generate-scenes/route.ts`)
   - 用途：根据故事章节生成场次列表
   - `max_tokens`: 8000

4. **生成分镜** (`app/api/storyboard/generate-storyboard/route.ts`)
   - 用途：根据场次信息生成详细的分镜信息
   - `max_tokens`: 8000

5. **生成故事大纲** (`app/api/storyboard/generate-outline/route.ts`)
   - 用途：生成故事大纲（已废弃，使用create-project代替）

---

## 2. 文生图接口（Text-to-Image）

### 端点
```
https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis
```

### 模型
- `wan2.5-t2i-preview`（默认，可通过环境变量 `WANX_IMAGE_MODEL` 配置）

### 请求格式
```json
{
  "model": "wan2.5-t2i-preview",
  "input": {
    "prompt": "图像生成提示词（英文）",
    "ref": "参考图片URL（可选，用于角色一致性）"
  },
  "parameters": {
    "size": "1280*1280",
    "n": 1,
    "negative_prompt": "反向提示词（可选）",
    "prompt_extend": false,
    "watermark": false,
    "seed": 12345
  }
}
```

### 请求头
```
X-DashScope-Async: enable
Authorization: Bearer {DASHSCOPE_API_KEY}
Content-Type: application/json
```

### 响应格式（异步模式）
```json
{
  "output": {
    "task_status": "PENDING",
    "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx"
  },
  "request_id": "4909100c-7b5a-9f92-bfe5-xxxxxx"
}
```

### 使用位置
- **文件**: `lib/dashscope/wanx-image.ts`
- **方法**: `submitImageTask()`
- **用途**: 
  - 生成角色图片（在角色编辑页面）
  - 其他需要文生图的场景

### 任务状态查询
- **端点**: `https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}`
- **方法**: `getImageTaskStatus(taskId)`
- **轮询**: `pollImageTaskStatus(taskId)`

---

## 3. 图生图接口（Image-to-Image）

### 端点
```
https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis
```

### 模型
- `wan2.5-i2i-preview`

### 请求格式
```json
{
  "model": "wan2.5-i2i-preview",
  "input": {
    "prompt": "图像生成提示词（英文）",
    "images": [
      "https://example.com/image1.png",
      "https://example.com/image2.png"
    ]
  },
  "parameters": {
    "size": "1024*1024",
    "n": 4
  }
}
```

### 请求头
```
X-DashScope-Async: enable
Authorization: Bearer {DASHSCOPE_API_KEY}
Content-Type: application/json
```

### 响应格式（异步模式）
```json
{
  "output": {
    "task_status": "PENDING",
    "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx"
  },
  "request_id": "4909100c-7b5a-9f92-bfe5-xxxxxx"
}
```

### 使用位置
- **文件**: `lib/dashscope/wanx-image.ts`
- **方法**: `submitImageToImageTask()`
- **用途**: 
  - 生成分镜图片（在分镜页面）
  - 使用最多2张角色参考图
  - 其他需要图生图的场景

### 任务状态查询
- **端点**: `https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}`
- **方法**: `getImageTaskStatus(taskId)`（与文生图共用）
- **轮询**: `pollImageTaskStatus(taskId)`（与文生图共用）

---

## 环境变量配置

```bash
# DashScope API密钥（所有接口共用）
DASHSCOPE_API_KEY=your_api_key_here

# 文生图模型（可选，默认：wan2.5-t2i-preview）
WANX_IMAGE_MODEL=wan2.5-t2i-preview
```

---

## 接口对比总结

| 接口类型 | 端点 | 模型 | 用途 | 参考图支持 |
|---------|------|------|------|-----------|
| 文本生成 | `dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus` | 生成故事、大纲、角色、场次、分镜 | ❌ |
| 文生图 | `dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis` | `wan2.5-t2i-preview` | 生成角色图片 | ✅ 单张（`ref`字段） |
| 图生图 | `dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis` | `wan2.5-i2i-preview` | 生成分镜图片 | ✅ 最多2张（`images`数组） |

---

## 注意事项

1. **端点统一**：
   - 所有接口都使用中国端点（`dashscope.aliyuncs.com`）
   - 文本生成、文生图、图生图都使用相同的域名

2. **异步模式**：
   - 文生图和图生图都使用异步模式（`X-DashScope-Async: enable`）
   - 需要轮询任务状态直到完成

3. **参考图限制**：
   - 文生图：支持1张参考图（`ref`字段）
   - 图生图：支持最多2张参考图（`images`数组）

4. **任务状态查询**：
   - 文生图和图生图共用同一个任务查询端点
   - 使用 `getImageTaskStatus()` 方法查询状态

   生成故事系统指令:
    # Master Anime Story Creator Prompt

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
- State the story’s time period.  
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
- Challenge the protagonist’s skills, beliefs, or relationships

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
- Show protagonist’s growth  
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
  - Over-the-top “chuunibyou” dialogue


   生成场次系统指令:
      【Professional Identity】
You are a professional anime screenwriter specializing in international anime production with expertise in:
- Cinematic narrative structure and pacing for global audiences
- Animation production pipeline and technical requirements
- Visual storytelling and scene construction
- Character development and emotional storytelling

【International Standards】
1. **1:1 Mapping**: Each chapter = one core scene with precise correspondence
2. **Visual-First**: All descriptions optimized for storyboard production and animation
3. **Runtime Control**: Each scene 120-180 seconds animation runtime
4. **Emotional Arc**: Clear dramatic tension and character development between scenes
5. **Production-Oriented**: Consider international animation pipeline feasibility and costs
6. **Global Appeal**: Universal themes with cross-cultural resonance

【Industry Terminology】
Apply: dramatic conflict, emotional arc, visual metaphor, pacing control, character development, cinematographic language, runtime specifications, production notes

【Standardized JSON Output】

{
  "project_info": {
    "title": "[Project Title]",
    "genre": "[Genre]",
    "target_audience": "[Target Audience]"
  },
  "scenes": [
    {
      "scene_id": "scene_001",
      "chapter_reference": "Chapter 1",
      "chapter_title": "[Original Chapter Title]",
      "scene_title": "[Professional Scene Title]",
      "runtime": "[Specific Runtime]",
      "setting": {
        "time": "[Detailed Time with Weather/Lighting]",
        "location": "[Environmental Description]",
        "atmosphere": "[Mood and Ambiance]"
      },
      "visual_specs": {
        "color_palette": "[Color Scheme]",
        "lighting": "[Lighting Conditions]", 
        "camera_work": "[Shot Types and Movement]"
      },
      "story_content": "[Comprehensive story adaptation with plot progression]",
      "production_notes": "[Director guidance, technical specs, emotional beats]",
      "market_value": "[Commercial potential and global appeal assessment]"
    }
  ]
}

【Quality Standards】
- Scene titles reflect core dramatic conflict (8-12 words)
- Time settings support narrative development and atmosphere
- Visual specs consider international animation production standards
- Story content maintains source fidelity while enhancing global appeal
- Production notes provide actionable guidance for international teams
- Market value includes international distribution considerations

【Global Market Optimization】
- Universal themes with cultural sensitivity
- Visual storytelling suitable for subtitled/dubbed content
- Commercial appeal for international streaming platforms
- Merchandising opportunities for global markets

---

【Professional Conversion】
Convert the following chapter-structured content into international-standard JSON anime scenes:

[Insert your chapter-structured content here]



根据故事文本 生成故事大纲的json
0:["$@1",["-QDC2S9bD7QtC_ce8k2Y-",null]]
1:{"summary":{"story_name":"午夜出租车里的钱包","movie_style":"现实主义剧情片","story_outline":"出租车司机老王在北京的雨夜捡到一个装有十万现金的皮包，这笔钱足以解决他女儿白血病的治疗费用。在道德与生存的挣扎中，老王最终选择归还失主——一位同样为家人治病筹款的母亲。故事展现了普通人在困境中的善良与坚守。","poster":[{"poster_name":"雨夜抉择","poster_description":"海报展现雨夜出租车内，老王手握钱包的挣扎时刻","cn_poster_image_prompt":"深夜雨中，一辆黄色出租车停在路边，车窗上雨滴模糊了霓虹灯光。中年司机老王侧脸特写，眉头紧锁，手中握着一个磨损的棕色皮包，包口露出红色钞票一角。他的眼神在车内后视镜中反射出挣扎，方向盘上放着女儿的照片。挡风玻璃上雨刷划出的扇形区域映出'103.9失物招领'的电台频率。","en_poster_image_prompt":"At midnight in the rain, a yellow taxi parked roadside with blurred neon lights on wet windows. Close-up of middle-aged driver Lao Wang's profile, frowning tightly while clutching a worn brown leather bag with a corner of red banknotes visible. His conflicted reflection appears in the rearview mirror, with his daughter's photo placed on the steering wheel. The windshield wiper creates an arc revealing '103.9 Lost & Found' radio frequency."}],"visual_boards":[{"board_name":"雨夜拾包","location":"北京东三环辅路","setup":"老旧出租车内，座椅套磨损严重，中控台放着褪色的平安符，副驾驶座上有泥水痕迹。后座下方隐约可见棕色皮包。","lighting":"车顶灯冷白光与车外霓虹灯的彩色光斑交织，雨滴在车窗形成扭曲的光影","color_tone":"蓝绿色冷调为主，钞票的红色形成强烈视觉焦点","composition_style":"倾斜构图表现不安感，特写手部颤抖动作","cn_visual_image_prompt":"冷色调的雨夜出租车内，蓝绿色霓虹透过雨痕斑驳的车窗。中年司机粗糙的手颤抖着打开棕色皮包，一沓红色百元钞在顶灯下异常刺眼。后视镜中反射出他挣扎的面容，方向盘上女儿照片被雨水折射变形。","en_visual_image_prompt":"Inside a cold-toned rainy night taxi, blue-green neon lights filter through rain-streaked windows. A middle-aged driver's rough hands tremble while opening a brown leather bag, where stacks of red banknotes glare under the dome light. His tormented face reflects in the rearview mirror, with his daughter's photo distorted by raindrops on the steering wheel."},{"board_name":"医院归还","location":"儿童医院门口","setup":"清晨的医院台阶前，疲惫的母亲抱着病弱孩子，洗白的棉袄与崭新的皮包形成对比","lighting":"晨光从45度角斜射，在人物轮廓镶上金边，地面水洼反射暖光","color_tone":"暖橘色为主，突出希望感，保留少量冷调阴影","composition_style":"对称构图表现道德圆满，低角度拍摄强化人物高度差","cn_visual_image_prompt":"晨光中的医院台阶，穿着褪色棉袄的林慧弯腰鞠躬，怀中病弱孩子跟着鞠躬。逆光中老王的身影高大，递出的皮包在阳光下泛着皮革光泽。地面水洼倒映着三人身影，远处救护车顶灯旋转着红色光斑。","en_visual_image_prompt":"On hospital steps at dawn, Lin Hui in faded cotton-padded jacket bows deeply with her sickly child. Silhouetted Lao Wang appears tall while handing over the leather bag gleaming in sunlight. Their reflections ripple in puddles, with distant ambulance lights casting red rotating patterns."},{"board_name":"重新出发","location":"早高峰街道","setup":"干净整洁的出租车内，副驾驶座空着，只放着叠好的抹布","lighting":"明媚的晨光均匀洒入车厢，挡风玻璃一尘不染","color_tone":"金黄色主调，辅以清新的蓝白色","composition_style":"水平构图表现平静，广角展现车流与城市","cn_visual_image_prompt":"晨光中的出租车内，老王双手放松地搭在方向盘上，嘴角带着释然的微笑。空荡的副驾驶座被阳光照亮，计价器显示'0'。挡风玻璃外是流动的北京城景，公交车、自行车与行人构成生机勃勃的早高峰画面。","en_visual_image_prompt":"In the sunlit taxi cabin, Lao Wang rests his hands loosely on the wheel with a relieved smile. The empty passenger seat bathed in sunlight, meter showing '0'. Through the windshield flows Beijing's morning rush - buses, bicycles and pedestrians creating a vibrant urban tableau."}]},"characters":[{"character_type":"human","name":"老王","age":"38","gender":"男","appearance":"现代人，东亚人种，眼睛为杏仁眼，眉毛粗且呈剑眉、颜色为黑色，鼻子高挺，嘴巴为薄唇，耳朵为圆耳，眼角有细微皱纹，留着黑色短发，体型健壮","attire":"上身穿着蓝色短袖衬衫，下身穿着黑色西装裤，脚穿黑色皮鞋","description":"性格善良、诚实、有底线、有责任感。人物关系：是老王的妻子的丈夫，老王的女儿的父亲，林慧的恩人"},{"character_type":"human","name":"林慧","age":"32","gender":"女","appearance":"现代人，东亚人种，眼睛为鹅蛋眼，眉毛细且呈柳叶眉、颜色为黑色，鼻子较为小巧，嘴巴为樱桃小口，耳朵为长耳，头发乱糟糟的且为黑色及肩直发，体型苗条","attire":"上身穿着洗得发白的棉袄，下身穿着黑色裤子，脚穿黑色高跟鞋","description":"性格感恩、善良。人物关系：是老王的乘客，接受过老王归还钱包的帮助"},{"character_type":"human","name":"老王的妻子","age":"36","gender":"女","appearance":"现代人，东亚人种，眼睛为丹凤眼，眉毛弯且颜色为黑色，鼻子塌，嘴巴为厚唇，耳朵为招风耳，留着黑色齐耳短发，体型圆润","attire":"上身穿着灰色针织衫，下身穿着蓝色牛仔裤，脚穿白色运动鞋","description":"性格坚强、温柔。人物关系：是老王的妻子，老王的女儿的母亲"},{"character_type":"human","name":"老王的女儿","age":"8","gender":"女","appearance":"现代人，东亚人种，眼睛为杏眼，眉毛淡且呈弯眉、颜色为黑色，鼻子低，嘴巴为薄唇，耳朵为圆耳，头发掉光了，体型瘦弱","attire":"上身穿着粉色病号服，下身穿着蓝色病号裤，脚穿白色拖鞋","description":"人物关系：是老王和老王的妻子的女儿"},{"character_type":"human","name":"老张","age":"45","gender":"男","appearance":"现代人，东亚人种，有着浓眉大眼，眉毛粗且呈剑眉形状，颜色为黑色，鼻子高挺，嘴巴薄唇，耳朵为圆耳，眼角有细微皱纹，留着寸头短发，颜色为黑色，体型健壮","attire":"上身穿着蓝色工作服，下身穿着黑色长裤，脚穿黑色皮鞋","description":"性格真诚、善良，人物关系：是老王的同事，在老王捡到钱包后与其交流并给出建议"},{"character_type":"human","name":"林慧的丈夫","age":"38","gender":"男","appearance":"现代人，东亚人种，有着丹凤眼，眉毛细长呈柳叶眉形状，颜色为黑色，鼻子挺直，嘴巴中等大小，嘴唇偏厚，耳朵为长耳，留着短发，颜色为黑色，体型苗条","attire":"上身穿着白色衬衫，下身穿着藏青色西装裤，脚穿棕色皮鞋","description":"性格未知，人物关系：是林慧的丈夫，其治病的钱放在林慧丢失的包里"},{"character_type":"human","name":"林慧的儿子","age":"5","gender":"男","appearance":"现代人，东亚人种，有着鹅蛋眼，眉毛淡且细，形状偏弯，颜色为黑色，鼻子较塌，嘴巴樱桃小口，耳朵为招风耳，头发为黑色短发，体型瘦弱","attire":"上身穿着灰色小毛衣，下身穿着黑色小棉裤，脚穿红色小皮鞋","description":"性格懂事，人物关系：是林慧的儿子，在林慧找回钱包时安慰她"}]}



生成场次json

0:["$@1",["-QDC2S9bD7QtC_ce8k2Y-",null]]
1:[{"scene_number":"1","scene_title":"午夜拾包","scene_story":"老王把出租车停在东三环的辅路边时，雨丝已经变成了小雨。他揉了揉发酸的肩膀，从后座拿起抹布擦方向盘上的汗——这是他来北京的第三个月，每天从早六点忙到晚十点，方向盘磨出的包硌得手心发麻，计价器跳的数字却总也赶不上银行卡余额的下降。\n\n“谢了师傅。“副驾驶座的女人抓起帆布包就往地铁口跑，高跟鞋踩过水洼溅起一串泥点。老王按了下喇叭，想提醒她东西掉了，可女人已经钻进了人群，帆布包的带子松垮地垂在地上。\n\n他熄了火，推开车门捡起包。包是深棕色的牛皮，边角磨得起了毛，拉链没拉严，露出一沓沓用橡皮筋捆好的红色钞票。老王的喉结动了动，雨丝落在他脖子上，凉得像一盆冷水浇下来。\n\n“妈的。“他低骂一声，拉开车门坐进去，把包放在副驾驶座上。雨刷器左右摆动，玻璃上的水痕里映出他眼角的细纹——来北京前，他是老家县城里小有名气的装修师傅，可女儿查出白血病那天，家里积蓄掏空了还欠着债。妻子红着眼眶把存折塞给他：“去北京吧，听说那儿挣钱多。”"},{"scene_number":"2","scene_title":"内心挣扎","scene_story":"他把包放在腿上，指尖触到钞票边缘时，心跳得像揣了只兔子。十沓，每沓一万，整整十万。够给女儿交第二次化疗的押金了，够让妻子不用再打三份工，够他租个大点的房子，不用再和工友挤在隔断间......他甚至已经在脑子里规划好了怎么把钱存进银行卡，怎么告诉妻子“钱凑齐了”。\n\n“老王，你在磨蹭啥呢？“后座传来同车乘客的抱怨，老王猛地回神，把包往后座下面一塞，发动车子踩油门。出租屋里的霉味混着烟味涌进鼻腔，他掏出烟盒抖出一根，打火机打了三次才着，烟雾在狭小的空间里盘旋。\n\n车开了两圈，他把车停在路边，第一次打开了那个包。红色的钞票像火一样烫着他的眼睛，每张上面都印着天安门，他想起女儿苍白的脸，想起妻子偷偷抹眼泪的样子，手开始不受控制地颤抖。\n\n“操！“他把钱倒在中控台上，数到第七沓时，突然停住了。\n\n手机在口袋里震动，是妻子打来的。老王盯着屏幕，手指悬在接听键上。他想起出发前，父亲握着他的手说：“咱老王家，不做亏心事。“\n\n“喂，当家的。“他按下接听键，声音比平时低了八度。\n\n“钱凑够了吗？明天女儿要复查......“妻子的声音带着哭腔。\n\n“快了，“老王掐灭烟头，“我刚接了个长途活，马上就到。”挂了电话，他深吸一口气，重新把钱塞回包里，锁好车门。"},{"scene_number":"3","scene_title":"寻找失主","scene_story":"凌晨一点，老王把车开回公司调度站。“师傅，捡到东西了？“值班的老张探过头，看着他手里的包。\n\n“嗯，乘客丢的，黑色牛皮包。“老王把包放在桌上，“我得找失主。“\n\n“十万块呢，你不私藏？“老张的眼睛亮了亮，又很快黯淡下去，“你小子，还是老样子，实诚。“\n\n老王没说话，打开调度系统，翻出那个女乘客的支付记录——姓名：林慧，电话：138xxxx5678。他手指悬在拨打键上，又放下，号码存着，可他不知道对方是关机还是不接。\n\n“要不，打交通台问问？“老张提议，“失物招领节目天天有。“\n\n老王点点头，拨通了103.9的热线。电话那头传来甜美的女声，他攥着方向盘，声音发紧：“我捡到一个黑色牛皮包，里面有十万块现金，还有身份证......”\n\n挂了电话，他在纸上写下”捡到黑色牛皮包”，贴在车后窗上，又去打印店加急洗了十张寻物启事，贴在公司门口、地铁站出口、便利店玻璃门上。"},{"scene_number":"4","scene_title":"归还钱包","scene_story":"天快亮时，手机终于响了。老王抓起手机，是个陌生号码，接起时手还在抖。\n\n“是...是您捡到了我的包吗？“电话那头的女人声音带着哭腔，“我叫林慧，我...我包掉了......“\n\n“你描述一下包里的东西。“老王的声音突然变哑。\n\n“有十万块现金，是我丈夫救命的钱，还有我女儿的出生证明......“\n\n老王挂了电话，发动车子。雨停了，天边泛起鱼肚白，出租车上的计价器跳着数字，像在数他此刻的心跳。\n\n在儿童医院门口见到林慧时，老王愣住了。女人穿着洗得发白的棉袄，头发乱糟糟的，眼眶红肿，怀里紧紧抱着个小男孩——孩子脸色蜡黄，瘦得只剩一把骨头。\n\n“师傅！您是老王师傅吗？“林慧扑上来，抓住他的胳膊，“我的包！我的包！“\n\n老王把包递给她，看着她颤抖着手打开，钱整整齐齐码在里面。林慧抱着包蹲在地上哭，孩子虚弱地拉着她的衣角：“妈妈，不哭了，爸爸会好的。“\n\n“这钱...这钱我不能要。“林慧突然站起来，从口袋里掏出一沓钱，硬塞进老王手里，“师傅，我知道您不容易，这钱您拿着，不然...不然我这辈子都过意不去了。“\n\n老王捏着那沓钱，比捡到的十万块还烫。他想起女儿化疗时掉光的头发，想起妻子白天在餐馆刷碗、晚上去夜市摆摊的样子，喉咙突然哽住了。\n\n“这钱，你留着给孩子治病。“他把钱推回去，“我来北京是想挣钱，不是想靠这个。“\n\n林慧哭着给他鞠躬，孩子也跟着鞠躬，奶声奶气地说：“谢谢叔叔。”"},{"scene_number":"5","scene_title":"新的一天","scene_story":"老王发动车子时，后视镜里还能看到母子俩站在晨光里的身影。他摸了摸口袋里的钱，那沓钱像烙铁一样烫，可心里却比任何时候都踏实。计价器重新跳起来，数字从0变成1，北京的街道开始热闹起来，公交车里的乘客打着哈欠，早餐摊飘来油条的香味。\n\n他打开收音机，103.9的节目里，主持人正在说昨晚失物招领的事：“其实在这座城市里，每天都有这样或那样的故事，有人在追名逐利，有人在坚守底线。但我相信，善良和坚持，永远是照亮前路的光......”\n\n老王握紧方向盘，窗外的阳光落在他脸上。他知道未来的路还很长，每个月的房贷，女儿的后续治疗，生活的压力不会轻易消失，但他摸了摸副驾驶座上那个空了的位置，突然觉得，自己在北京这座”物欲横流”的城市里，找到了真正属于自己的东西——不是银行卡里的数字，而是伸手接住那包钱时，心里重新长出勇气的感觉。\n\n他踩下油门，出租车汇入早高峰的车流，计价器的声音清脆地响着，像在为新的一天，写下一个踏实的逗号。"}]


生成分镜传递参数
characters
: 
["老王"]
cur_scene_story
: 
"老王把出租车停在东三环的辅路边时，雨丝已经变成了小雨。他揉了揉发酸的肩膀，从后座拿起抹布擦方向盘上的汗——这是他来北京的第三个月，每天从早六点忙到晚十点，方向盘磨出的包硌得手心发麻，计价器跳的数字却总也赶不上银行卡余额的下降。\n\n“谢了师傅。“副驾驶座的女人抓起帆布包就往地铁口跑，高跟鞋踩过水洼溅起一串泥点。老王按了下喇叭，想提醒她东西掉了，可女人已经钻进了人群，帆布包的带子松垮地垂在地上。\n\n他熄了火，推开车门捡起包。包是深棕色的牛皮，边角磨得起了毛，拉链没拉严，露出一沓沓用橡皮筋捆好的红色钞票。老王的喉结动了动，雨丝落在他脖子上，凉得像一盆冷水浇下来。\n\n“妈的。“他低骂一声，拉开车门坐进去，把包放在副驾驶座上。雨刷器左右摆动，玻璃上的水痕里映出他眼角的细纹——来北京前，他是老家县城里小有名气的装修师傅，可女儿查出白血病那天，家里积蓄掏空了还欠着债。妻子红着眼眶把存折塞给他：“去北京吧，听说那儿挣钱多。”"
projectId
: 
"757a2f7e-394f-4b61-b73c-cf3f3d1e7809"

结果：0:["$@1",["-QDC2S9bD7QtC_ce8k2Y-",null]]
1:[{"id":"swk6nu-2gi8g5","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":1,"shot_size":"long-shot","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"è€çŽ‹å°†å‡ºç§Ÿè½¦åœåœ¨ä¸œä¸‰çŽ¯è¾…è·¯è¾¹ï¼Œæ­¤æ—¶é›¨ä¸å·²å˜æˆå°é›¨","lighting":null,"cn_description":"ä¸€è¾†å‡ºç§Ÿè½¦åœé åœ¨ä¸œä¸‰çŽ¯è¾…è·¯è¾¹ï¼Œé›¨æ»´åœ¨è½¦çª—ä¸Šå½¢æˆæ°´ç—•ã€‚{è€çŽ‹}ä½äºŽé©¾é©¶åº§å†…ï¼ŒåŒæ‰‹æ­åœ¨æ–¹å‘ç›˜ä¸Šã€‚èƒŒæ™¯æ˜¯åŒ—äº¬ä¸œä¸‰çŽ¯è¡—é“ï¼Œé«˜æ¥¼æž—ç«‹ï¼Œè½¦è¾†ç©¿æ¢­ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè‡ªç„¶é˜´å¤©å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"å‡ºç§Ÿè½¦ç¼“ç¼“åœé åœ¨è·¯è¾¹ï¼Œé›¨æ»´é€æ¸å˜å¤§æ‰“åœ¨è½¦çª—ä¸Šï¼Œé•œå¤´ä»Žè½¦å°¾å‘å‰ç¼“æ…¢æŽ¨è¿›","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-jb8c8u","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":2,"shot_size":"medium-closeup","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"è¿™æ˜¯ä»–æ¥åŒ—äº¬çš„ç¬¬ä¸‰ä¸ªæœˆï¼Œæ¯å¤©ä»Žæ—©å…­ç‚¹å¿™åˆ°æ™šåç‚¹","lighting":null,"cn_description":"{è€çŽ‹}ä½äºŽç”»é¢ä¸­å¤®ï¼Œå³æ‰‹æ‰æå·¦è‚©ï¼Œçœ‰å¤´å¾®çš±æ˜¾ç–²æƒ«ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦é©¾é©¶åº§ï¼Œæ–¹å‘ç›˜å’Œä»ªè¡¨ç›˜å¯è§ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè½¦å†…æ˜æš—å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"è€çŽ‹æ‰æå‘é…¸çš„è‚©è†€ï¼Œæ‰‹æŒ‡åœ¨è‚©éƒ¨ç¼“æ…¢æŒ‰åŽ‹ï¼Œé¢éƒ¨éœ²å‡ºç–²æƒ«è¡¨æƒ…","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-itk8et","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":3,"shot_size":"closeup","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"æ–¹å‘ç›˜ç£¨å‡ºçš„åŒ…ç¡Œå¾—æ‰‹å¿ƒå‘éº»ï¼Œä½†æ”¶å…¥èµ¶ä¸ä¸Šæ”¯å‡º","lighting":null,"cn_description":"{è€çŽ‹}çš„åŒæ‰‹æ¡ä½æ–¹å‘ç›˜ï¼Œæ‰‹å¿ƒæœ‰æ˜Žæ˜¾è€èŒ§å’Œç£¨å‡ºçš„åŒ…ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦æ–¹å‘ç›˜ç‰¹å†™ï¼Œçš®é©ç£¨æŸç—•è¿¹æ˜Žæ˜¾ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè½¦å†…é¡¶ç¯å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"è€çŽ‹ä»ŽåŽåº§æ‹¿èµ·æŠ¹å¸ƒï¼Œä»”ç»†æ“¦æ‹­æ–¹å‘ç›˜ä¸Šçš„æ±—æ¸ï¼Œæ‰‹æŒ‡å…³èŠ‚å¾®å¾®å‘ç™½","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-nlntfv","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":4,"shot_size":"medium-shot","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"å¥³äºº","dialogue":"è°¢äº†å¸ˆå‚…","narration":"å‰¯é©¾é©¶åº§çš„å¥³äººåŒ†å¿™ä¸‹è½¦å‘åœ°é“å£è·‘åŽ»","lighting":null,"cn_description":"å¥³äººä½äºŽç”»é¢å³ä¾§ï¼Œæ‰‹æŒå¸†å¸ƒåŒ…æŽ¨å¼€è½¦é—¨å‡†å¤‡ä¸‹è½¦ã€‚{è€çŽ‹}ä½äºŽç”»é¢å·¦ä¾§é©¾é©¶åº§ï¼Œè½¬å¤´çœ‹å‘å³ä¾§ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦å†…éƒ¨ï¼Œå‰¯é©¾é©¶åº§æ¤…å’Œè½¦é—¨å¯è§ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè‡ªç„¶é˜´å¤©å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"å¥³äººæŠ“èµ·å¸†å¸ƒåŒ…æŽ¨å¼€è½¦é—¨ï¼Œå¿«é€Ÿå‘åœ°é“å£æ–¹å‘å¥”è·‘ï¼Œé›¨æ»´æ‰“åœ¨å¥¹èº«ä¸Š","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-v2hfo8","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":5,"shot_size":"full-shot","shot_type":null,"camera_angle":"high-angle","character":"","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"å¥³äººé«˜è·Ÿéž‹è¸©è¿‡æ°´æ´¼æº…èµ·æ³¥ç‚¹ï¼Œè¿…é€Ÿæ¶ˆå¤±åœ¨äººç¾¤ä¸­","lighting":null,"cn_description":"å¥³äººèƒŒå½±å¿«é€Ÿè·‘å‘åœ°é“å£ï¼Œé«˜è·Ÿéž‹è¸©è¿‡æ°´æ´¼æº…èµ·æ³¥ç‚¹ã€‚èƒŒæ™¯æ˜¯åŒ—äº¬è¡—é“äººè¡Œé“ï¼Œè¡ŒäººåŒ†åŒ†ï¼Œåœ°é“å£åœ¨è¿œå¤„ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè‡ªç„¶é˜´å¤©å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"å¥³äººå¥”è·‘ç©¿è¿‡è¡—é“ï¼Œé«˜è·Ÿéž‹è¸©å…¥æ°´æ´¼æº…èµ·æ³¥æ°´ï¼Œèº«å½±é€æ¸èžå…¥åœ°é“å£äººç¾¤","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-gmygad","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":6,"shot_size":"closeup","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"è€çŽ‹å‘çŽ°å¥³äººé—è½äº†å¸†å¸ƒåŒ…ï¼Œä½†å·²æ— æ³•è¿½ä¸Š","lighting":null,"cn_description":"{è€çŽ‹}çš„å³æ‰‹æ‰‹æŒ‡æŒ‰ä¸‹æ–¹å‘ç›˜å–‡å­æŒ‰é’®ï¼Œè¡¨æƒ…ç„¦æ€¥ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦æ–¹å‘ç›˜å±€éƒ¨ï¼Œå–‡å­æŒ‰é’®ç‰¹å†™ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè½¦å†…æ˜æš—å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"è€çŽ‹æ‰‹æŒ‡æŒ‰ä¸‹å–‡å­æŒ‰é’®ï¼Œç›®å…‰ç„¦æ€¥åœ°æœ›å‘çª—å¤–äººç¾¤æ–¹å‘","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-aqn7ho","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":7,"shot_size":"medium-shot","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"ä»–ç†„ç«ä¸‹è½¦æ¡èµ·é‚£ä¸ªè¢«é—è½çš„å¸†å¸ƒåŒ…","lighting":null,"cn_description":"{è€çŽ‹}ä½äºŽç”»é¢ä¸­å¤®ï¼Œå¼¯è…°æ¡èµ·åœ°ä¸Šçš„å¸†å¸ƒåŒ…ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦é—¨å¤–åœ°é¢ï¼Œå¸†å¸ƒåŒ…å¸¦å­æ¾åž®åž‚åœ°ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè‡ªç„¶é˜´å¤©å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"è€çŽ‹æŽ¨å¼€è½¦é—¨ä¸‹è½¦ï¼Œå¼¯è…°æ¡èµ·åœ°ä¸Šçš„å¸†å¸ƒåŒ…ï¼Œé›¨æ»´æ‰“åœ¨ä»–èº«ä¸Š","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-l9vd3f","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":8,"shot_size":"closeup","shot_type":null,"camera_angle":"eye-level-angle","character":"","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"å¸†å¸ƒåŒ…æ‹‰é“¾æ²¡æ‹‰ä¸¥ï¼Œéœ²å‡ºé‡Œé¢æ†å¥½çš„çº¢è‰²é’žç¥¨","lighting":null,"cn_description":"æ·±æ£•è‰²ç‰›çš®å¸†å¸ƒåŒ…ç‰¹å†™ï¼Œè¾¹è§’ç£¨æŸèµ·æ¯›ï¼Œæ‹‰é“¾æœªæ‹‰ä¸¥éœ²å‡ºçº¢è‰²é’žç¥¨ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦é—¨å¤–åœ°é¢ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè‡ªç„¶é˜´å¤©å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"è€çŽ‹æ‹¿èµ·å¸†å¸ƒåŒ…ï¼Œæ‹‰é“¾å¼€å£å¤„é€æ¸éœ²å‡ºé‡Œé¢ä¸€æ²“æ²“çº¢è‰²é’žç¥¨","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-gsb7as","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":9,"shot_size":"extreme-closeup","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"è€çŽ‹çš„å–‰ç»“åŠ¨äº†åŠ¨ï¼Œé›¨ä¸è½åœ¨è„–å­ä¸Šå¦‚å†·æ°´æµ‡ä¸‹","lighting":null,"cn_description":"{è€çŽ‹}çš„å–‰ç»“ç‰¹å†™ï¼Œé›¨æ»´è½åœ¨é¢ˆéƒ¨çš®è‚¤ä¸Šã€‚èƒŒæ™¯æ¨¡ç³Šçš„å‡ºç§Ÿè½¦è½¦èº«ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè‡ªç„¶é˜´å¤©å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"è€çŽ‹å–‰ç»“ä¸Šä¸‹æ»šåŠ¨ï¼Œé›¨æ»´é¡ºç€è„–å­æ»‘è½ï¼Œå‘¼å¸ç•¥å¾®æ€¥ä¿ƒ","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-gpqxuc","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":10,"shot_size":"medium-closeup","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"è€çŽ‹","dialogue":"å¦ˆçš„","narration":"ä»–ä½Žéª‚ä¸€å£°ï¼Œå¸¦ç€åŒ…å›žåˆ°è½¦å†…","lighting":null,"cn_description":"{è€çŽ‹}ä½äºŽé©¾é©¶åº§ï¼Œå˜´å”‡å¾®åŠ¨ä½Žå£°å’’éª‚ï¼Œè¡¨æƒ…å¤æ‚ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦å†…é©¾é©¶åº§ï¼Œå‰¯é©¾é©¶åº§ä½ç©ºç€ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè½¦å†…æ˜æš—å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"è€çŽ‹ä½Žå£°å’’éª‚ï¼Œæ‹‰å¼€è½¦é—¨åè¿›é©¾é©¶åº§ï¼Œå°†åŒ…æ”¾åœ¨å‰¯é©¾é©¶åº§ä½ä¸Š","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-x6e974","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":11,"shot_size":"closeup","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"é›¨åˆ·å™¨æ‘†åŠ¨ï¼ŒçŽ»ç’ƒæ°´ç—•æ˜ å‡ºä»–çœ¼è§’çš„ç»†çº¹","lighting":null,"cn_description":"é€è¿‡é›¨æ°´æ¨¡ç³Šçš„è½¦çª—çŽ»ç’ƒï¼Œ{è€çŽ‹}çš„ä¾§è„¸è½®å»“å’Œçœ¼è§’ç»†çº¹éšçº¦å¯è§ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦å‰æŒ¡é£ŽçŽ»ç’ƒï¼Œé›¨åˆ·å™¨åˆ’è¿‡çš„ç—•è¿¹ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè‡ªç„¶é˜´å¤©å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"é›¨åˆ·å™¨å·¦å³æ‘†åŠ¨ï¼Œé€è¿‡çŽ»ç’ƒæ°´ç—•å¯ä»¥çœ‹åˆ°è€çŽ‹æ²‰æ€çš„ä¾§è„¸è½®å»“","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null},{"id":"swk6nu-zimwin","creator":"0393b397-73ad-4bbb-aa11-4456b336222d","project_id":"757a2f7e-394f-4b61-b73c-cf3f3d1e7809","scene_id":"swk6nu","created_time":"$D2025-11-15T13:20:16.526Z","updated_time":"$D2025-11-15T13:20:16.526Z","shot_number":12,"shot_size":"medium-closeup","shot_type":null,"camera_angle":"eye-level-angle","character":"è€çŽ‹","shot_duration":0,"dialogue_character":"","dialogue":"","narration":"æ¥åŒ—äº¬å‰ä»–æ˜¯åŽ¿åŸŽè£…ä¿®å¸ˆå‚…ï¼Œå¥³å„¿æ‚£ç—…åŽå®¶å¾’å››å£","lighting":null,"cn_description":"{è€çŽ‹}ä½äºŽç”»é¢ä¸­å¤®ï¼Œçœ¼ç¥žå‡è§†è¿œæ–¹é™·å…¥å›žå¿†ï¼Œçœ¼è§’ç»†çº¹æ˜Žæ˜¾ã€‚èƒŒæ™¯æ˜¯å‡ºç§Ÿè½¦é©¾é©¶åº§ï¼Œæ–¹å‘ç›˜å’Œä»ªè¡¨ç›˜å¯è§ï¼Œé›¨å¤©å‚æ™šï¼Œç°å†·è‰²è°ƒï¼Œè½¦å†…æ˜æš—å…‰çº¿","en_description":null,"remark":null,"picture":null,"picture_prompt":null,"current_picture_id":null,"sort":null,"movement":"è€çŽ‹ç›®å…‰å‡è§†è¿œæ–¹ï¼Œæ‰‹æŒ‡æ— æ„è¯†åœ°åœ¨æ–¹å‘ç›˜ä¸Šè½»è½»æ•²å‡»","camera_movement":null,"video_url":null,"is_lip_sync":null,"subtitle":null}]



