// Gemini calls: story/frames writing and captions (text model), bubble placement (text model with vision),
// frame prompt + reference images -> image (image model).
import { GoogleGenAI } from '@google/genai';

const SCRIPT_WRITER = 'Bạn là biên kịch truyện tranh ngắn cảm động cho kênh TikTok/YouTube Việt Nam, phong cách đời thường ấm áp.';

function createClient(settings) {
  if (!settings.apiKey) {
    const err = new Error('Chưa cấu hình Gemini API key (tab Cài đặt hoặc file .env)');
    err.status = 400;
    throw err;
  }
  return new GoogleGenAI({ apiKey: settings.apiKey });
}

/** Converts SDK/API failures into short, actionable messages. */
function toHttpError(err) {
  if (err.status && err.status < 500 && !err.name?.includes('ApiError')) return err;
  const code = err.status;
  let message = err.message || String(err);
  if (code === 429) message = 'Gemini báo vượt giới hạn/quota (429). Kiểm tra billing hoặc chờ một lúc rồi thử lại.';
  else if (code === 401 || code === 403) message = 'API key không hợp lệ hoặc không có quyền dùng model này.';
  else if (code === 404) message = `Không tìm thấy model (404). Kiểm tra tên model trong Cài đặt. Chi tiết: ${message}`;
  const httpErr = new Error(`Gemini: ${message}`);
  httpErr.status = 502;
  return httpErr;
}

function badResponse(message) {
  const err = new Error(`Gemini: ${message}`);
  err.status = 502;
  return err;
}

/** Text-model call returning parsed JSON that follows `schema`. */
async function generateJson(settings, contents, schema, { temperature = 0.9, systemInstruction } = {}) {
  const ai = createClient(settings);
  try {
    const response = await ai.models.generateContent({
      model: settings.textModel,
      contents,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        temperature,
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (err) {
    throw toHttpError(err);
  }
}

const NON_CHAT_MODEL = /tts|transcribe|robotics|computer-use|customtools|embedding|omni/;
const modelVersion = (name) => parseFloat(/gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1]) || 0;

/** Gemini models this key can call with generateContent, newest first, split into text and image models. */
export async function listModels(settings) {
  const ai = createClient(settings);
  try {
    const names = [];
    for await (const m of await ai.models.list({ config: { pageSize: 100 } })) {
      if (!(m.supportedActions || []).includes('generateContent') || !/^models\/gemini/.test(m.name)) continue;
      const name = m.name.replace('models/', '');
      if (!NON_CHAT_MODEL.test(name)) names.push(name);
    }
    names.sort((a, b) => modelVersion(b) - modelVersion(a));
    return { text: names.filter((n) => !n.includes('image')), image: names.filter((n) => n.includes('image')) };
  } catch (err) {
    throw toHttpError(err);
  }
}

const castText = (characters) =>
  characters.length
    ? characters.map((c) => `- ${c.name}: ${c.description || '(chưa có mô tả)'}`).join('\n')
    : '(chưa chọn nhân vật, có thể tự đặt nhân vật phụ nhưng không bắt buộc)';

const FRAME_RULES = `- Bối cảnh, hành động, biểu cảm viết cụ thể để hoạ sĩ vẽ được.
- Nếu cần thể hiện thời gian trong ngày, mô tả qua ánh sáng, bầu trời, hoạt động ngay trong bối cảnh; không thêm đồng hồ trừ khi cốt truyện thật sự cần.
- Lời thoại tiếng Việt tự nhiên, rất ngắn (tối đa khoảng 10 từ mỗi câu), mỗi khung 0–2 câu.`;

const FRAME_ITEM = {
  type: 'object',
  properties: {
    scene: { type: 'string', description: 'Bối cảnh: địa điểm, thời gian trong ngày, ánh sáng, đồ vật xung quanh' },
    action: { type: 'string', description: 'Hành động cụ thể của từng nhân vật, góc máy' },
    expression: { type: 'string', description: 'Biểu cảm khuôn mặt, cảm xúc' },
    characters: { type: 'array', items: { type: 'string' }, description: 'Tên các nhân vật xuất hiện, đúng tên đã cho' },
    dialogues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', description: 'Tên nhân vật nói' },
          text: { type: 'string', description: 'Lời thoại tiếng Việt, ngắn' },
        },
        required: ['speaker', 'text'],
      },
    },
  },
  required: ['scene', 'action', 'expression', 'characters', 'dialogues'],
};

const FRAMES_SCHEMA = {
  type: 'object',
  properties: { frames: { type: 'array', items: FRAME_ITEM } },
  required: ['frames'],
};

const STORY_SCHEMA = {
  type: 'object',
  properties: {
    slides: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          idea: { type: 'string', description: 'Tóm tắt 1–2 câu nội dung ảnh' },
          frames: { type: 'array', items: FRAME_ITEM },
        },
        required: ['idea', 'frames'],
      },
    },
  },
  required: ['slides'],
};

/** Writes the whole story at once: slide ideas and every frame, so pacing and continuity stay coherent. */
export async function generateStoryPlan({ settings, storyIdea, slideCount, framesPerSlide, characters }) {
  const framesRule =
    framesPerSlide === 'auto'
      ? 'Mỗi ảnh gồm 1 đến 3 khung truyện tranh: dùng 1 khung cho khoảnh khắc quan trọng hoặc cảm xúc mạnh, 2–3 khung cho diễn biến liên tiếp.'
      : `Mỗi ảnh gồm đúng ${framesPerSlide} khung truyện tranh nối tiếp nhau.`;

  const prompt = `Cốt truyện:
${storyIdea}

Nhân vật được phép dùng (dùng đúng tên):
${castText(characters)}

Nhiệm vụ: chia câu chuyện thành đúng ${slideCount} ảnh. Mỗi ảnh là 1 slide đăng TikTok, người xem lướt lần lượt.
- ${framesRule}
- Ảnh đầu mở ra tò mò, có diễn biến và cao trào, ảnh cuối kết thúc đọng lại cảm xúc.
- idea: tóm tắt 1–2 câu nội dung của ảnh.
${FRAME_RULES}`;

  const data = await generateJson(settings, prompt, STORY_SCHEMA, { systemInstruction: SCRIPT_WRITER });
  if (!Array.isArray(data.slides) || !data.slides.length) throw badResponse('Model không trả về ảnh nào');
  return data.slides;
}

/** Writes the frames of one story image, with the whole outline as context for continuity. */
export async function generateFrames({ settings, storyIdea, slideIdeas, slideIndex, frameCount, characters }) {
  const outline = slideIdeas
    .map((idea, i) => `Ảnh ${i + 1}${i === slideIndex ? ' (ẢNH CẦN VIẾT)' : ''}: ${idea?.trim() || '(chưa có ý tưởng)'}`)
    .join('\n');

  const prompt = `Tóm tắt cả câu chuyện:
${storyIdea?.trim() || '(không có)'}

Dàn ý các ảnh trong truyện (mỗi ảnh là 1 slide khi đăng):
${outline}

Nhân vật được phép dùng (dùng đúng tên):
${castText(characters)}

Nhiệm vụ: viết chi tiết cho Ảnh ${slideIndex + 1}, ${
    frameCount === 1 ? 'gồm đúng 1 khung (một cảnh duy nhất)' : `chia thành đúng ${frameCount} khung truyện tranh nối tiếp nhau`
  }.
- Bám sát ý tưởng của ảnh này, giữ mạch với các ảnh trước và sau.
${FRAME_RULES}`;

  const data = await generateJson(settings, prompt, FRAMES_SCHEMA, { systemInstruction: SCRIPT_WRITER });
  if (!Array.isArray(data.frames) || !data.frames.length) throw badResponse('Model không trả về khung nào');
  return data.frames;
}

const BUBBLE_SCHEMA = {
  type: 'object',
  properties: {
    bubbles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Số thứ tự câu thoại đã cho' },
          text: { type: 'string', description: 'Câu thoại tiếng Việt, đã chỉnh cho khớp ảnh nếu cần' },
          speakerX: { type: 'integer', description: 'Toạ độ X (0–1000) của đầu/miệng người nói' },
          speakerY: { type: 'integer', description: 'Toạ độ Y (0–1000) của đầu/miệng người nói' },
          bubbleX: { type: 'integer', description: 'Toạ độ X (0–1000) tâm bóng thoại' },
          bubbleY: { type: 'integer', description: 'Toạ độ Y (0–1000) tâm bóng thoại' },
        },
        required: ['index', 'text', 'speakerX', 'speakerY', 'bubbleX', 'bubbleY'],
      },
    },
  },
  required: ['bubbles'],
};

const toUnit = (v) => Math.min(1, Math.max(0, Number(v) / 1000 || 0));

/**
 * Looks at a generated frame and returns, per dialogue line, where the speaker is and where the bubble fits,
 * plus the line reworded to match the picture. Coordinates are normalized (0..1) to the image.
 */
export async function placeBubbles({ settings, image, scene, action, dialogues, characters }) {
  const lines = dialogues.map((d, i) => `${i}. ${d.speaker || 'Không rõ'}: "${d.text}"`).join('\n');
  const instructions = `Đây là một khung truyện tranh đã vẽ xong.
Bối cảnh: ${scene || '(không rõ)'}
Hành động: ${action || '(không rõ)'}
Nhân vật có thể xuất hiện:
${castText(characters)}

Các câu thoại cần đặt vào khung (theo thứ tự đọc):
${lines}

Với từng câu, trả về:
- speakerX, speakerY: vị trí đầu/miệng của người nói trong ảnh (toạ độ 0–1000, gốc ở góc trên trái). Nếu người nói không có trong ảnh, chọn điểm ở mép ảnh phía họ.
- bubbleX, bubbleY: tâm bóng thoại, đặt ở vùng trống (tường, trời, nền), gần người nói, KHÔNG che mặt hoặc chi tiết quan trọng, các bóng không chồng lên nhau, câu nói trước đặt cao hơn câu sau.
- text: giữ nguyên ý, có thể chỉnh từ ngữ cho khớp biểu cảm và hành động trong ảnh; tiếng Việt, tối đa khoảng 10 từ.`;

  const data = await generateJson(settings, [{ role: 'user', parts: [{ inlineData: image }, { text: instructions }] }], BUBBLE_SCHEMA, {
    temperature: 0.4,
  });
  return (data.bubbles || [])
    .filter((b) => Number.isInteger(b.index) && b.index >= 0 && b.index < dialogues.length)
    .map((b) => ({
      index: b.index,
      text: String(b.text || ''),
      speakerX: toUnit(b.speakerX),
      speakerY: toUnit(b.speakerY),
      bubbleX: toUnit(b.bubbleX),
      bubbleY: toUnit(b.bubbleY),
    }));
}

const CAPTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Tiêu đề bài đăng ảnh TikTok, tối đa 80 ký tự' },
    caption: { type: 'string', description: 'Mô tả 1–3 câu tiếng Việt, câu đầu gây tò mò, có thể có emoji' },
    hashtags: { type: 'array', items: { type: 'string' }, description: '5–8 hashtag, không dấu cách, không kèm dấu #' },
    musicMood: { type: 'string', description: 'Tâm trạng và thể loại nhạc nền phù hợp, tiếng Việt' },
    musicKeywords: { type: 'array', items: { type: 'string' }, description: '3–5 từ khoá để tìm nhạc trong thư viện âm thanh TikTok' },
  },
  required: ['title', 'caption', 'hashtags', 'musicMood', 'musicKeywords'],
};

/** Title, caption, hashtags and background-music suggestion for posting the story as a TikTok photo carousel. */
export async function generateCaption({ settings, title, storyIdea, slides }) {
  const outline = slides
    .map((s, i) => `Ảnh ${i + 1}: ${s.idea || '(không có ý tưởng)'}${s.dialogues.length ? `\n  Thoại: ${s.dialogues.join(' / ')}` : ''}`)
    .join('\n');
  const prompt = `Truyện tranh "${title}" đăng dạng bài ảnh (carousel) trên TikTok.
Tóm tắt: ${storyIdea?.trim() || '(không có)'}
Nội dung từng ảnh:
${outline}

Viết tiêu đề, caption, hashtag và gợi ý nhạc nền để đăng bài.
- Caption tự nhiên, không tiết lộ kết truyện, khuyến khích người xem lướt hết các ảnh.
- Hashtag kết hợp chủ đề truyện và hashtag phổ biến tiếng Việt.
- Không bịa tên bài hát cụ thể, chỉ mô tả mood và từ khoá tìm nhạc.`;

  return generateJson(settings, prompt, CAPTION_SCHEMA, { temperature: 1 });
}

/**
 * @param {{settings, prompt: string, refs: {label, mimeType, data}[], aspectRatio?: string}} args
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
export async function generateImage({ settings, prompt, refs, aspectRatio }) {
  const ai = createClient(settings);
  // Each reference image is preceded by a label so the model knows who/what it shows.
  const parts = [];
  for (const ref of refs) {
    parts.push({ text: `${ref.label}:` });
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }
  parts.push({ text: prompt });

  let response;
  try {
    response = await ai.models.generateContent({
      model: settings.imageModel,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
      },
    });
  } catch (err) {
    throw toHttpError(err);
  }

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p) => p.inlineData?.data);
  if (!imagePart) {
    const reason =
      response.promptFeedback?.blockReason ||
      candidate?.finishReason ||
      candidate?.content?.parts?.find((p) => p.text)?.text ||
      'không rõ lý do';
    throw badResponse(`không trả về ảnh (${reason}). Thử sửa prompt rồi tạo lại.`);
  }
  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}
