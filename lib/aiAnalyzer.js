export const DEFAULT_SETTINGS = {
  useMockAnalysis: true,
  provider: "openai",
  apiKey: "",
  model: "gpt-4.1",
  analysisLanguage: "zh-CN",
  autoSaveAnalysis: true,
  showDebugInfo: false
};

export const SETTINGS_STORAGE_KEY = "aestheticLensSettings";

const REMOTE_IMAGE_UNREADABLE_MESSAGE = "当前图片无法被远程模型读取，请使用截图分析模式。";
const SCHEMA_URL = new URL("./AI_ANALYSIS_SCHEMA.json", import.meta.url);
const DEFAULT_GOOGLE_MODEL = "gemini-3.5-flash";
const SCHEMA_VERSION = "1.0.0";

let schemaPromise = null;

export async function analyzeImage(imageInput) {
  validateImageInput(imageInput);
  const schema = await loadAnalysisSchema();
  const settings = await loadAnalyzerSettings();

  if (!settings.useMockAnalysis && !settings.apiKey) {
    throw new Error("请先在设置页填写 API Key，或开启 Mock 分析模式。");
  }

  const result = settings.useMockAnalysis
    ? await mockAnalyzeImage(imageInput, schema)
    : await analyzeImageWithVision(imageInput, schema, settings);

  return normalizeAndValidateAnalysisResult(result, schema, settings);
}

export async function analyzeImageWithVision(imageInput, schema = null, settings = null) {
  validateImageInput(imageInput);
  assertRemoteModelReadableUrl(imageInput.imageUrl);

  const analysisSchema = schema || await loadAnalysisSchema();
  const activeSettings = settings || await loadAnalyzerSettings();

  if (activeSettings.provider === "openai") {
    return callOpenAiVisionAnalysis(imageInput, analysisSchema, activeSettings);
  }

  if (activeSettings.provider === "google") {
    return callGoogleVisionAnalysis(imageInput, analysisSchema, activeSettings);
  }

  if (activeSettings.provider === "custom") {
    return callCustomVisionAnalysis(imageInput, analysisSchema, activeSettings);
  }

  throw new Error(`Unsupported vision model provider: ${activeSettings.provider}`);
}

export function loadAnalysisSchema() {
  if (!schemaPromise) {
    schemaPromise = fetch(SCHEMA_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load AI analysis schema: ${response.status}`);
      }

      return response.json();
    });
  }

  return schemaPromise;
}

function validateImageInput(imageInput) {
  if (!imageInput || !imageInput.imageUrl) {
    throw new Error("imageInput.imageUrl is required.");
  }
}

function assertRemoteModelReadableUrl(imageUrl) {
  try {
    const url = new URL(imageUrl);
    if (!["http:", "https:", "data:"].includes(url.protocol)) {
      throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
    }
  } catch (error) {
    throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
  }
}

async function callOpenAiVisionAnalysis(imageInput, schema, settings) {
  const apiKey = normalizeApiKeyForHeader(settings.apiKey);
  if (!apiKey) {
    throw new Error("请先在设置页填写 API Key，或开启 Mock 分析模式。");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_SETTINGS.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildVisionPrompt(schema, settings)
            },
            {
              type: "input_image",
              image_url: imageInput.imageUrl,
              detail: "high"
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "aesthetic_lens_ai_image_analysis",
          schema,
          strict: true
        }
      }
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiErrorMessage(payload);
    if (isRemoteImageReadError(message, response.status)) {
      throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
    }

    throw new Error(message || `Vision API request failed: ${response.status}`);
  }

  return parseModelJsonOutput(extractResponseText(payload));
}

async function callCustomVisionAnalysis(imageInput, schema, settings) {
  const apiKey = normalizeApiKeyForHeader(settings.apiKey);
  if (!apiKey) {
    throw new Error("请先在设置页填写 API Key，或开启 Mock 分析模式。");
  }

  throw new Error("Custom provider endpoint 尚未在设置页开放配置。");

  const response = await fetch(settings.customEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image: {
        imageUrl: imageInput.imageUrl
      },
      instruction: buildVisionPrompt(schema, settings),
      schema
    })
  });

  const text = await response.text();
  if (!response.ok) {
    if (isRemoteImageReadError(text, response.status)) {
      throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
    }

    throw new Error(text || `Custom vision API request failed: ${response.status}`);
  }

  return parseModelJsonOutput(text);
}

async function callGoogleVisionAnalysis(imageInput, schema, settings) {
  const apiKey = normalizeApiKeyForHeader(settings.apiKey);
  if (!apiKey) {
    throw new Error("请先在设置页填写 API Key，或开启 Mock 分析模式。");
  }

  const imagePart = await buildInlineImagePart(imageInput.imageUrl);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model || DEFAULT_GOOGLE_MODEL)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            imagePart,
            {
              text: buildVisionPrompt(schema, settings)
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: buildGeminiResponseSchema(schema)
      }
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiErrorMessage(payload);
    if (isRemoteImageReadError(message, response.status)) {
      throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
    }

    throw new Error(message || `Gemini API request failed: ${response.status}`);
  }

  return parseModelJsonOutput(extractGeminiResponseText(payload));
}

function normalizeApiKeyForHeader(apiKey) {
  const normalized = String(apiKey || "").replace(/\s+/g, "").trim();
  if (!normalized) {
    return "";
  }

  if (!/^[\x20-\x7E]+$/.test(normalized)) {
    throw new Error("API Key 包含无法用于请求头的字符。请在设置页重新粘贴纯 API Key，不要包含中文、引号、说明文字或特殊空格。");
  }

  return normalized;
}

async function buildInlineImagePart(imageUrl) {
  let response;
  try {
    response = await fetch(imageUrl);
  } catch (error) {
    throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
  }

  const mimeType = response.headers.get("content-type") || "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
  }

  const bytes = await response.arrayBuffer();
  return {
    inline_data: {
      mime_type: mimeType.split(";")[0],
      data: arrayBufferToBase64(bytes)
    }
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  return btoa(binary);
}

function extractGeminiResponseText(payload) {
  const parts = payload
    && payload.candidates
    && payload.candidates[0]
    && payload.candidates[0].content
    && payload.candidates[0].content.parts;

  if (!Array.isArray(parts)) {
    throw new Error("Gemini API response did not contain JSON text.");
  }

  const text = parts.map((part) => part.text || "").join("");
  if (!text) {
    throw new Error("Gemini API response did not contain JSON text.");
  }

  return text;
}

function buildGeminiResponseSchema(schema) {
  if (Array.isArray(schema)) {
    return schema.map(buildGeminiResponseSchema);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const next = {};
  Object.entries(schema).forEach(([key, value]) => {
    if (["$schema", "title", "description", "additionalProperties"].includes(key)) {
      return;
    }

    if (key === "const") {
      next.enum = [value];
      return;
    }

    next[key] = buildGeminiResponseSchema(value);
  });

  return next;
}

export async function loadAnalyzerSettings() {
  if (!globalThis.chrome || !chrome.storage || !chrome.storage.local) {
    return { ...DEFAULT_SETTINGS };
  }

  const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  return normalizeSettings(result[SETTINGS_STORAGE_KEY]);
}

export function normalizeSettings(value) {
  return {
    ...DEFAULT_SETTINGS,
    ...(value && typeof value === "object" ? value : {}),
    useMockAnalysis: typeof (value && value.useMockAnalysis) === "boolean" ? value.useMockAnalysis : DEFAULT_SETTINGS.useMockAnalysis,
    autoSaveAnalysis: typeof (value && value.autoSaveAnalysis) === "boolean" ? value.autoSaveAnalysis : DEFAULT_SETTINGS.autoSaveAnalysis,
    showDebugInfo: typeof (value && value.showDebugInfo) === "boolean" ? value.showDebugInfo : DEFAULT_SETTINGS.showDebugInfo
  };
}

function buildVisionPrompt(schema, settings) {
  const languageInstruction = settings.analysisLanguage === "zh-CN"
    ? "Write all free-text analysis, tags, prompt.zh, evidence, function, aesthetic_value fields, and reusable direction labels in Simplified Chinese. Do not mix English into tags or prompt.zh. Use English only where the schema enum requires an exact English value, or in prompt.en."
    : "Write all free-text analysis in English unless a schema field explicitly requests another language.";

  return [
    "You are Aesthetic Lens, a strict multimodal image analyst.",
    `Analysis language preference: ${settings.analysisLanguage}.`,
    languageInstruction,
    "Analyze ONLY the visible image content sent as input_image.",
    "Do not infer visual facts from imageUrl, pageUrl, pageTitle, file name, dimensions, or metadata.",
    "Use metadata only for non-visual bookkeeping if a schema field explicitly requires it.",
    "You must judge every visual field from visible pixels in the image.",
    "If a visual attribute cannot be determined from the visible image, use the schema enum value unknown when available and explain the reason in evidence.",
    "Every analysis item that has label/evidence/function must include all three fields.",
    "Return JSON only. Do not output markdown, code fences, comments, explanations, or prose outside JSON.",
    "The JSON must strictly conform to this JSON Schema:",
    JSON.stringify(schema)
  ].join("\n");
}

function parseModelJsonOutput(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`模型输出不是合法 JSON：${error.message}`);
  }
}

function extractResponseText(payload) {
  if (!payload) {
    throw new Error("Vision API returned an empty response.");
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const textParts = [];
  (payload.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.type === "output_text" && typeof content.text === "string") {
        textParts.push(content.text);
      }
    });
  });

  if (textParts.length === 0) {
    throw new Error("Vision API response did not contain JSON text.");
  }

  return textParts.join("");
}

function extractApiErrorMessage(payload) {
  if (!payload) {
    return "";
  }

  if (payload.error && payload.error.message) {
    return payload.error.message;
  }

  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

function isRemoteImageReadError(message, status) {
  const normalized = String(message || "").toLowerCase();
  return [400, 403, 404, 415, 422].includes(status)
    && (
      normalized.includes("image")
      || normalized.includes("url")
      || normalized.includes("download")
      || normalized.includes("fetch")
      || normalized.includes("access")
      || normalized.includes("forbidden")
      || normalized.includes("unsupported")
    );
}

async function mockAnalyzeImage(imageInput, schema) {
  const width = Number(imageInput.width) || 0;
  const height = Number(imageInput.height) || 0;
  const aspectRatio = formatAspectRatio(width, height);
  const orientation = getSchemaOrientation(width, height);
  const orientationTag = orientation === "unknown" ? "flexible-framing" : orientation;
  const compositionLabel = orientation === "portrait" ? "vertical framing" : "horizontal framing";

  return {
    schema_version: getSchemaVersion(schema),
    image_basic: {
      aspect_ratio: aspectRatio,
      orientation,
      dominant_colors: ["deep charcoal", "soft neutral", "muted accent"],
      brightness: "mid-key",
      contrast: "medium contrast",
      saturation: "medium saturation",
      visual_density: "medium density"
    },
    cinematic_analysis: {
      shot_size: {
        label: orientation === "portrait" ? "medium close-up" : "long shot",
        evidence: "Visible framing leaves space around the main subject while keeping the primary form readable.",
        function: "Balances subject recognition with environmental information."
      },
      camera_angle: {
        label: "eye-level",
        evidence: "The visible frame does not show strong overhead, low-angle, or tilted perspective cues.",
        function: "Creates a stable and accessible viewing relationship."
      },
      viewpoint: {
        label: "observational view",
        evidence: "The image reads as an external observation rather than an explicit first-person or surveillance perspective.",
        function: "Keeps attention on visual structure and style rather than character subjectivity."
      },
      composition: {
        labels: [compositionLabel, "open composition"],
        subject_position: orientation === "portrait" ? "Primary attention is organized along the vertical axis." : "Primary attention is distributed across the horizontal field.",
        visual_focus: "The strongest readable area anchors the viewer before secondary details are explored.",
        eye_flow: orientation === "portrait" ? "The eye moves through stacked vertical information." : "The eye travels laterally across the frame.",
        function: "Provides a reusable framing pattern for reference collection and prompt writing."
      },
      lighting: {
        key_light_direction: "ambient light",
        light_quality: "soft light",
        lighting_ratio: "medium ratio",
        shadow_behavior: "Shadows support form readability without dominating the frame.",
        lighting_style: ["natural window light"],
        function: "Maintains clarity while preserving atmosphere."
      },
      color_system: {
        temperature: "neutral",
        palette: ["deep charcoal", "soft neutral", "muted accent"],
        color_relationship: "neutral with accent color",
        function: "The restrained palette makes the image useful as a flexible design reference."
      },
      tone: {
        label: "middle-key",
        evidence: "The image sits between bright high-key treatment and heavy low-key darkness.",
        function: "Keeps details readable while retaining mood."
      },
      focal_length_feeling: {
        label: orientation === "landscape" ? "standard lens feeling" : "medium focal length feeling",
        evidence: "The visible spatial relationship does not show extreme wide-angle distortion or heavy telephoto compression.",
        function: "Keeps spatial relationships natural and reusable."
      },
      depth_of_field: {
        label: "medium depth of field",
        evidence: "Subject and context remain visually related rather than being completely separated.",
        function: "Preserves both subject clarity and contextual cues."
      },
      spatial_layers: {
        foreground: "Foreground acts as the first reading layer.",
        midground: "Midground carries the main readable subject or structure.",
        background: "Background provides contextual atmosphere and contrast.",
        depth_strategy: "Layering separates readable foreground, midground, and background roles.",
        function: "Helps translate the image into reusable spatial prompt language."
      },
      texture: {
        materials: ["digital image surface", "environmental detail", "soft tonal gradients"],
        surface_response: "Surfaces respond with controlled contrast and readable tonal transitions.",
        function: "Provides concrete material handles for downstream prompt writing."
      },
      mood: {
        labels: ["restrained", "realistic"],
        visual_causes: "Balanced framing, neutral palette, and mid-key tone create a calm reference-oriented mood."
      }
    },
    aesthetic_value: {
      core_value: "A reusable visual reference for composition, framing, and prompt development.",
      why_it_works: "The visible structure offers clear framing, mood, and spatial cues.",
      visual_focus: "Frame proportion, composition strategy, and inferred visual hierarchy.",
      reusable_elements: [
        "aspect ratio",
        "camera viewpoint",
        "composition strategy",
        "lighting style",
        "prompt language"
      ],
      can_be_used_for: [
        "moodboard collection",
        "AI prompt writing",
        "composition reference",
        "design direction notes"
      ],
      score: 0.78
    },
    prompt: {
      zh: `以${orientationLabel(orientation)}画幅 ${aspectRatio} 创作一张具有克制真实感的视觉参考图，强调清晰构图、自然视角、中性配色、柔和光线、可读空间层次和可复用的设计细节。`,
      en: `Create a restrained realistic visual reference in a ${orientationTag} ${aspectRatio} frame, with clear composition, observational viewpoint, neutral color system, soft ambient lighting, readable spatial layers, and reusable design details.`,
      negative_prompt: "avoid unreadable clutter, broken anatomy, overprocessed HDR, excessive blur, noisy compression artifacts, random text, watermark"
    },
    tags: [
      orientationTag,
      aspectRatio,
      "cinematic-reference",
      "composition-study",
      "design-prompt"
    ]
  };
}

function normalizeAndValidateAnalysisResult(result, schema, settings = DEFAULT_SETTINGS) {
  if (!result || typeof result !== "object") {
    throw new Error("模型输出 JSON 不是对象。");
  }

  const rawTags = Array.isArray(result.tags) ? result.tags.filter((tag) => tag && !/^unknown$/i.test(tag)) : [];
  const normalized = {
    ...result,
    schema_version: result.schema_version || getSchemaVersion(schema),
    tags: settings.analysisLanguage === "zh-CN" ? localizeTags(rawTags) : rawTags
  };

  if (normalized.tags.length < 3) {
    const fallbackTags = settings.analysisLanguage === "zh-CN"
      ? ["电影感参考", "构图参考", "设计提示词"]
      : ["cinematic-reference", "composition-study", "design-prompt"];
    normalized.tags = [...new Set([...normalized.tags, ...fallbackTags])];
  }

  validateAgainstSchema(schema, normalized);
  return normalized;
}

function localizeTags(tags) {
  const tagLabels = {
    "ai prompt writing": "AI 提示词",
    cinematic: "电影感",
    "cinematic-reference": "电影感参考",
    clubbing: "夜店氛围",
    "composition reference": "构图参考",
    "composition-study": "构图参考",
    "design direction notes": "设计方向",
    "design-prompt": "设计提示词",
    "flexible-framing": "灵活画幅",
    landscape: "横向画幅",
    "moodboard collection": "情绪板",
    portrait: "纵向画幅",
    reference: "参考图",
    square: "方形画幅",
    unknown: ""
  };

  return [...new Set(tags
    .map((tag) => {
      const value = String(tag || "").trim();
      const key = value.toLowerCase();
      if (!value || tagLabels[key] === "") {
        return "";
      }

      if (tagLabels[key]) {
        return tagLabels[key];
      }

      if (/^[\d\s:./-]+$/.test(value)) {
        return value;
      }

      if (/^[a-z][a-z0-9\s_-]*$/i.test(value)) {
        return "视觉参考";
      }

      return value;
    })
    .filter(Boolean))];
}

function validateAgainstSchema(schema, value, path = "analysis") {
  if (!schema) {
    return;
  }

  if (schema.const !== undefined && value !== schema.const) {
    throw new Error(`${path} must be ${schema.const}.`);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    throw new Error(`${path} must be one of: ${schema.enum.join(", ")}.`);
  }

  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${path} must be an object.`);
    }

    (schema.required || []).forEach((key) => {
      if (!(key in value)) {
        throw new Error(`${path}.${key} is required.`);
      }
    });

    if (schema.additionalProperties === false && schema.properties) {
      Object.keys(value).forEach((key) => {
        if (!(key in schema.properties)) {
          throw new Error(`${path}.${key} is not allowed by schema.`);
        }
      });
    }

    Object.entries(schema.properties || {}).forEach(([key, childSchema]) => {
      if (key in value) {
        validateAgainstSchema(childSchema, value[key], `${path}.${key}`);
      }
    });
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      throw new Error(`${path} must be an array.`);
    }

    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new Error(`${path} must contain at least ${schema.minItems} items.`);
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      throw new Error(`${path} must contain at most ${schema.maxItems} items.`);
    }

    value.forEach((item, index) => validateAgainstSchema(schema.items, item, `${path}[${index}]`));
  }

  if (schema.type === "string" && typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }

  if (schema.type === "number" && typeof value !== "number") {
    throw new Error(`${path} must be a number.`);
  }
}

function getSchemaVersion(schema) {
  return schema
    && schema.properties
    && schema.properties.schema_version
    && schema.properties.schema_version.const
    ? schema.properties.schema_version.const
    : "1.0.0";
}

function getSchemaOrientation(width, height) {
  if (!width || !height) {
    return "unknown";
  }

  const ratio = width / height;
  if (ratio >= 2) {
    return "panoramic";
  }

  if (ratio > 1.08) {
    return "landscape";
  }

  if (ratio < 0.92) {
    return "portrait";
  }

  return "square";
}

function orientationLabel(orientation) {
  if (orientation === "landscape") {
    return "横向";
  }

  if (orientation === "portrait") {
    return "纵向";
  }

  if (orientation === "panoramic") {
    return "全景";
  }

  if (orientation === "square") {
    return "方形";
  }

  return "灵活";
}

function formatAspectRatio(width, height) {
  if (!width || !height) {
    return "unspecified ratio";
  }

  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function greatestCommonDivisor(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
}
