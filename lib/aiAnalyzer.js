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
const CORE_TEMPLATE_FIELD_KEYS = new Set([
  "shot_size",
  "camera_angle",
  "viewpoint",
  "composition",
  "lighting",
  "color_system",
  "tone",
  "focal_length_feeling",
  "depth_of_field",
  "spatial_layers",
  "texture",
  "mood",
  "aesthetic_value",
  "prompt"
]);

let schemaPromise = null;

export async function analyzeImage(imageInput, template = null) {
  validateImageInput(imageInput);
  const schema = await loadAnalysisSchema();
  const settings = await loadAnalyzerSettings();

  if (!settings.useMockAnalysis && !settings.apiKey) {
    throw new Error("请先在设置页填写 API Key，或开启 Mock 分析模式。");
  }

  const result = settings.useMockAnalysis
    ? await mockAnalyzeImage(imageInput, schema, template)
    : await analyzeImageWithVision(imageInput, schema, settings, template);

  return normalizeAndValidateAnalysisResult(result, schema, settings, template);
}

export async function analyzeImageWithVision(imageInput, schema = null, settings = null, template = null) {
  validateImageInput(imageInput);
  assertRemoteModelReadableUrl(imageInput.imageUrl);

  const analysisSchema = schema || await loadAnalysisSchema();
  const activeSettings = settings || await loadAnalyzerSettings();

  if (activeSettings.provider === "openai") {
    return callOpenAiVisionAnalysis(imageInput, analysisSchema, activeSettings, template);
  }

  if (activeSettings.provider === "google") {
    return callGoogleVisionAnalysis(imageInput, analysisSchema, activeSettings, template);
  }

  if (activeSettings.provider === "custom") {
    return callCustomVisionAnalysis(imageInput, analysisSchema, activeSettings, template);
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

async function callOpenAiVisionAnalysis(imageInput, schema, settings, template = null) {
  const apiKey = normalizeApiKeyForHeader(settings.apiKey);
  if (!apiKey) {
    throw new Error("请先在设置页填写 API Key，或开启 Mock 分析模式。");
  }
  const responseSchema = buildAnalysisResponseSchema(schema, template);

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
              text: buildVisionPrompt(responseSchema, settings, template)
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
          schema: responseSchema,
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

async function callCustomVisionAnalysis(imageInput, schema, settings, template = null) {
  const apiKey = normalizeApiKeyForHeader(settings.apiKey);
  if (!apiKey) {
    throw new Error("请先在设置页填写 API Key，或开启 Mock 分析模式。");
  }

  throw new Error("Custom provider endpoint 尚未在设置页开放配置。");
  const responseSchema = buildAnalysisResponseSchema(schema, template);

  const response = await fetch(settings.customEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image: {
        imageUrl: imageInput.imageUrl
      },
      instruction: buildVisionPrompt(responseSchema, settings, template),
      schema: responseSchema
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

async function callGoogleVisionAnalysis(imageInput, schema, settings, template = null) {
  const apiKey = normalizeApiKeyForHeader(settings.apiKey);
  if (!apiKey) {
    throw new Error("请先在设置页填写 API Key，或开启 Mock 分析模式。");
  }

  const imagePart = await buildInlineImagePart(imageInput.imageUrl);
  const responseSchema = buildAnalysisResponseSchema(schema, template);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model || DEFAULT_GOOGLE_MODEL)}:generateContent`;
  const requestBase = {
    contents: [
      {
        role: "user",
        parts: [
          imagePart,
          {
            text: buildVisionPrompt(responseSchema, settings, template)
          }
        ]
      }
    ]
  };
  const strictRetryRequestBase = {
    contents: [
      {
        role: "user",
        parts: [
          imagePart,
          {
            text: [
              buildVisionPrompt(responseSchema, settings, template),
              "",
              "Critical retry instruction:",
              "Your previous response may have been invalid JSON.",
              "Return exactly one complete JSON object.",
              "Do not use markdown.",
              "Do not include comments.",
              "Do not include unescaped line breaks inside strings.",
              "Do not include trailing commas.",
              "Use double quotes for every JSON key and string value."
            ].join("\n")
          }
        ]
      }
    ]
  };
  const fetchGemini = (body) => fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  let response = await fetchGemini({
    ...requestBase,
    generationConfig: {
      responseFormat: {
        text: {
          mimeType: "application/json",
          schema: buildGeminiResponseSchema(responseSchema)
        }
      }
    }
  });

  let payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiErrorMessage(payload);
    if (isGeminiSchemaArgumentError(message, response.status)) {
      response = await fetchGemini({
        ...requestBase,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
      payload = await response.json().catch(() => null);
      if (response.ok) {
        return parseGeminiJsonOrRetry(payload, strictRetryRequestBase, fetchGemini);
      }
    }

    if (isRemoteImageReadError(message, response.status)) {
      throw new Error(REMOTE_IMAGE_UNREADABLE_MESSAGE);
    }

    throw new Error(extractApiErrorMessage(payload) || message || `Gemini API request failed: ${response.status}`);
  }

  return parseGeminiJsonOrRetry(payload, strictRetryRequestBase, fetchGemini);
}

async function parseGeminiJsonOrRetry(payload, retryRequestBase, fetchGemini) {
  const text = extractGeminiResponseText(payload);
  try {
    return parseModelJsonOutput(text);
  } catch (error) {
    const retryResponse = await fetchGemini({
      ...retryRequestBase,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
    const retryPayload = await retryResponse.json().catch(() => null);
    if (!retryResponse.ok) {
      throw error;
    }

    return parseModelJsonOutput(extractGeminiResponseText(retryPayload));
  }
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

function buildAnalysisResponseSchema(baseSchema, template = null) {
  const schema = cloneJson(baseSchema);
  const fields = getCustomTemplateFields(template);

  schema.properties = {
    ...(schema.properties || {}),
    template: {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "type"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        type: { type: "string" }
      }
    },
    template_analysis: buildTemplateAnalysisSchema(fields)
  };

  schema.required = [...new Set([...(schema.required || []), "template", "template_analysis"])];
  schema.additionalProperties = false;
  return schema;
}

function buildTemplateAnalysisSchema(fields) {
  const properties = {};
  fields.forEach((field) => {
    properties[field.key] = {
      type: "object",
      additionalProperties: false,
      required: ["label", "evidence", "function"],
      properties: {
        label: { type: "string" },
        evidence: { type: "string" },
        function: { type: "string" }
      }
    };
  });

  return {
    type: "object",
    additionalProperties: false,
    required: fields.map((field) => field.key),
    properties
  };
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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

function buildVisionPrompt(schema, settings, template = null) {
  const languageInstruction = settings.analysisLanguage === "zh-CN"
    ? "Write all free-text analysis, tags, prompt.zh, evidence, function, aesthetic_value fields, and reusable direction labels in Simplified Chinese. Do not mix English into tags or prompt.zh. Use English only where the schema enum requires an exact English value, or in prompt.en."
    : "Write all free-text analysis in English unless a schema field explicitly requests another language.";
  const enabledTemplateFields = getEnabledTemplateFields(template);
  const baseTemplateFields = getBaseTemplateFields(template);
  const customTemplateFields = getCustomTemplateFields(template);
  const templateInstruction = enabledTemplateFields.length > 0
    ? [
      "Analysis template:",
      JSON.stringify({
        id: template.id,
        name: template.name,
        type: template.type,
        base_schema_fields: baseTemplateFields.map((field) => ({
          key: field.key,
          label: field.label,
          promptInstruction: field.promptInstruction
        })),
        template_analysis_fields: customTemplateFields.map((field) => ({
          key: field.key,
          label: field.label,
          promptInstruction: field.promptInstruction,
          outputFields: field.outputFields || ["label", "evidence", "function"]
        }))
      }),
      "In addition to the base schema fields, include top-level template and template_analysis fields.",
      "template must be { id, name, type } for the selected analysis template.",
      "For base_schema_fields, apply each field's promptInstruction to the matching base schema section. Do not duplicate these fields inside template_analysis.",
      "template_analysis must be an object keyed only by template_analysis_fields.",
      "Every template_analysis item must contain label, evidence, and function.",
      "Do not invent disabled template fields."
    ].join("\n")
    : "No custom analysis template is selected. You may omit template_analysis or return an empty object.";

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
    templateInstruction,
    "Return JSON only. Do not output markdown, code fences, comments, explanations, or prose outside JSON.",
    "The JSON must strictly conform to this JSON Schema:",
    JSON.stringify(schema),
    "The optional top-level template and template_analysis fields are allowed only for the selected analysis template."
  ].join("\n");
}

function getEnabledTemplateFields(template) {
  if (!template || !Array.isArray(template.fields)) {
    return [];
  }

  return template.fields
    .filter((field) => field && field.enabled !== false && field.key)
    .map((field) => ({
      key: String(field.key).trim(),
      label: String(field.label || field.key).trim(),
      promptInstruction: String(field.promptInstruction || "").trim(),
      outputFields: Array.isArray(field.outputFields) && field.outputFields.length > 0
        ? field.outputFields
        : ["label", "evidence", "function"]
    }));
}

function getBaseTemplateFields(template) {
  return getEnabledTemplateFields(template).filter((field) => CORE_TEMPLATE_FIELD_KEYS.has(field.key));
}

function getCustomTemplateFields(template) {
  return getEnabledTemplateFields(template).filter((field) => !CORE_TEMPLATE_FIELD_KEYS.has(field.key));
}

function getTemplateSummary(template) {
  if (!template) {
    return { id: "", name: "", type: "" };
  }

  return {
    id: template.id || "",
    name: template.name || "",
    type: template.type || ""
  };
}

function parseModelJsonOutput(text) {
  const candidates = [
    text,
    normalizeJsonText(text),
    extractFirstJsonObject(normalizeJsonText(text))
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // Try the next cleaned candidate before surfacing the parse error.
    }
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`模型输出不是合法 JSON：${error.message}`);
  }
}

function normalizeJsonText(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
    .replace(/,\s*([}\]])/g, "$1");
}

function extractFirstJsonObject(text) {
  const value = String(text || "");
  const start = value.indexOf("{");
  if (start === -1) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1).replace(/,\s*([}\]])/g, "$1");
      }
    }
  }

  return value.slice(start).replace(/,\s*([}\]])/g, "$1");
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

function isGeminiSchemaArgumentError(message, status) {
  const normalized = String(message || "").toLowerCase();
  return status === 400
    && (
      normalized.includes("invalid argument")
      || normalized.includes("invalid value")
      || normalized.includes("unknown name")
      || normalized.includes("responsejsonschema")
      || normalized.includes("response_json_schema")
      || normalized.includes("responseformat")
      || normalized.includes("response_format")
      || normalized.includes("schema")
    );
}

async function mockAnalyzeImage(imageInput, schema, template = null) {
  const width = Number(imageInput.width) || 0;
  const height = Number(imageInput.height) || 0;
  const aspectRatio = formatAspectRatio(width, height);
  const orientation = getSchemaOrientation(width, height);
  const orientationTag = orientation === "unknown" ? "灵活画幅" : orientationLabel(orientation);
  const compositionLabel = orientation === "portrait" ? "vertical framing" : "horizontal framing";

  const templateFields = getCustomTemplateFields(template);
  const templateAnalysis = buildMockTemplateAnalysis(templateFields, orientation, aspectRatio);

  return {
    schema_version: getSchemaVersion(schema),
    template: getTemplateSummary(template),
    template_analysis: templateAnalysis,
    image_basic: {
      aspect_ratio: aspectRatio,
      orientation,
      dominant_colors: ["深青黑", "柔和中性色", "低饱和点缀色"],
      brightness: "mid-key",
      contrast: "medium contrast",
      saturation: "medium saturation",
      visual_density: "medium density"
    },
    cinematic_analysis: {
      shot_size: {
        label: orientation === "portrait" ? "medium close-up" : "long shot",
        evidence: "画面保留主体周围空间，同时让主要形体保持清晰可读。",
        function: "在主体识别和环境信息之间取得平衡。"
      },
      camera_angle: {
        label: "eye-level",
        evidence: "画面没有明显俯拍、仰拍或强烈倾斜视角线索。",
        function: "建立稳定、易进入的观看关系。"
      },
      viewpoint: {
        label: "observational view",
        evidence: "画面更像外部观察，而不是明确第一人称或监控式视角。",
        function: "让注意力集中在画面结构和风格，而不是角色主观性。"
      },
      composition: {
        labels: [compositionLabel, "open composition"],
        subject_position: orientation === "portrait" ? "主要注意力沿纵向轴线组织。" : "主要注意力在横向画面中展开。",
        visual_focus: "最清晰的视觉区域先稳定观看，再引导观众进入次级细节。",
        eye_flow: orientation === "portrait" ? "视线沿纵向信息层级移动。" : "视线横向穿过画面。",
        function: "提供可复用的构图参考和提示词结构。"
      },
      lighting: {
        key_light_direction: "ambient light",
        light_quality: "soft light",
        lighting_ratio: "medium ratio",
        shadow_behavior: "阴影辅助形体可读性，但不主导画面。",
        lighting_style: ["natural window light"],
        function: "在保持清晰度的同时保留氛围。"
      },
      color_system: {
        temperature: "neutral",
        palette: ["深青黑", "柔和中性色", "低饱和点缀色"],
        color_relationship: "neutral with accent color",
        function: "克制配色让画面更适合作为灵活的设计参考。"
      },
      tone: {
        label: "middle-key",
        evidence: "画面介于明亮高调和沉重低调之间。",
        function: "在保留情绪的同时保持细节可读。"
      },
      focal_length_feeling: {
        label: orientation === "landscape" ? "standard lens feeling" : "medium focal length feeling",
        evidence: "画面空间关系没有极端广角畸变，也没有强烈长焦压缩。",
        function: "让空间关系自然、便于复用。"
      },
      depth_of_field: {
        label: "medium depth of field",
        evidence: "主体和环境仍保持视觉关联，没有被完全分离。",
        function: "同时保留主体清晰度和环境线索。"
      },
      spatial_layers: {
        foreground: "前景作为第一阅读层。",
        midground: "中景承载主要可读主体或结构。",
        background: "背景提供环境氛围和对比。",
        depth_strategy: "通过前景、中景、背景的分层建立纵深。",
        function: "便于转译成可复用的空间提示词。"
      },
      texture: {
        materials: ["数字影像质感", "环境细节", "柔和明暗渐变"],
        surface_response: "表面以可控对比和清晰调性过渡呈现。",
        function: "为后续提示词提供具体材质抓手。"
      },
      mood: {
        labels: ["restrained", "realistic"],
        visual_causes: "均衡构图、中性配色和中间调共同形成冷静的参考图气质。"
      }
    },
    aesthetic_value: {
      core_value: "适合作为构图、画幅和提示词开发的可复用视觉参考。",
      why_it_works: "画面结构提供了清晰的取景、情绪和空间线索。",
      visual_focus: "画幅比例、构图策略和视觉层级。",
      reusable_elements: [
        "画幅比例",
        "观看视角",
        "构图策略",
        "光影方式",
        "提示词语言"
      ],
      can_be_used_for: [
        "情绪板",
        "AI 提示词",
        "构图参考",
        "设计方向"
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
      "电影感参考",
      "构图参考",
      "设计提示词"
    ]
  };
}

function buildMockTemplateAnalysis(fields, orientation, aspectRatio) {
  return fields.reduce((result, field) => {
    result[field.key] = {
      label: `${field.label}：可复用的视觉判断`,
      evidence: `根据画面可见内容，结合 ${orientationLabel(orientation)}、${aspectRatio} 和主体层次进行判断。`,
      function: field.promptInstruction || "帮助把这张图转化为可复用的审美素材和生成提示词。"
    };
    return result;
  }, {});
}

function normalizeAndValidateAnalysisResult(result, schema, settings = DEFAULT_SETTINGS, template = null) {
  if (!result || typeof result !== "object") {
    throw new Error("模型输出 JSON 不是对象。");
  }

  const rawTags = Array.isArray(result.tags) ? result.tags.filter((tag) => tag && !/^unknown$/i.test(tag)) : [];
  const normalized = {
    ...result,
    schema_version: result.schema_version || getSchemaVersion(schema),
    template: result.template || getTemplateSummary(template),
    template_analysis: normalizeTemplateAnalysis(result.template_analysis),
    tags: settings.analysisLanguage === "zh-CN" ? localizeTags(rawTags) : rawTags
  };

  if (normalized.tags.length < 3) {
    const fallbackTags = settings.analysisLanguage === "zh-CN"
      ? ["电影感参考", "构图参考", "设计提示词"]
      : ["cinematic-reference", "composition-study", "design-prompt"];
    normalized.tags = [...new Set([...normalized.tags, ...fallbackTags])];
  }

  const schemaComparable = { ...normalized };
  delete schemaComparable.template;
  delete schemaComparable.template_analysis;
  validateAgainstSchema(schema, schemaComparable);
  return normalized;
}

function normalizeTemplateAnalysis(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !CORE_TEMPLATE_FIELD_KEYS.has(key))
  );
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
