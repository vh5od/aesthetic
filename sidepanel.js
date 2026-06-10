import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  analyzeImage,
  normalizeSettings
} from "./lib/aiAnalyzer.js";

const MESSAGE_TYPES = {
  GET_ACTIVE_IMAGE: "AESTHETIC_LENS_GET_ACTIVE_IMAGE"
};

const STORAGE_KEYS = {
  ACTIVE_IMAGE: "aestheticLensActiveImage",
  FAVORITES: "aestheticLensFavorites",
  TEMPLATES: "aestheticLensAnalysisTemplates",
  COLLECTIONS: "aestheticLensCollections",
  TAG_REGISTRY: "aestheticLensTagRegistry",
  DEFAULT_TEMPLATE: "aestheticLensDefaultTemplate"
};

const DEFAULT_TEMPLATE_ID = "cinematic_general";
const DEFAULT_COLLECTION_ID = "quick_saves";
const UNCATEGORIZED_COLLECTION_ID = "uncategorized";
const ALL_COLLECTIONS_ID = "all";
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

const ANALYSIS_SECTIONS = [
  { title: "基础信息", path: "image_basic", getItem: (analysis) => buildBasicInfoItem(analysis.image_basic) },
  { title: "景别", path: "cinematic_analysis.shot_size", getItem: (analysis) => analysis.cinematic_analysis.shot_size },
  { title: "镜头角度", path: "cinematic_analysis.camera_angle", getItem: (analysis) => analysis.cinematic_analysis.camera_angle },
  { title: "观看视角", path: "cinematic_analysis.viewpoint", getItem: (analysis) => analysis.cinematic_analysis.viewpoint },
  { title: "构图", path: "cinematic_analysis.composition", getItem: (analysis) => buildCompositionItem(analysis.cinematic_analysis.composition) },
  { title: "光影", path: "cinematic_analysis.lighting", getItem: (analysis) => buildLightingItem(analysis.cinematic_analysis.lighting) },
  { title: "色彩系统", path: "cinematic_analysis.color_system", getItem: (analysis) => buildColorSystemItem(analysis.cinematic_analysis.color_system) },
  { title: "影调", path: "cinematic_analysis.tone", getItem: (analysis) => analysis.cinematic_analysis.tone },
  { title: "焦段感", path: "cinematic_analysis.focal_length_feeling", getItem: (analysis) => analysis.cinematic_analysis.focal_length_feeling },
  { title: "景深", path: "cinematic_analysis.depth_of_field", getItem: (analysis) => analysis.cinematic_analysis.depth_of_field },
  { title: "空间层次", path: "cinematic_analysis.spatial_layers", getItem: (analysis) => buildSpatialLayersItem(analysis.cinematic_analysis.spatial_layers) },
  { title: "材质响应", path: "cinematic_analysis.texture", getItem: (analysis) => buildTextureItem(analysis.cinematic_analysis.texture) },
  { title: "情绪功能", path: "cinematic_analysis.mood", getItem: (analysis) => buildMoodItem(analysis.cinematic_analysis.mood) },
  { title: "审美价值", path: "aesthetic_value", getItem: (analysis) => buildAestheticValueItem(analysis.aesthetic_value) },
  { title: "Prompt", path: "prompt", getItem: (analysis) => buildPromptItem(analysis.prompt) },
  { title: "标签", path: "tags", getItem: (analysis) => buildTagsItem(analysis.tags) }
];

const TAG_LABELS_ZH = {
  "ai prompt writing": "AI 提示词",
  "cinematic": "电影感",
  "cinematic-reference": "电影感参考",
  "clubbing": "夜店氛围",
  "composition reference": "构图参考",
  "composition-study": "构图参考",
  "design direction notes": "设计方向",
  "design-prompt": "设计提示词",
  "flexible-framing": "灵活画幅",
  "landscape": "横向画幅",
  "moodboard collection": "情绪板",
  "portrait": "纵向画幅",
  "reference": "参考图",
  "square": "方形画幅",
  "unknown": "待判断"
};

const NEGATIVE_PROMPT_ZH = {
  "avoid unreadable clutter": "避免杂乱不可读",
  "broken anatomy": "避免肢体结构错误",
  "overprocessed HDR": "避免过度 HDR",
  "excessive blur": "避免过度模糊",
  "noisy compression artifacts": "避免压缩噪点",
  "random text": "避免随机文字",
  "watermark": "避免水印"
};

const TEMPLATE_FIELD_DEFS = {
  shot_size: ["景别", "分析画面景别、主体距离和画面信息量。"],
  camera_angle: ["镜头角度", "分析镜头高度、俯仰关系和角度带来的心理感受。"],
  viewpoint: ["观看视角", "分析观看者与主体之间的视角关系和叙事距离。"],
  composition: ["构图", "分析主体位置、视觉重心、视线流动和构图作用。"],
  lighting: ["光影", "分析主光方向、光质、明暗比例、阴影行为和光影风格。"],
  color_system: ["色彩系统", "分析色温、配色、色彩关系和色彩对画面功能的影响。"],
  tone: ["影调", "分析高调、低调、中间调或混合影调以及情绪作用。"],
  focal_length_feeling: ["焦段感", "分析画面呈现出的广角、标准、长焦或压缩关系。"],
  depth_of_field: ["景深", "分析焦点层次、虚实关系和主体分离方式。"],
  spatial_layers: ["空间层次", "分析前景、中景、背景和纵深组织方式。"],
  texture: ["材质响应", "分析材质、表面反光、颗粒、皮肤、织物或环境质感。"],
  mood: ["情绪功能", "分析画面情绪来自哪些具体视觉因素，以及可复用价值。"],
  aesthetic_value: ["审美价值", "总结画面的核心价值、可复用元素、适用场景和参考强度。"],
  prompt: ["Prompt", "生成适合文生图、图生图或视频生成使用的中英文 prompt。"],
  makeup_hair: ["妆发分析", "分析妆容、发色、发型、修饰重点和视觉识别度。"],
  styling: ["造型分析", "分析服装、廓形、配饰、风格体系和可复用价值。"],
  pose_expression: ["姿态与表情", "分析人物姿态、表情、肢体张力和情绪表达。"],
  character_presence: ["人物气质", "分析人物存在感、气质来源和镜头吸引力。"],
  ai_reproduction: ["AI 复刻要点", "提炼生成时必须保留的风格、构图、光影和细节。"],
  product_subject: ["商品主体", "分析商品类型、主体可读性和视觉占比。"],
  product_placement: ["商品摆位", "分析商品位置、朝向、层级和视觉动线。"],
  brand_tone: ["品牌调性", "分析画面传达的品牌感、价格感和受众气质。"],
  selling_point: ["卖点突出方式", "分析商品卖点如何通过画面被强调。"],
  background_interaction: ["背景与商品交互", "分析背景如何衬托或干扰商品主体。"],
  ecommerce_usability: ["电商可用性", "分析画面是否适合商品详情、主图或广告投放。"],
  reproducible_parameters: ["可复刻参数", "提炼可用于生成模型的画幅、镜头、光影、色彩和材质参数。"],
  difficulty_points: ["难点", "分析 AI 生成中最容易失败或需要重点控制的部分。"],
  style_keywords: ["风格关键词", "提炼稳定、可复用的风格关键词。"],
  generation_risks: ["生成风险", "分析可能出现的错误、违和点和需要规避的内容。"],
  negative_prompt_guidance: ["Negative Prompt", "给出需要写入 negative prompt 的风险项。"],
  motion_potential: ["运动潜力", "分析画面可转化为视频时的运动方向和镜头潜力。"],
  transition_idea: ["转场可能", "分析适合衔接前后镜头的转场方式。"],
  video_value: ["视频化价值", "分析画面适合短片、广告或分镜延展的价值。"],
  video_prompt: ["Seedance / 可灵 Prompt", "生成适合视频模型使用的镜头运动和画面描述。"]
};

const BUILT_IN_TEMPLATE_BLUEPRINTS = [
  {
    id: "cinematic_general",
    name: "通用电影语言分析",
    description: "适合分析大多数影像、摄影和设计参考图。",
    fields: ["shot_size", "camera_angle", "viewpoint", "composition", "lighting", "color_system", "tone", "focal_length_feeling", "depth_of_field", "spatial_layers", "texture", "mood", "aesthetic_value", "prompt"]
  },
  {
    id: "portrait_analysis",
    name: "人像写真分析",
    description: "适合分析人物写真、模特图和社媒人像。",
    fields: ["shot_size", "viewpoint", "composition", "lighting", "color_system", "makeup_hair", "styling", "pose_expression", "character_presence", "ai_reproduction", "prompt"]
  },
  {
    id: "product_ad_analysis",
    name: "商品广告分析",
    description: "适合分析商品图、广告 KV 和电商视觉。",
    fields: ["product_subject", "product_placement", "composition", "lighting", "color_system", "texture", "brand_tone", "selling_point", "background_interaction", "ecommerce_usability", "prompt"]
  },
  {
    id: "ai_reproduction_analysis",
    name: "AI 复刻分析",
    description: "适合提炼图像生成参数、风格关键词和复刻难点。",
    fields: ["reproducible_parameters", "difficulty_points", "style_keywords", "composition", "lighting", "color_system", "texture", "generation_risks", "negative_prompt_guidance", "prompt"]
  },
  {
    id: "video_storyboard_analysis",
    name: "视频分镜分析",
    description: "适合把静态图延展为视频分镜、镜头运动和视频 prompt。",
    fields: ["shot_size", "viewpoint", "composition", "lighting", "mood", "motion_potential", "transition_idea", "video_value", "video_prompt"]
  }
];

const DEFAULT_COLLECTIONS = [
  {
    id: DEFAULT_COLLECTION_ID,
    name: "Quick Saves",
    description: "默认快速收藏",
    isDefault: true
  },
  {
    id: UNCATEGORIZED_COLLECTION_ID,
    name: "未分类",
    description: "未整理素材",
    isDefault: false
  }
];

const DEFAULT_TAG_REGISTRY = [
  ["Y2K", "style", ["y2k aesthetic", "y2k fashion"]],
  ["CCD直闪", "style", ["direct flash photography", "direct flash", "ccd flash"]],
  ["高奢冷感", "style", ["luxury cold", "cold luxury"]],
  ["赛博朋克", "style", ["cyberpunk"]],
  ["王家卫式", "style", ["wong kar wai"]],
  ["电影黑色", "style", ["film noir"]],
  ["日系生活流", "style", ["japanese lifestyle"]],
  ["红毯狗仔感", "style", ["paparazzi style", "red carpet paparazzi"]],
  ["中心构图", "composition", ["center composition"]],
  ["三分法", "composition", ["rule of thirds"]],
  ["黄金比例", "composition", ["golden ratio"]],
  ["框中框", "composition", ["frame within frame"]],
  ["负空间", "composition", ["negative space"]],
  ["引导线", "composition", ["leading lines"]],
  ["对称构图", "composition", ["symmetrical composition"]],
  ["平视", "viewpoint", ["eye-level"]],
  ["低角度", "viewpoint", ["low angle"]],
  ["高角度", "viewpoint", ["high angle"]],
  ["鸟瞰", "viewpoint", ["bird eye view", "overhead"]],
  ["上帝视角", "viewpoint", ["god view"]],
  ["越肩", "viewpoint", ["over shoulder"]],
  ["狗仔视角", "viewpoint", ["paparazzi view"]],
  ["直闪", "lighting", ["direct flash photography", "direct flash", "flash light"]],
  ["低调光", "lighting", ["low-key lighting"]],
  ["高调光", "lighting", ["high-key lighting"]],
  ["逆光", "lighting", ["backlight"]],
  ["霓虹光", "lighting", ["neon light"]],
  ["自然窗光", "lighting", ["natural window light"]],
  ["AI模特图", "usage", ["ai model"]],
  ["商品广告", "usage", ["product ad"]],
  ["视频分镜", "usage", ["video storyboard"]],
  ["品牌KV", "usage", ["brand kv"]],
  ["社媒封面", "usage", ["social cover"]]
];

const state = {
  activeImage: null,
  activeAnalysis: null,
  currentUserEdits: {},
  currentCustomDimensions: [],
  favorites: [],
  templates: [],
  collections: [],
  tagRegistry: [],
  selectedTemplateId: DEFAULT_TEMPLATE_ID,
  selectedCollectionId: ALL_COLLECTIONS_ID,
  organizeMode: false,
  selectedLibraryIds: new Set(),
  selectedFavoriteId: null,
  activeTab: "analysis",
  searchQuery: "",
  analysisFilter: "all",
  settings: { ...DEFAULT_SETTINGS },
  hasSavedApiKey: false
};

const elements = {
  analysisTab: document.getElementById("analysisTab"),
  libraryTab: document.getElementById("libraryTab"),
  settingsTab: document.getElementById("settingsTab"),
  analysisView: document.getElementById("analysisView"),
  libraryView: document.getElementById("libraryView"),
  settingsView: document.getElementById("settingsView"),
  emptyState: document.getElementById("emptyState"),
  imagePanel: document.getElementById("imagePanel"),
  previewImage: document.getElementById("previewImage"),
  imageSize: document.getElementById("imageSize"),
  aspectRatio: document.getElementById("aspectRatio"),
  pageTitle: document.getElementById("pageTitle"),
  pageUrl: document.getElementById("pageUrl"),
  imageUrl: document.getElementById("imageUrl"),
  analysisTemplateSelect: document.getElementById("analysisTemplateSelect"),
  analyzeButton: document.getElementById("analyzeButton"),
  analysisStatus: document.getElementById("analysisStatus"),
  analysisResult: document.getElementById("analysisResult"),
  copyAnalysisJsonButton: document.getElementById("copyAnalysisJsonButton"),
  noteInput: document.getElementById("noteInput"),
  saveFavoriteButton: document.getElementById("saveFavoriteButton"),
  saveStatus: document.getElementById("saveStatus"),
  favoriteCount: document.getElementById("favoriteCount"),
  collectionFilterSelect: document.getElementById("collectionFilterSelect"),
  createCollectionButton: document.getElementById("createCollectionButton"),
  renameCollectionButton: document.getElementById("renameCollectionButton"),
  deleteCollectionButton: document.getElementById("deleteCollectionButton"),
  librarySearchInput: document.getElementById("librarySearchInput"),
  filterButtons: Array.from(document.querySelectorAll(".filter-button")),
  toggleOrganizeModeButton: document.getElementById("toggleOrganizeModeButton"),
  libraryEmptyState: document.getElementById("libraryEmptyState"),
  libraryContent: document.getElementById("libraryContent"),
  libraryNoResults: document.getElementById("libraryNoResults"),
  favoriteList: document.getElementById("favoriteList"),
  batchActionBar: document.getElementById("batchActionBar"),
  batchSelectedCount: document.getElementById("batchSelectedCount"),
  batchCollectionSelect: document.getElementById("batchCollectionSelect"),
  batchMoveButton: document.getElementById("batchMoveButton"),
  batchTagButton: document.getElementById("batchTagButton"),
  batchDeleteButton: document.getElementById("batchDeleteButton"),
  batchCancelButton: document.getElementById("batchCancelButton"),
  favoriteDetail: document.getElementById("favoriteDetail"),
  detailImage: document.getElementById("detailImage"),
  detailTitle: document.getElementById("detailTitle"),
  deleteFavoriteButton: document.getElementById("deleteFavoriteButton"),
  detailRatio: document.getElementById("detailRatio"),
  detailTime: document.getElementById("detailTime"),
  detailImageUrl: document.getElementById("detailImageUrl"),
  detailPageUrl: document.getElementById("detailPageUrl"),
  detailTags: document.getElementById("detailTags"),
  detailCollections: document.getElementById("detailCollections"),
  saveItemCollectionsButton: document.getElementById("saveItemCollectionsButton"),
  detailPrompt: document.getElementById("detailPrompt"),
  detailNote: document.getElementById("detailNote"),
  detailFullAnalysis: document.getElementById("detailFullAnalysis"),
  copyPromptButton: document.getElementById("copyPromptButton"),
  copyMarkdownButton: document.getElementById("copyMarkdownButton"),
  copyDetailJsonButton: document.getElementById("copyDetailJsonButton"),
  libraryStatus: document.getElementById("libraryStatus"),
  mockModeInput: document.getElementById("mockModeInput"),
  realModeInput: document.getElementById("realModeInput"),
  providerSelect: document.getElementById("providerSelect"),
  modelInput: document.getElementById("modelInput"),
  analysisLanguageSelect: document.getElementById("analysisLanguageSelect"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  toggleApiKeyButton: document.getElementById("toggleApiKeyButton"),
  apiKeySavedText: document.getElementById("apiKeySavedText"),
  autoSaveAnalysisInput: document.getElementById("autoSaveAnalysisInput"),
  showDebugInfoInput: document.getElementById("showDebugInfoInput"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  clearApiKeyButton: document.getElementById("clearApiKeyButton"),
  testConnectionButton: document.getElementById("testConnectionButton"),
  settingsLibraryCount: document.getElementById("settingsLibraryCount"),
  exportScopeSelect: document.getElementById("exportScopeSelect"),
  exportCollectionSelect: document.getElementById("exportCollectionSelect"),
  exportFullBackupButton: document.getElementById("exportFullBackupButton"),
  exportGenerationJsonButton: document.getElementById("exportGenerationJsonButton"),
  exportMarkdownButton: document.getElementById("exportMarkdownButton"),
  mergeImportInput: document.getElementById("mergeImportInput"),
  replaceImportInput: document.getElementById("replaceImportInput"),
  importCollectionStrategySelect: document.getElementById("importCollectionStrategySelect"),
  libraryImportFileInput: document.getElementById("libraryImportFileInput"),
  importBackupButton: document.getElementById("importBackupButton"),
  templateManager: document.getElementById("templateManager"),
  createTemplateButton: document.getElementById("createTemplateButton"),
  exportTemplatesButton: document.getElementById("exportTemplatesButton"),
  importTemplatesButton: document.getElementById("importTemplatesButton"),
  templateImportFileInput: document.getElementById("templateImportFileInput"),
  settingsStatus: document.getElementById("settingsStatus")
};

init();

function init() {
  elements.analysisTab.addEventListener("click", () => switchTab("analysis"));
  elements.libraryTab.addEventListener("click", () => switchTab("library"));
  elements.settingsTab.addEventListener("click", () => switchTab("settings"));
  elements.librarySearchInput.addEventListener("input", handleLibrarySearch);
  elements.analysisTemplateSelect.addEventListener("change", handleTemplateSelection);
  elements.collectionFilterSelect.addEventListener("change", handleCollectionFilterChange);
  elements.createCollectionButton.addEventListener("click", createCollectionFromPrompt);
  elements.renameCollectionButton.addEventListener("click", renameSelectedCollection);
  elements.deleteCollectionButton.addEventListener("click", deleteSelectedCollection);
  elements.filterButtons.forEach((button) => {
    button.addEventListener("click", () => setAnalysisFilter(button.dataset.filter));
  });
  elements.toggleOrganizeModeButton.addEventListener("click", toggleOrganizeMode);
  elements.batchMoveButton.addEventListener("click", batchMoveToCollection);
  elements.batchTagButton.addEventListener("click", batchAddTag);
  elements.batchDeleteButton.addEventListener("click", batchDeleteSelected);
  elements.batchCancelButton.addEventListener("click", exitOrganizeMode);
  elements.analyzeButton.addEventListener("click", analyzeActiveImage);
  elements.copyAnalysisJsonButton.addEventListener("click", () => copyFullJson("analysis"));
  elements.saveFavoriteButton.addEventListener("click", saveFavorite);
  elements.deleteFavoriteButton.addEventListener("click", deleteSelectedFavorite);
  elements.saveItemCollectionsButton.addEventListener("click", saveSelectedItemCollections);
  elements.copyPromptButton.addEventListener("click", () => copySelectedField("prompt"));
  elements.copyMarkdownButton.addEventListener("click", () => copySelectedField("markdown"));
  elements.copyDetailJsonButton.addEventListener("click", () => copyFullJson("library"));
  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.clearApiKeyButton.addEventListener("click", clearApiKey);
  elements.testConnectionButton.addEventListener("click", testConnection);
  elements.exportScopeSelect.addEventListener("change", renderExportCollectionSelector);
  elements.exportFullBackupButton.addEventListener("click", exportFullBackup);
  elements.exportGenerationJsonButton.addEventListener("click", exportGenerationReadyLibrary);
  elements.exportMarkdownButton.addEventListener("click", exportLibraryMarkdown);
  elements.importBackupButton.addEventListener("click", () => elements.libraryImportFileInput.click());
  elements.libraryImportFileInput.addEventListener("change", handleLibraryImportFile);
  elements.createTemplateButton.addEventListener("click", createCustomTemplate);
  elements.exportTemplatesButton.addEventListener("click", exportCustomTemplates);
  elements.importTemplatesButton.addEventListener("click", () => elements.templateImportFileInput.click());
  elements.templateImportFileInput.addEventListener("change", handleTemplateImportFile);
  elements.toggleApiKeyButton.addEventListener("click", toggleApiKeyVisibility);
  elements.providerSelect.addEventListener("change", handleProviderChange);
  chrome.storage.onChanged.addListener(handleStorageChange);
  loadSettings();
  initializeOrganizers();
  loadFavorites();
  loadActiveImage();
}

function switchTab(tabName) {
  state.activeTab = tabName;
  elements.analysisTab.classList.toggle("is-active", tabName === "analysis");
  elements.libraryTab.classList.toggle("is-active", tabName === "library");
  elements.settingsTab.classList.toggle("is-active", tabName === "settings");
  elements.analysisView.classList.toggle("is-hidden", tabName !== "analysis");
  elements.libraryView.classList.toggle("is-hidden", tabName !== "library");
  elements.settingsView.classList.toggle("is-hidden", tabName !== "settings");
  elements.libraryStatus.textContent = "";

  if (tabName === "library") {
    renderLibrary();
  }

  updateEmptyStates();
}

async function loadSettings() {
  const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  state.settings = normalizeSettings(result[SETTINGS_STORAGE_KEY]);
  state.hasSavedApiKey = Boolean(state.settings.apiKey);
  renderSettings();
}

async function initializeOrganizers() {
  state.templates = await ensureDefaultAnalysisTemplates();
  state.collections = await ensureDefaultCollections();
  state.tagRegistry = await ensureDefaultTagRegistry();
  const defaultTemplateId = await getDefaultTemplateId();
  state.selectedTemplateId = defaultTemplateId;
  renderTemplateSelector();
  renderTemplateManager();
  renderCollectionFilter();
}

function buildTemplateField(key, index = 0) {
  const [label, promptInstruction] = TEMPLATE_FIELD_DEFS[key] || [key, `分析 ${key} 这个自定义维度。`];
  return {
    id: `field_${key}_${index}`,
    key,
    label,
    type: "analysis_card",
    enabled: true,
    isRequired: false,
    promptInstruction,
    outputFields: ["label", "evidence", "function"]
  };
}

function buildPresetTemplates() {
  const now = new Date().toISOString();
  return BUILT_IN_TEMPLATE_BLUEPRINTS.map((template, templateIndex) => ({
    id: template.id,
    type: "preset",
    name: template.name,
    description: template.description,
    isBuiltIn: true,
    isDefault: template.id === DEFAULT_TEMPLATE_ID,
    baseTemplateId: null,
    fields: template.fields.map((fieldKey, fieldIndex) => buildTemplateField(fieldKey, fieldIndex + templateIndex * 100)),
    createdAt: now,
    updatedAt: now
  }));
}

async function ensureDefaultAnalysisTemplates() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TEMPLATES);
  const existing = Array.isArray(result[STORAGE_KEYS.TEMPLATES]) ? result[STORAGE_KEYS.TEMPLATES] : [];
  const presets = buildPresetTemplates();
  const merged = [...existing];

  presets.forEach((preset) => {
    const index = merged.findIndex((template) => template.id === preset.id);
    if (index === -1) {
      merged.push(preset);
    } else if (merged[index].type === "preset" || merged[index].isBuiltIn) {
      merged[index] = { ...preset, isDefault: Boolean(merged[index].isDefault) || preset.id === DEFAULT_TEMPLATE_ID };
    }
  });

  const normalized = normalizeTemplates(merged);
  await saveAnalysisTemplates(normalized);
  return normalized;
}

function normalizeTemplates(templates) {
  const now = new Date().toISOString();
  return (Array.isArray(templates) ? templates : []).map((template) => ({
    id: template.id || `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: template.type === "custom" ? "custom" : "preset",
    name: template.name || "未命名模板",
    description: template.description || "",
    isBuiltIn: template.type === "preset" || Boolean(template.isBuiltIn),
    isDefault: Boolean(template.isDefault),
    baseTemplateId: template.baseTemplateId || null,
    fields: Array.isArray(template.fields) ? template.fields.map(normalizeTemplateField) : [],
    createdAt: template.createdAt || now,
    updatedAt: template.updatedAt || now
  }));
}

function normalizeTemplateField(field, index = 0) {
  return {
    id: field.id || `field_${field.key || index}_${Date.now()}`,
    key: sanitizeTemplateKey(field.key || `custom_field_${index}`),
    label: field.label || field.key || "未命名维度",
    type: "analysis_card",
    enabled: field.enabled !== false,
    isRequired: Boolean(field.isRequired),
    promptInstruction: field.promptInstruction || "分析这个维度的判断、画面依据和视觉作用。",
    outputFields: Array.isArray(field.outputFields) && field.outputFields.length > 0 ? field.outputFields : ["label", "evidence", "function"]
  };
}

function sanitizeTemplateKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || `field_${Date.now()}`;
}

async function saveAnalysisTemplates(templates) {
  state.templates = normalizeTemplates(templates);
  await chrome.storage.local.set({ [STORAGE_KEYS.TEMPLATES]: state.templates });
}

async function getDefaultTemplateId() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DEFAULT_TEMPLATE);
  const storedId = result[STORAGE_KEYS.DEFAULT_TEMPLATE];
  const found = state.templates.find((template) => template.id === storedId) || state.templates.find((template) => template.isDefault);
  return found ? found.id : DEFAULT_TEMPLATE_ID;
}

async function setDefaultTemplate(templateId) {
  state.templates = state.templates.map((template) => ({
    ...template,
    isDefault: template.id === templateId
  }));
  state.selectedTemplateId = templateId;
  await chrome.storage.local.set({
    [STORAGE_KEYS.DEFAULT_TEMPLATE]: templateId,
    [STORAGE_KEYS.TEMPLATES]: state.templates
  });
  renderTemplateSelector();
  renderTemplateManager();
  elements.settingsStatus.textContent = "默认模板已更新";
}

function getSelectedTemplate() {
  return state.templates.find((template) => template.id === state.selectedTemplateId)
    || state.templates.find((template) => template.id === DEFAULT_TEMPLATE_ID)
    || state.templates[0]
    || null;
}

function getTemplateSummary(template) {
  if (!template) {
    return { id: "", name: "", type: "" };
  }

  return {
    id: template.id,
    name: template.name,
    type: template.type
  };
}

function normalizeTemplateSummary(template) {
  return {
    id: template && template.id || "",
    name: template && template.name || "",
    type: template && template.type || ""
  };
}

function renderTemplateSelector() {
  elements.analysisTemplateSelect.replaceChildren();
  const presets = state.templates.filter((template) => template.type === "preset");
  const customs = state.templates.filter((template) => template.type === "custom");
  appendTemplateOptions("预设模板", presets);
  appendTemplateOptions("我的模板", customs);
  elements.analysisTemplateSelect.value = state.selectedTemplateId;
}

function appendTemplateOptions(label, templates) {
  if (templates.length === 0) {
    return;
  }

  const group = document.createElement("optgroup");
  group.label = label;
  templates.forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    group.append(option);
  });
  elements.analysisTemplateSelect.append(group);
}

function handleTemplateSelection(event) {
  state.selectedTemplateId = event.target.value;
}

function renderTemplateManager() {
  elements.templateManager.replaceChildren(
    renderTemplateGroup("预设模板", state.templates.filter((template) => template.type === "preset")),
    renderTemplateGroup("我的模板", state.templates.filter((template) => template.type === "custom"))
  );
}

function renderTemplateGroup(title, templates) {
  const section = document.createElement("section");
  section.className = "template-group";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const list = document.createElement("div");
  list.className = "template-list";

  if (templates.length === 0) {
    const empty = document.createElement("p");
    empty.className = "setting-hint";
    empty.textContent = title === "我的模板" ? "还没有自定义模板。" : "暂无模板。";
    list.append(empty);
  } else {
    templates.forEach((template) => list.append(renderTemplateCard(template)));
  }

  section.append(heading, list);
  return section;
}

function renderTemplateCard(template) {
  const card = document.createElement("article");
  card.className = "template-card";

  const header = document.createElement("div");
  header.className = "template-card-header";

  const title = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = template.name;
  const meta = document.createElement("p");
  meta.className = "setting-hint";
  meta.textContent = `${template.fields.filter((field) => field.enabled).length} 个启用维度${template.isDefault ? " · 默认" : ""}`;
  title.append(name, meta);

  const actions = document.createElement("div");
  actions.className = "template-actions";

  const viewButton = createInlineButton("查看", () => alert(formatTemplatePreview(template)));
  const defaultButton = createInlineButton("设为默认", () => setDefaultTemplate(template.id));
  actions.append(viewButton, defaultButton);

  if (template.type === "preset") {
    actions.append(createInlineButton("复制为我的模板", () => duplicateBuiltInTemplate(template.id)));
  } else {
    actions.append(
      createInlineButton("编辑", () => editTemplateWithPrompts(template.id)),
      createInlineButton("复制", () => duplicateBuiltInTemplate(template.id)),
      createInlineButton("删除", () => deleteCustomTemplate(template.id), "danger-inline")
    );
  }

  header.append(title, actions);

  const description = document.createElement("p");
  description.className = "setting-hint";
  description.textContent = template.description || "无描述";

  const fields = document.createElement("div");
  fields.className = "template-field-list";
  template.fields.forEach((field) => {
    const chip = document.createElement("span");
    chip.className = `template-field-chip${field.enabled ? "" : " is-disabled"}`;
    chip.textContent = field.label;
    fields.append(chip);
  });

  card.append(header, description, fields);
  return card;
}

function createInlineButton(text, onClick, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `inline-action-button ${extraClass}`.trim();
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function formatTemplatePreview(template) {
  return [
    `${template.name}`,
    "",
    template.description || "",
    "",
    ...template.fields.map((field) => `${field.enabled ? "✓" : "×"} ${field.label} (${field.key})\n${field.promptInstruction}`)
  ].join("\n");
}

async function duplicateBuiltInTemplate(templateId) {
  const source = state.templates.find((template) => template.id === templateId);
  if (!source) {
    return;
  }

  const now = new Date().toISOString();
  const copy = {
    ...cloneDeep(source),
    id: `custom_${Date.now()}`,
    type: "custom",
    isBuiltIn: false,
    isDefault: false,
    baseTemplateId: source.baseTemplateId || source.id,
    name: `${source.name} - 我的版本`,
    createdAt: now,
    updatedAt: now
  };
  await saveAnalysisTemplates([...state.templates, copy]);
  state.selectedTemplateId = copy.id;
  renderTemplateSelector();
  renderTemplateManager();
  elements.settingsStatus.textContent = "已复制为我的模板";
  editTemplateWithPrompts(copy.id);
}

async function createCustomTemplate() {
  const now = new Date().toISOString();
  const template = {
    id: `custom_${Date.now()}`,
    type: "custom",
    name: "未命名模板",
    description: "",
    isBuiltIn: false,
    isDefault: false,
    baseTemplateId: null,
    fields: [],
    createdAt: now,
    updatedAt: now
  };
  await saveAnalysisTemplates([...state.templates, template]);
  renderTemplateSelector();
  renderTemplateManager();
  editTemplateWithPrompts(template.id);
}

async function editTemplateWithPrompts(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) {
    return;
  }

  if (template.type === "preset") {
    elements.settingsStatus.textContent = "预设模板不能直接修改。你可以复制为我的模板后再编辑。";
    return;
  }

  const name = prompt("模板名称", template.name);
  if (name == null) {
    return;
  }

  const description = prompt("模板描述", template.description || "");
  if (description == null) {
    return;
  }

  let fields = [...template.fields];
  let keepEditing = true;
  while (keepEditing) {
    const action = prompt("输入操作：add 添加维度，toggle 启用/禁用，delete 删除维度，done 保存", "done");
    if (action == null || action === "done") {
      keepEditing = false;
    } else if (action === "add") {
      const label = prompt("维度名称，例如：高级感来源", "");
      const key = sanitizeTemplateKey(prompt("字段 key，例如：luxury_source", label || ""));
      const promptInstruction = prompt("分析要求", "");
      if (label && key && promptInstruction) {
        fields.push(normalizeTemplateField({ key, label, promptInstruction, enabled: true }, fields.length));
      }
    } else if (action === "toggle") {
      const key = prompt(`输入要切换启用状态的 key：\n${fields.map((field) => `${field.key}: ${field.label}`).join("\n")}`, "");
      fields = fields.map((field) => field.key === key ? { ...field, enabled: !field.enabled } : field);
    } else if (action === "delete") {
      const key = prompt(`输入要删除的 key：\n${fields.map((field) => `${field.key}: ${field.label}`).join("\n")}`, "");
      fields = fields.filter((field) => field.key !== key);
    }
  }

  await updateCustomTemplate(templateId, {
    name: name.trim() || template.name,
    description: description.trim(),
    fields,
    updatedAt: new Date().toISOString()
  });
}

async function updateCustomTemplate(templateId, patch) {
  await saveAnalysisTemplates(state.templates.map((template) => {
    if (template.id !== templateId || template.type !== "custom") {
      return template;
    }
    return normalizeTemplates([{ ...template, ...patch }])[0];
  }));
  renderTemplateSelector();
  renderTemplateManager();
  elements.settingsStatus.textContent = "模板已保存";
}

async function deleteCustomTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template || template.type !== "custom") {
    return;
  }

  if (!confirm(`删除模板「${template.name}」？`)) {
    return;
  }

  await saveAnalysisTemplates(state.templates.filter((item) => item.id !== templateId));
  if (state.selectedTemplateId === templateId) {
    state.selectedTemplateId = DEFAULT_TEMPLATE_ID;
  }
  renderTemplateSelector();
  renderTemplateManager();
  elements.settingsStatus.textContent = "模板已删除";
}

async function exportCustomTemplates() {
  const templates = state.templates.filter((template) => template.type === "custom");
  downloadJsonFile(`aesthetic-lens-templates-${getDateStamp()}.json`, {
    app: "Aesthetic Lens",
    type: "analysis_templates",
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    templates
  });
  elements.settingsStatus.textContent = "我的模板已导出";
}

async function handleTemplateImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    if (!payload || payload.app !== "Aesthetic Lens" || payload.type !== "analysis_templates" || !Array.isArray(payload.templates)) {
      throw new Error("Invalid template file.");
    }

    const now = new Date().toISOString();
    const existingIds = new Set(state.templates.map((template) => template.id));
    const imported = payload.templates.map((template) => {
      const id = existingIds.has(template.id) || template.type === "preset" ? `custom_${Date.now()}_${Math.random().toString(16).slice(2)}` : template.id;
      existingIds.add(id);
      return normalizeTemplates([{
        ...template,
        id,
        type: "custom",
        isBuiltIn: false,
        isDefault: false,
        createdAt: now,
        updatedAt: now
      }])[0];
    });

    await saveAnalysisTemplates([...state.templates, ...imported]);
    renderTemplateSelector();
    renderTemplateManager();
    elements.settingsStatus.textContent = "模板导入完成";
  } catch (error) {
    elements.settingsStatus.textContent = "模板导入失败：文件格式不正确";
  }
}

async function ensureDefaultCollections() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.COLLECTIONS);
  const now = new Date().toISOString();
  const existing = Array.isArray(result[STORAGE_KEYS.COLLECTIONS]) ? result[STORAGE_KEYS.COLLECTIONS] : [];
  const byId = new Map(existing.map((collection) => [collection.id, normalizeCollection(collection)]));

  DEFAULT_COLLECTIONS.forEach((collection) => {
    if (!byId.has(collection.id)) {
      byId.set(collection.id, normalizeCollection({
        ...collection,
        createdAt: now,
        updatedAt: now
      }));
    }
  });

  const collections = Array.from(byId.values());
  await saveCollections(collections);
  return collections;
}

function normalizeCollection(collection) {
  const now = new Date().toISOString();
  return {
    id: sanitizeCollectionId(collection && collection.id || `collection_${Date.now()}`),
    name: collection && collection.name || "未命名 Collection",
    description: collection && collection.description || "",
    isDefault: Boolean(collection && collection.isDefault),
    createdAt: collection && collection.createdAt || now,
    updatedAt: collection && collection.updatedAt || now
  };
}

function sanitizeCollectionId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || `collection_${Date.now()}`;
}

async function saveCollections(collections) {
  state.collections = (Array.isArray(collections) ? collections : []).map(normalizeCollection);
  await chrome.storage.local.set({ [STORAGE_KEYS.COLLECTIONS]: state.collections });
}

function renderCollectionFilter() {
  const currentValue = state.selectedCollectionId || ALL_COLLECTIONS_ID;
  elements.collectionFilterSelect.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = ALL_COLLECTIONS_ID;
  allOption.textContent = "全部";
  elements.collectionFilterSelect.append(allOption);

  state.collections.forEach((collection) => {
    const option = document.createElement("option");
    option.value = collection.id;
    option.textContent = collection.name;
    elements.collectionFilterSelect.append(option);
  });

  elements.collectionFilterSelect.value = state.collections.some((collection) => collection.id === currentValue)
    ? currentValue
    : ALL_COLLECTIONS_ID;
  state.selectedCollectionId = elements.collectionFilterSelect.value;
  renderExportCollectionSelector();
  renderBatchCollectionSelector();
}

function renderBatchCollectionSelector() {
  if (!elements.batchCollectionSelect) {
    return;
  }

  const previous = elements.batchCollectionSelect.value;
  elements.batchCollectionSelect.replaceChildren();
  state.collections.forEach((collection) => {
    const option = document.createElement("option");
    option.value = collection.id;
    option.textContent = collection.name;
    elements.batchCollectionSelect.append(option);
  });
  elements.batchCollectionSelect.value = state.collections.some((collection) => collection.id === previous)
    ? previous
    : DEFAULT_COLLECTION_ID;
}

function renderExportCollectionSelector() {
  if (!elements.exportCollectionSelect) {
    return;
  }

  const previous = elements.exportCollectionSelect.value;
  elements.exportCollectionSelect.replaceChildren();
  state.collections.forEach((collection) => {
    const option = document.createElement("option");
    option.value = collection.id;
    option.textContent = collection.name;
    elements.exportCollectionSelect.append(option);
  });
  elements.exportCollectionSelect.value = state.collections.some((collection) => collection.id === previous)
    ? previous
    : state.selectedCollectionId !== ALL_COLLECTIONS_ID
      ? state.selectedCollectionId
      : DEFAULT_COLLECTION_ID;
  elements.exportCollectionSelect.disabled = elements.exportScopeSelect && elements.exportScopeSelect.value !== "specified";
}

function handleCollectionFilterChange(event) {
  state.selectedCollectionId = event.target.value || ALL_COLLECTIONS_ID;
  renderLibrary();
  renderExportCollectionSelector();
}

async function createCollectionFromPrompt() {
  const name = prompt("Collection 名称", "");
  if (!name || !name.trim()) {
    return;
  }

  const description = prompt("Collection 描述（可选）", "") || "";
  const now = new Date().toISOString();
  const collection = normalizeCollection({
    id: `collection_${Date.now()}`,
    name: name.trim(),
    description: description.trim(),
    createdAt: now,
    updatedAt: now
  });
  await saveCollections([...state.collections, collection]);
  state.selectedCollectionId = collection.id;
  renderCollectionFilter();
  renderLibrary();
  elements.libraryStatus.textContent = "Collection 已创建";
}

async function renameSelectedCollection() {
  const collection = getSelectedCollection();
  if (!collection || collection.isDefault) {
    elements.libraryStatus.textContent = "默认 Collection 不建议重命名。";
    return;
  }

  const name = prompt("新的 Collection 名称", collection.name);
  if (!name || !name.trim()) {
    return;
  }

  await saveCollections(state.collections.map((item) => item.id === collection.id
    ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() }
    : item));
  renderCollectionFilter();
  renderLibrary();
  elements.libraryStatus.textContent = "Collection 已重命名";
}

async function deleteSelectedCollection() {
  const collection = getSelectedCollection();
  if (!collection || collection.id === ALL_COLLECTIONS_ID) {
    return;
  }

  if (collection.id === DEFAULT_COLLECTION_ID || collection.id === UNCATEGORIZED_COLLECTION_ID) {
    elements.libraryStatus.textContent = "默认 Collection 不能删除。";
    return;
  }

  if (!confirm(`删除 Collection「${collection.name}」？素材不会被删除，会移动到「未分类」。`)) {
    return;
  }

  const nextCollections = state.collections.filter((item) => item.id !== collection.id);
  const nextLibrary = state.favorites.map((item) => {
    const remainingIds = (item.collectionIds || []).filter((id) => id !== collection.id);
    return {
      ...item,
      collectionIds: remainingIds.length > 0 ? remainingIds : [UNCATEGORIZED_COLLECTION_ID],
      updatedAt: new Date().toISOString()
    };
  });

  await saveCollections(nextCollections);
  await setLibrary(nextLibrary);
  state.selectedCollectionId = UNCATEGORIZED_COLLECTION_ID;
  renderCollectionFilter();
  renderLibrary();
  elements.libraryStatus.textContent = "Collection 已删除，素材已移至未分类";
}

function getSelectedCollection() {
  return state.collections.find((collection) => collection.id === state.selectedCollectionId) || null;
}

function renderDetailCollections(favorite) {
  elements.detailCollections.replaceChildren();
  const selectedIds = new Set(Array.isArray(favorite.collectionIds) ? favorite.collectionIds : [DEFAULT_COLLECTION_ID]);

  state.collections.forEach((collection) => {
    const label = document.createElement("label");
    label.className = "collection-checkbox";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = collection.id;
    input.checked = selectedIds.has(collection.id);
    const text = document.createElement("span");
    text.textContent = collection.name;
    label.append(input, text);
    elements.detailCollections.append(label);
  });
}

async function saveSelectedItemCollections() {
  const selected = getSelectedFavorite();
  if (!selected) {
    return;
  }

  const checkedIds = Array.from(elements.detailCollections.querySelectorAll("input:checked")).map((input) => input.value);
  const collectionIds = checkedIds.length > 0 ? checkedIds : [UNCATEGORIZED_COLLECTION_ID];
  const updated = await updateLibraryItem(selected.id, (item) => ({
    ...item,
    collectionIds,
    updatedAt: new Date().toISOString()
  }));
  state.selectedFavoriteId = updated.id;
  renderLibrary();
  elements.libraryStatus.textContent = "Collection 已保存";
}

async function ensureDefaultTagRegistry() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TAG_REGISTRY);
  const existing = Array.isArray(result[STORAGE_KEYS.TAG_REGISTRY]) ? result[STORAGE_KEYS.TAG_REGISTRY] : [];
  const now = new Date().toISOString();
  const byName = new Map(existing.map((tag) => [String(tag.name || "").toLowerCase(), normalizeTagRecord(tag)]));

  DEFAULT_TAG_REGISTRY.forEach(([name, type, aliases]) => {
    const key = name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, normalizeTagRecord({
        id: sanitizeTemplateKey(name),
        name,
        type,
        aliases,
        color: "",
        createdAt: now,
        updatedAt: now
      }));
    }
  });

  const registry = Array.from(byName.values());
  await chrome.storage.local.set({ [STORAGE_KEYS.TAG_REGISTRY]: registry });
  return registry;
}

function normalizeTagRecord(tag) {
  const now = new Date().toISOString();
  return {
    id: tag && tag.id || sanitizeTemplateKey(tag && tag.name || `tag_${Date.now()}`),
    name: tag && tag.name || "未命名标签",
    type: tag && tag.type || "custom",
    aliases: Array.isArray(tag && tag.aliases) ? tag.aliases : [],
    color: tag && tag.color || "",
    createdAt: tag && tag.createdAt || now,
    updatedAt: tag && tag.updatedAt || now
  };
}

function normalizeTag(tagName, tagRegistry = state.tagRegistry) {
  const value = String(tagName || "").trim();
  if (!value) {
    return "";
  }

  const normalized = value.toLowerCase();
  const match = (tagRegistry || []).find((tag) => {
    if (String(tag.name || "").toLowerCase() === normalized) {
      return true;
    }
    return Array.isArray(tag.aliases)
      && tag.aliases.some((alias) => String(alias || "").trim().toLowerCase() === normalized);
  });

  return match ? match.name : value;
}

function normalizeItemTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => normalizeTag(tag))
    .flatMap((tag) => localizeTags([tag]))
    .filter(Boolean))];
}

function renderSettings() {
  elements.mockModeInput.checked = state.settings.useMockAnalysis;
  elements.realModeInput.checked = !state.settings.useMockAnalysis;
  elements.providerSelect.value = state.settings.provider;
  elements.modelInput.value = state.settings.model;
  elements.analysisLanguageSelect.value = state.settings.analysisLanguage;
  elements.apiKeyInput.value = "";
  elements.apiKeyInput.type = "password";
  elements.toggleApiKeyButton.textContent = "显示";
  elements.autoSaveAnalysisInput.checked = state.settings.autoSaveAnalysis;
  elements.showDebugInfoInput.checked = state.settings.showDebugInfo;
  elements.apiKeySavedText.textContent = formatSavedApiKey(state.settings.apiKey);
  updateSettingsLibraryCount();
}

function getSettingsFromForm() {
  const typedApiKey = elements.apiKeyInput.value.trim();

  return normalizeSettings({
    useMockAnalysis: elements.mockModeInput.checked,
    provider: elements.providerSelect.value,
    apiKey: typedApiKey || state.settings.apiKey || "",
    model: elements.modelInput.value.trim() || DEFAULT_SETTINGS.model,
    analysisLanguage: elements.analysisLanguageSelect.value,
    autoSaveAnalysis: elements.autoSaveAnalysisInput.checked,
    showDebugInfo: elements.showDebugInfoInput.checked
  });
}

function handleProviderChange() {
  if (elements.providerSelect.value === "google" && (!elements.modelInput.value.trim() || elements.modelInput.value === DEFAULT_SETTINGS.model)) {
    elements.modelInput.value = "gemini-3.5-flash";
  }

  if (elements.providerSelect.value === "openai" && (!elements.modelInput.value.trim() || elements.modelInput.value === "gemini-3.5-flash")) {
    elements.modelInput.value = DEFAULT_SETTINGS.model;
  }
}

async function saveSettings() {
  state.settings = getSettingsFromForm();
  state.hasSavedApiKey = Boolean(state.settings.apiKey);
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: state.settings });
  elements.apiKeyInput.value = "";
  renderSettings();
  elements.settingsStatus.textContent = "设置已保存。";
}

async function clearApiKey() {
  state.settings = normalizeSettings({
    ...state.settings,
    apiKey: ""
  });
  state.hasSavedApiKey = false;
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: state.settings });
  renderSettings();
  elements.settingsStatus.textContent = "API Key 已清除。";
}

function testConnection() {
  const draft = getSettingsFromForm();

  if (draft.useMockAnalysis) {
    elements.settingsStatus.textContent = "Mock 模式可用。";
    return;
  }

  if (!draft.apiKey) {
    elements.settingsStatus.textContent = "请先填写 API Key。";
    return;
  }

  elements.settingsStatus.textContent = "配置已就绪，真实连接测试将在接入 API 后启用。";
}

function toggleApiKeyVisibility() {
  const isPassword = elements.apiKeyInput.type === "password";
  elements.apiKeyInput.type = isPassword ? "text" : "password";
  elements.toggleApiKeyButton.textContent = isPassword ? "隐藏" : "显示";
}

function formatSavedApiKey(apiKey) {
  if (!apiKey) {
    return "未保存 API Key";
  }

  return `已保存：••••••••${apiKey.slice(-4)}`;
}

function handleLibrarySearch(event) {
  state.searchQuery = event.target.value.trim().toLowerCase();
  renderLibrary();
}

function setAnalysisFilter(filterName) {
  state.analysisFilter = filterName;
  elements.filterButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === filterName);
  });
  renderLibrary();
}

function loadActiveImage() {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_ACTIVE_IMAGE }, (response) => {
    if (chrome.runtime.lastError) {
      showEmptyState();
      return;
    }

    if (response && response.ok && response.image) {
      renderImage(response.image);
    } else {
      showEmptyState();
    }
  });
}

async function loadFavorites() {
  state.favorites = await getLibrary();
  renderLibrary();
}

function handleStorageChange(changes, areaName) {
  if (areaName !== "local") {
    return;
  }

  if (changes[STORAGE_KEYS.ACTIVE_IMAGE] && changes[STORAGE_KEYS.ACTIVE_IMAGE].newValue) {
    renderImage(changes[STORAGE_KEYS.ACTIVE_IMAGE].newValue);
  }

  if (changes[STORAGE_KEYS.FAVORITES]) {
    state.favorites = normalizeFavorites(changes[STORAGE_KEYS.FAVORITES].newValue);
    renderLibrary();
    updateSettingsLibraryCount();
  }

  if (changes[STORAGE_KEYS.COLLECTIONS]) {
    state.collections = Array.isArray(changes[STORAGE_KEYS.COLLECTIONS].newValue)
      ? changes[STORAGE_KEYS.COLLECTIONS].newValue.map(normalizeCollection)
      : [];
    renderCollectionFilter();
    renderLibrary();
  }

  if (changes[STORAGE_KEYS.TEMPLATES]) {
    state.templates = normalizeTemplates(changes[STORAGE_KEYS.TEMPLATES].newValue);
    renderTemplateSelector();
    renderTemplateManager();
  }

  if (changes[STORAGE_KEYS.TAG_REGISTRY]) {
    state.tagRegistry = Array.isArray(changes[STORAGE_KEYS.TAG_REGISTRY].newValue)
      ? changes[STORAGE_KEYS.TAG_REGISTRY].newValue.map(normalizeTagRecord)
      : [];
  }

  if (changes[SETTINGS_STORAGE_KEY]) {
    state.settings = normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue);
    state.hasSavedApiKey = Boolean(state.settings.apiKey);
    renderSettings();
  }
}

function renderImage(image) {
  state.activeImage = image;
  state.activeAnalysis = null;
  state.currentUserEdits = {};
  state.currentCustomDimensions = [];
  elements.saveStatus.textContent = "";
  elements.analysisStatus.textContent = "点击“开始分析”生成结构化结果。";
  elements.noteInput.value = "";

  elements.previewImage.src = image.imageUrl;
  elements.previewImage.alt = image.alt || "选中的网页图片预览";
  elements.imageSize.textContent = formatImageSize(image);
  elements.aspectRatio.textContent = image.aspectRatio || formatAspectRatio(image.width, image.height);
  elements.pageTitle.textContent = image.pageTitle || "Untitled page";
  setLink(elements.pageUrl, image.pageUrl);
  setLink(elements.imageUrl, image.imageUrl);
  elements.analysisResult.replaceChildren();
  updateEmptyStates();
}

function showEmptyState() {
  state.activeImage = null;
  state.activeAnalysis = null;
  state.currentUserEdits = {};
  state.currentCustomDimensions = [];
  elements.analysisResult.replaceChildren();
  updateEmptyStates();
}

function updateEmptyStates(filteredLibrary = getVisibleFavorites()) {
  const hasAnalysisContent = Boolean(state.activeImage || state.activeAnalysis);
  elements.emptyState.classList.toggle("is-hidden", hasAnalysisContent);
  elements.imagePanel.classList.toggle("is-hidden", !hasAnalysisContent);

  const hasFilteredLibrary = filteredLibrary.length > 0;
  elements.libraryEmptyState.classList.toggle("is-hidden", hasFilteredLibrary);
  elements.libraryContent.classList.toggle("is-hidden", !hasFilteredLibrary);
  elements.favoriteDetail.classList.toggle("is-hidden", state.organizeMode || !hasFilteredLibrary || !getSelectedFavorite());
}

function updateSettingsLibraryCount() {
  if (elements.settingsLibraryCount) {
    elements.settingsLibraryCount.textContent = `当前素材数量：${state.favorites.length}`;
  }
}

function cloneDeep(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function setValueByPath(target, path, value) {
  if (!path) {
    return;
  }

  const keys = path.split(".");
  let current = target;
  keys.slice(0, -1).forEach((key) => {
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  });

  current[keys[keys.length - 1]] = cloneDeep(value);
}

function getValueByPath(target, path) {
  if (!path) {
    return target;
  }

  return path.split(".").reduce((current, key) => {
    if (current == null) {
      return undefined;
    }

    return current[key];
  }, target);
}

function buildFinalAnalysis(rawAnalysis, userEdits) {
  const finalAnalysis = cloneDeep(rawAnalysis || {});
  Object.entries(userEdits || {}).forEach(([path, editedValue]) => {
    setValueByPath(finalAnalysis, path, editedValue);
  });
  return finalAnalysis;
}

function normalizePrompt(prompt) {
  if (!prompt) {
    return { zh: "", en: "", negative_prompt: "" };
  }

  if (typeof prompt === "string") {
    return { zh: prompt, en: "", negative_prompt: "" };
  }

  return {
    zh: prompt.zh || "",
    en: prompt.en || "",
    negative_prompt: prompt.negative_prompt || ""
  };
}

function normalizeExportCustomDimensions(customDimensions) {
  if (!Array.isArray(customDimensions)) {
    return [];
  }

  return customDimensions.map((dimension) => ({
    title: dimension.title || "",
    label: dimension.label || "",
    evidence: dimension.evidence || "",
    function: dimension.function || ""
  }));
}

function getStyleStrength(score) {
  const numericScore = Number(score);
  if (numericScore >= 0.8) {
    return "high";
  }

  if (numericScore >= 0.5) {
    return "medium";
  }

  return "low";
}

function setLink(anchor, url) {
  anchor.href = url || "#";
  anchor.textContent = url || "-";
}

async function analyzeActiveImage() {
  if (!state.activeImage) {
    return;
  }

  if (!state.settings.useMockAnalysis && !state.settings.apiKey) {
    renderMissingApiKeyError();
    return;
  }

  elements.analyzeButton.disabled = true;
  elements.analysisStatus.textContent = "分析中...";

  try {
    const template = getSelectedTemplate();
    const analysis = await analyzeImage(buildImageInput(state.activeImage), template);
    state.activeAnalysis = analysis;
    state.currentUserEdits = {};
    state.currentCustomDimensions = [];
    renderAnalysis(analysis);
    elements.analysisStatus.textContent = "分析完成。";
  } catch (error) {
    if (isMissingApiKeyError(error)) {
      renderMissingApiKeyError();
    } else {
      elements.analysisStatus.textContent = `分析失败：${error.message}`;
    }
  } finally {
    elements.analyzeButton.disabled = false;
  }
}

function renderMissingApiKeyError() {
  state.activeAnalysis = null;
  elements.analysisStatus.textContent = "";

  const card = document.createElement("div");
  card.className = "analysis-error-card";

  const title = document.createElement("h2");
  title.textContent = "无法开始真实 AI 分析";

  const message = document.createElement("p");
  message.textContent = "你还没有配置 API Key。请前往「设置」页面填写 API Key，或开启 Mock 分析模式。";

  const actions = document.createElement("div");
  actions.className = "analysis-error-actions";

  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "secondary-button";
  settingsButton.textContent = "去设置";
  settingsButton.addEventListener("click", () => switchTab("settings"));

  const mockButton = document.createElement("button");
  mockButton.type = "button";
  mockButton.className = "primary-button";
  mockButton.textContent = "开启 Mock 分析";
  mockButton.addEventListener("click", enableMockAndAnalyze);

  actions.append(settingsButton, mockButton);
  card.append(title, message, actions);
  elements.analysisResult.replaceChildren(card);
}

async function enableMockAndAnalyze() {
  state.settings = normalizeSettings({
    ...state.settings,
    useMockAnalysis: true
  });
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: state.settings });
  renderSettings();
  await analyzeActiveImage();
}

function isMissingApiKeyError(error) {
  return error && typeof error.message === "string" && error.message.includes("请先在设置页填写 API Key");
}

function buildImageInput(image) {
  return {
    imageUrl: image.imageUrl,
    pageUrl: image.pageUrl,
    pageTitle: image.pageTitle,
    width: image.width,
    height: image.height
  };
}

function renderAnalysis(analysis) {
  const finalAnalysis = buildFinalAnalysis(analysis, state.currentUserEdits);
  elements.analysisResult.replaceChildren(
    createCoreSummary(finalAnalysis),
    createFocusBreakdown(finalAnalysis),
    renderFullAnalysisAccordion(analysis, {
      context: "current",
      userEdits: state.currentUserEdits,
      customDimensions: state.currentCustomDimensions
    })
  );
  updateEmptyStates();
}

function createCoreSummary(analysis) {
  const summary = document.createElement("section");
  summary.className = "analysis-summary-card";

  const title = document.createElement("h2");
  title.textContent = "核心价值";

  const coreValue = document.createElement("p");
  coreValue.className = "summary-main";
  coreValue.textContent = analysis.aesthetic_value.core_value || "这张图片具有可复用的视觉参考价值。";

  const whyItWorks = document.createElement("p");
  whyItWorks.className = "summary-copy";
  whyItWorks.textContent = analysis.aesthetic_value.why_it_works || "";

  const useLabel = document.createElement("p");
  useLabel.className = "summary-label";
  useLabel.textContent = "可复用方向";

  const uses = document.createElement("div");
  uses.className = "tag-row";
  localizeTags(analysis.aesthetic_value.can_be_used_for || []).forEach((item) => uses.append(createTag(item)));

  const tagLabel = document.createElement("p");
  tagLabel.className = "summary-label";
  tagLabel.textContent = "标签";

  const tags = document.createElement("div");
  tags.className = "tag-row";
  localizeTags(analysis.tags || []).forEach((tag) => tags.append(createTag(tag)));

  summary.append(title, coreValue, whyItWorks, useLabel, uses, tagLabel, tags);
  return summary;
}

function createFocusBreakdown(analysis) {
  const section = document.createElement("section");
  section.className = "analysis-focus-section";

  const title = document.createElement("h2");
  title.textContent = "重点拆解";

  const grid = document.createElement("div");
  grid.className = "analysis-focus-grid";

  getFocusItems(analysis).forEach((item) => {
    grid.append(createFocusCard(item.title, item.analysisItem));
  });

  section.append(title, grid);
  return section;
}

function getFocusItems(analysis) {
  const cinematic = analysis.cinematic_analysis;
  const templateItems = getTemplateAnalysisSections(analysis)
    .map((section) => ({ title: section.title, analysisItem: section.getItem(analysis) }));
  return [
    ...templateItems,
    { title: "构图", analysisItem: buildCompositionItem(cinematic.composition) },
    { title: "光影", analysisItem: buildLightingItem(cinematic.lighting) },
    { title: "色彩系统", analysisItem: buildColorSystemItem(cinematic.color_system) },
    { title: "观看视角", analysisItem: cinematic.viewpoint },
    { title: "情绪功能", analysisItem: buildMoodItem(cinematic.mood) }
  ]
    .filter((item) => item.analysisItem && item.analysisItem.label)
    .slice(0, 4);
}

function createFocusCard(title, analysisItem) {
  const card = document.createElement("article");
  card.className = "analysis-focus-card";

  const heading = document.createElement("h3");
  heading.textContent = `${title}：${formatAnalysisValue(analysisItem.label)}`;

  const evidence = document.createElement("p");
  evidence.className = "clamped-text";
  evidence.textContent = `画面依据：${formatAnalysisValue(analysisItem.evidence)}`;

  const visualFunction = document.createElement("p");
  visualFunction.className = "clamped-text";
  visualFunction.textContent = `视觉作用：${formatAnalysisValue(analysisItem.function)}`;

  card.append(heading, evidence, visualFunction);
  return card;
}

function renderFullAnalysisAccordion(analysis, options = {}) {
  const userEdits = options.userEdits || {};
  const finalAnalysis = buildFinalAnalysis(analysis, userEdits);
  const wrapper = document.createElement("section");
  wrapper.className = "analysis-full-section";

  const title = document.createElement("h2");
  title.textContent = "完整分析";

  const list = document.createElement("div");
  list.className = "analysis-accordion-list";

  const sections = options.includeTags
    ? ANALYSIS_SECTIONS
    : ANALYSIS_SECTIONS.filter((section) => section.title !== "标签");
  const displaySections = [
    ...sections,
    ...getTemplateAnalysisSections(finalAnalysis)
  ];

  displaySections.forEach((section) => {
    const item = section.getItem(finalAnalysis);
    const rawValue = getValueByPath(finalAnalysis, section.path);
    list.append(createAccordionItem(section, item, rawValue, {
      context: options.context || "current",
      itemId: options.itemId || null,
      isEdited: Boolean(userEdits[section.path])
    }));
  });

  wrapper.append(title, list, renderCustomDimensions(options.context || "current", options.itemId || null, options.customDimensions || []));
  return wrapper;
}

function getTemplateAnalysisSections(analysis) {
  const templateAnalysis = analysis && analysis.template_analysis;
  if (!templateAnalysis || typeof templateAnalysis !== "object") {
    return [];
  }

  const selectedTemplate = state.templates.find((template) => analysis.template && template.id === analysis.template.id)
    || state.templates.find((template) => template.id === state.selectedTemplateId);
  const fields = selectedTemplate && Array.isArray(selectedTemplate.fields)
    ? selectedTemplate.fields.filter((field) => field.enabled !== false)
    : [];
  const fieldLabels = new Map(fields.map((field) => [field.key, field.label || field.key]));

  return Object.keys(templateAnalysis)
    .filter((key) => !CORE_TEMPLATE_FIELD_KEYS.has(key))
    .map((key) => ({
      title: fieldLabels.get(key) || key,
      path: `template_analysis.${key}`,
      getItem: (item) => item.template_analysis && item.template_analysis[key]
    }));
}

function createAccordionItem(section, analysisItem, rawValue, options) {
  const details = document.createElement("details");
  details.className = "analysis-accordion-item";

  const summary = document.createElement("summary");
  const summaryTitle = document.createElement("span");
  summaryTitle.textContent = section.title;

  const summaryActions = document.createElement("span");
  summaryActions.className = "accordion-actions";

  if (options.isEdited) {
    const badge = document.createElement("span");
    badge.className = "edited-badge";
    badge.textContent = "已编辑";
    summaryActions.append(badge);
  }

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "inline-action-button";
  editButton.textContent = "编辑";
  editButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    details.open = true;
    content.replaceChildren(renderEditForm(section.path, section.title, rawValue, options.context, options.itemId));
  });
  summaryActions.append(editButton);
  summary.append(summaryTitle, summaryActions);

  const content = createSchemaAnalysisItem(section.title, analysisItem);
  details.append(summary, content);
  return details;
}

function createSchemaAnalysisItem(title, analysisItem) {
  const card = document.createElement("div");
  card.className = "analysis-item";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const fields = document.createElement("dl");
  fields.className = "analysis-fields";

  appendAnalysisField(fields, "判断", analysisItem && analysisItem.label);
  appendAnalysisField(fields, "画面依据", analysisItem && analysisItem.evidence);
  appendAnalysisField(fields, "视觉作用", analysisItem && analysisItem.function);

  card.append(heading, fields);
  return card;
}

function appendAnalysisField(container, label, value) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = formatAnalysisValue(value);
  row.append(term, description);
  container.append(row);
}

function renderEditForm(path, title, value, context, itemId) {
  const form = document.createElement("form");
  form.className = "analysis-edit-form";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const editedValue = readEditableValue(form, value);
    await saveUserEdit(context, path, editedValue, itemId);
  });

  const heading = document.createElement("p");
  heading.className = "edit-form-title";
  heading.textContent = `编辑 ${title}`;

  const fields = document.createElement("div");
  fields.className = "edit-field-list";
  appendEditableFields(fields, value, []);

  const actions = document.createElement("div");
  actions.className = "edit-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "primary-button compact-button";
  saveButton.textContent = "保存";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary-button compact-button";
  cancelButton.textContent = "取消";
  cancelButton.addEventListener("click", () => {
    if (context === "library") {
      const favorite = getSelectedFavorite();
      if (favorite) {
        renderFavoriteDetail(favorite);
      }
      return;
    }

    if (state.activeAnalysis) {
      renderAnalysis(state.activeAnalysis);
    }
  });

  actions.append(saveButton, cancelButton);
  form.append(heading, fields, actions);
  return form;
}

function appendEditableFields(container, value, pathParts) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, childValue]) => {
      appendEditableFields(container, childValue, [...pathParts, key]);
    });
    return;
  }

  const label = document.createElement("label");
  label.className = "edit-field";

  const name = document.createElement("span");
  name.textContent = pathParts.join(".") || "value";

  const textarea = document.createElement("textarea");
  textarea.rows = Array.isArray(value) ? 2 : 3;
  textarea.dataset.path = pathParts.join(".");
  textarea.value = Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);

  label.append(name, textarea);
  container.append(label);
}

function readEditableValue(form, template) {
  const result = Array.isArray(template) ? [] : {};

  if (!template || typeof template !== "object" || Array.isArray(template)) {
    const textarea = form.querySelector("textarea");
    return parseEditedFieldValue(textarea ? textarea.value : "", template);
  }

  form.querySelectorAll("textarea[data-path]").forEach((textarea) => {
    const originalValue = getValueByPath(template, textarea.dataset.path);
    setValueByPath(result, textarea.dataset.path, parseEditedFieldValue(textarea.value, originalValue));
  });

  return result;
}

function parseEditedFieldValue(value, originalValue) {
  if (Array.isArray(originalValue)) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  if (typeof originalValue === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : originalValue;
  }

  return value.trim();
}

async function saveUserEdit(context, path, editedData, itemId) {
  if (context === "library") {
    const item = await updateLibraryItem(itemId, (favorite) => ({
      ...favorite,
      user_edits: {
        ...(favorite.user_edits || {}),
        [path]: editedData
      },
      updatedAt: new Date().toISOString()
    }));
    renderFavoriteDetail(item);
    elements.libraryStatus.textContent = "修改已保存";
    return;
  }

  state.currentUserEdits = {
    ...state.currentUserEdits,
    [path]: editedData
  };
  renderAnalysis(state.activeAnalysis);
  elements.analysisStatus.textContent = "修改已保存";
}

function renderCustomDimensions(context, itemId, customDimensions) {
  const section = document.createElement("section");
  section.className = "custom-dimensions-section";

  const header = document.createElement("div");
  header.className = "custom-dimensions-header";

  const title = document.createElement("h2");
  title.textContent = "我的补充分析";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "secondary-button compact-button";
  addButton.textContent = "添加自定义维度";
  addButton.addEventListener("click", () => {
    formWrap.replaceChildren(renderCustomDimensionForm(context, itemId));
  });

  header.append(title, addButton);

  const list = document.createElement("div");
  list.className = "custom-dimension-list";
  (customDimensions || []).forEach((dimension) => {
    list.append(renderCustomDimensionCard(context, itemId, dimension));
  });

  const formWrap = document.createElement("div");
  formWrap.className = "custom-dimension-form-wrap";

  section.append(header, list, formWrap);
  return section;
}

function renderCustomDimensionCard(context, itemId, dimension) {
  const card = document.createElement("article");
  card.className = "custom-dimension-card";

  const header = document.createElement("div");
  header.className = "custom-card-header";

  const title = document.createElement("h3");
  title.textContent = dimension.title || "未命名维度";

  const actions = document.createElement("div");
  actions.className = "custom-card-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "inline-action-button";
  editButton.textContent = "编辑";
  editButton.addEventListener("click", () => {
    card.replaceChildren(renderCustomDimensionForm(context, itemId, dimension));
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "inline-action-button danger-inline";
  deleteButton.textContent = "删除";
  deleteButton.addEventListener("click", () => deleteCustomDimension(context, itemId, dimension.id));

  actions.append(editButton, deleteButton);
  header.append(title, actions);

  const fields = document.createElement("dl");
  fields.className = "analysis-fields";
  appendAnalysisField(fields, "判断", dimension.label);
  appendAnalysisField(fields, "画面依据", dimension.evidence);
  appendAnalysisField(fields, "视觉作用", dimension.function);

  card.append(header, fields);
  return card;
}

function renderCustomDimensionForm(context, itemId, dimension = null) {
  const form = document.createElement("form");
  form.className = "custom-dimension-form";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const data = {
      id: dimension && dimension.id ? dimension.id : createFavoriteId(),
      title: form.elements.title.value.trim(),
      label: form.elements.label.value.trim(),
      evidence: form.elements.evidence.value.trim(),
      function: form.elements.function.value.trim(),
      createdAt: dimension && dimension.createdAt ? dimension.createdAt : now,
      updatedAt: now
    };

    if (!data.title) {
      data.title = "未命名维度";
    }

    if (dimension) {
      await updateCustomDimension(context, itemId, data);
    } else {
      await addCustomDimension(context, itemId, data);
    }
  });

  form.append(
    createTextField("title", "维度名称", dimension && dimension.title),
    createTextField("label", "判断 / 结论", dimension && dimension.label),
    createTextField("evidence", "画面依据", dimension && dimension.evidence),
    createTextField("function", "视觉作用 / 可复用价值", dimension && dimension.function)
  );

  const actions = document.createElement("div");
  actions.className = "edit-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "primary-button compact-button";
  saveButton.textContent = "保存";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary-button compact-button";
  cancelButton.textContent = "取消";
  cancelButton.addEventListener("click", () => {
    if (context === "library") {
      const favorite = getSelectedFavorite();
      if (favorite) {
        renderFavoriteDetail(favorite);
      }
      return;
    }

    renderAnalysis(state.activeAnalysis);
  });

  actions.append(saveButton, cancelButton);
  form.append(actions);
  return form;
}

function createTextField(name, labelText, value = "") {
  const label = document.createElement("label");
  label.className = "edit-field";

  const labelName = document.createElement("span");
  labelName.textContent = labelText;

  const textarea = document.createElement("textarea");
  textarea.name = name;
  textarea.rows = name === "title" ? 2 : 3;
  textarea.value = value || "";

  label.append(labelName, textarea);
  return label;
}

async function addCustomDimension(context, itemId, dimension) {
  if (context === "library") {
    const item = await updateLibraryItem(itemId, (favorite) => ({
      ...favorite,
      custom_dimensions: [...(favorite.custom_dimensions || []), dimension],
      updatedAt: new Date().toISOString()
    }));
    renderFavoriteDetail(item);
    elements.libraryStatus.textContent = "补充分析已保存";
    return;
  }

  state.currentCustomDimensions = [...state.currentCustomDimensions, dimension];
  renderAnalysis(state.activeAnalysis);
  elements.analysisStatus.textContent = "补充分析已保存";
}

async function updateCustomDimension(context, itemId, dimension) {
  if (context === "library") {
    const item = await updateLibraryItem(itemId, (favorite) => ({
      ...favorite,
      custom_dimensions: (favorite.custom_dimensions || []).map((item) => item.id === dimension.id ? dimension : item),
      updatedAt: new Date().toISOString()
    }));
    renderFavoriteDetail(item);
    elements.libraryStatus.textContent = "补充分析已保存";
    return;
  }

  state.currentCustomDimensions = state.currentCustomDimensions.map((item) => item.id === dimension.id ? dimension : item);
  renderAnalysis(state.activeAnalysis);
  elements.analysisStatus.textContent = "补充分析已保存";
}

async function deleteCustomDimension(context, itemId, dimensionId) {
  if (!confirm("确认删除这条补充分析？")) {
    return;
  }

  if (context === "library") {
    const item = await updateLibraryItem(itemId, (favorite) => ({
      ...favorite,
      custom_dimensions: (favorite.custom_dimensions || []).filter((dimension) => dimension.id !== dimensionId),
      updatedAt: new Date().toISOString()
    }));
    renderFavoriteDetail(item);
    elements.libraryStatus.textContent = "补充分析已删除";
    return;
  }

  state.currentCustomDimensions = state.currentCustomDimensions.filter((dimension) => dimension.id !== dimensionId);
  renderAnalysis(state.activeAnalysis);
  elements.analysisStatus.textContent = "补充分析已删除";
}

function formatAnalysisValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${formatAnalysisValue(item)}`)
      .join(" | ");
  }

  return value || "-";
}

function buildBasicInfoItem(imageBasic) {
  return {
    label: `${imageBasic.orientation} · ${imageBasic.aspect_ratio}`,
    evidence: [
      `brightness: ${imageBasic.brightness}`,
      `contrast: ${imageBasic.contrast}`,
      `saturation: ${imageBasic.saturation}`,
      `density: ${imageBasic.visual_density}`,
      `colors: ${imageBasic.dominant_colors.join(", ")}`
    ].join(" | "),
    function: "Defines the image's basic visual conditions before cinematic and aesthetic interpretation."
  };
}

function buildCompositionItem(composition) {
  return {
    label: composition.labels.join(", "),
    evidence: [
      `subject: ${composition.subject_position}`,
      `focus: ${composition.visual_focus}`,
      `eye flow: ${composition.eye_flow}`
    ].join(" | "),
    function: composition.function
  };
}

function buildLightingItem(lighting) {
  return {
    label: lighting.lighting_style.join(", "),
    evidence: [
      `direction: ${lighting.key_light_direction}`,
      `quality: ${lighting.light_quality}`,
      `ratio: ${lighting.lighting_ratio}`,
      `shadow: ${lighting.shadow_behavior}`
    ].join(" | "),
    function: lighting.function
  };
}

function buildColorSystemItem(colorSystem) {
  return {
    label: `${colorSystem.temperature} · ${colorSystem.color_relationship}`,
    evidence: `palette: ${colorSystem.palette.join(", ")}`,
    function: colorSystem.function
  };
}

function buildSpatialLayersItem(spatialLayers) {
  return {
    label: spatialLayers.depth_strategy,
    evidence: [
      `foreground: ${spatialLayers.foreground}`,
      `midground: ${spatialLayers.midground}`,
      `background: ${spatialLayers.background}`
    ].join(" | "),
    function: spatialLayers.function
  };
}

function buildTextureItem(texture) {
  return {
    label: texture.materials.join(", "),
    evidence: texture.surface_response,
    function: texture.function
  };
}

function buildMoodItem(mood) {
  return {
    label: mood.labels.join(", "),
    evidence: mood.visual_causes,
    function: "Explains the emotional role created by visual structure, tone, color, and spatial cues."
  };
}

function buildAestheticValueItem(aestheticValue) {
  return {
    label: aestheticValue.core_value,
    evidence: [
      aestheticValue.why_it_works,
      `focus: ${aestheticValue.visual_focus}`,
      `score: ${aestheticValue.score}`
    ].join(" | "),
    function: [
      `Reusable: ${aestheticValue.reusable_elements.join(", ")}`,
      `Use for: ${aestheticValue.can_be_used_for.join(", ")}`
    ].join(" | ")
  };
}

function buildPromptItem(prompt) {
  return {
    label: state.settings.analysisLanguage === "en-US" ? "英文 Prompt" : "中文 Prompt",
    evidence: getPreferredPromptText(prompt),
    function: prompt.negative_prompt ? `反向提示词：${localizeNegativePrompt(prompt.negative_prompt)}` : "-"
  };
}

function buildTagsItem(tags) {
  return {
    label: localizeTags(tags).join(", "),
    evidence: "标签来自结构化分析结果，并已过滤 Unknown 这类占位值。",
    function: "用于素材搜索、筛选、复盘和后续导出。"
  };
}

async function saveFavorite() {
  if (!state.activeImage) {
    return;
  }

  elements.saveFavoriteButton.disabled = true;
  elements.saveStatus.textContent = "保存中...";

  try {
    const favorites = await getLibrary();
    const favorite = buildFavorite(state.activeImage, elements.noteInput.value, state.activeAnalysis);

    await setLibrary([favorite, ...favorites]);

    state.selectedFavoriteId = favorite.id;
    switchTab("library");
    elements.saveStatus.textContent = "已收藏到素材库。";
  } catch (error) {
    elements.saveStatus.textContent = `保存失败：${error.message}`;
  } finally {
    elements.saveFavoriteButton.disabled = false;
  }
}

function buildFavorite(image, note, analysis) {
  const now = new Date().toISOString();
  return {
    id: createFavoriteId(),
    image: {
      src: image.imageUrl,
      pageUrl: image.pageUrl,
      pageTitle: image.pageTitle,
      width: image.width,
      height: image.height,
      aspectRatio: image.aspectRatio || formatAspectRatio(image.width, image.height)
    },
    analysis: analysis || null,
    template: analysis && analysis.template ? analysis.template : getTemplateSummary(getSelectedTemplate()),
    user_edits: cloneDeep(state.currentUserEdits),
    custom_dimensions: cloneDeep(state.currentCustomDimensions),
    collectionIds: [DEFAULT_COLLECTION_ID],
    note: note.trim(),
    tags: normalizeItemTags(analysis && Array.isArray(analysis.tags) ? analysis.tags : buildTags(image)),
    savedAt: now,
    updatedAt: now
  };
}

function renderLibrary() {
  const visibleFavorites = getVisibleFavorites();

  elements.favoriteCount.textContent = String(state.favorites.length);
  updateSettingsLibraryCount();
  updateEmptyStates(visibleFavorites);
  elements.libraryNoResults.classList.add("is-hidden");
  elements.favoriteList.replaceChildren(...visibleFavorites.map(createFavoriteCard));
  renderBatchActionBar();

  if (visibleFavorites.length === 0) {
    state.selectedFavoriteId = null;
    elements.favoriteDetail.classList.add("is-hidden");
    return;
  }

  if (state.organizeMode) {
    elements.favoriteDetail.classList.add("is-hidden");
    updateSelectedCard();
    updateEmptyStates(visibleFavorites);
    return;
  }

  const selected = visibleFavorites.find((favorite) => favorite.id === state.selectedFavoriteId) || visibleFavorites[0];
  state.selectedFavoriteId = selected.id;
  updateSelectedCard();
  renderFavoriteDetail(selected);
  updateEmptyStates(visibleFavorites);
}

function createFavoriteCard(favorite) {
  const imageData = getFavoriteImage(favorite);
  const card = document.createElement("button");
  card.type = "button";
  card.className = "favorite-card";
  card.dataset.favoriteId = favorite.id;
  card.addEventListener("click", () => selectFavorite(favorite.id));

  if (state.organizeMode) {
    const checkboxWrap = document.createElement("span");
    checkboxWrap.className = "favorite-select-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedLibraryIds.has(favorite.id);
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleLibraryItemSelection(favorite.id, checkbox.checked);
    });
    checkboxWrap.append(checkbox);
    card.append(checkboxWrap);
  }

  const thumb = document.createElement("div");
  thumb.className = "favorite-thumb";

  const image = document.createElement("img");
  image.src = imageData.src;
  image.alt = imageData.pageTitle || favorite.title || "收藏图片";
  thumb.append(image);

  const body = document.createElement("div");
  body.className = "favorite-card-body";

  const title = document.createElement("p");
  title.className = "favorite-title";
  title.textContent = imageData.pageTitle || favorite.title || "Untitled page";

  const tags = document.createElement("div");
  tags.className = "tag-row";
  localizeTags(favorite.tags).slice(0, 2).forEach((tag) => tags.append(createTag(tag)));

  const meta = document.createElement("p");
  meta.className = "favorite-meta";
  meta.textContent = formatDateTime(favorite.savedAt || favorite.favoritedAt);

  body.append(title, tags, meta);
  card.append(thumb, body);
  return card;
}

function selectFavorite(favoriteId) {
  if (state.organizeMode) {
    const nextChecked = !state.selectedLibraryIds.has(favoriteId);
    toggleLibraryItemSelection(favoriteId, nextChecked);
    return;
  }

  const favorite = state.favorites.find((item) => item.id === favoriteId);
  if (!favorite) {
    return;
  }

  state.selectedFavoriteId = favorite.id;
  elements.libraryStatus.textContent = "";
  updateSelectedCard();
  renderFavoriteDetail(favorite);
}

function toggleOrganizeMode() {
  state.organizeMode = !state.organizeMode;
  if (!state.organizeMode) {
    state.selectedLibraryIds.clear();
  }
  renderLibrary();
}

function exitOrganizeMode() {
  state.organizeMode = false;
  state.selectedLibraryIds.clear();
  renderLibrary();
}

function toggleLibraryItemSelection(itemId, checked) {
  if (checked) {
    state.selectedLibraryIds.add(itemId);
  } else {
    state.selectedLibraryIds.delete(itemId);
  }
  renderBatchActionBar();
  updateSelectedCard();
}

function renderBatchActionBar() {
  elements.toggleOrganizeModeButton.textContent = state.organizeMode ? "退出整理模式" : "进入整理模式";
  elements.batchActionBar.classList.toggle("is-hidden", !state.organizeMode);
  elements.favoriteDetail.classList.toggle("is-hidden", state.organizeMode || !getSelectedFavorite());
  elements.batchSelectedCount.textContent = `已选择 ${state.selectedLibraryIds.size} 项`;
  renderBatchCollectionSelector();
}

async function batchMoveToCollection() {
  const selectedIds = Array.from(state.selectedLibraryIds);
  const collectionId = elements.batchCollectionSelect.value || DEFAULT_COLLECTION_ID;
  if (selectedIds.length === 0) {
    elements.libraryStatus.textContent = "请先选择素材。";
    return;
  }

  await setLibrary(state.favorites.map((item) => selectedIds.includes(item.id)
    ? { ...item, collectionIds: [collectionId], updatedAt: new Date().toISOString() }
    : item));
  elements.libraryStatus.textContent = `已移动 ${selectedIds.length} 条素材`;
  renderLibrary();
}

async function batchAddTag() {
  const selectedIds = Array.from(state.selectedLibraryIds);
  if (selectedIds.length === 0) {
    elements.libraryStatus.textContent = "请先选择素材。";
    return;
  }

  const tag = prompt("要添加的标签", "");
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag) {
    return;
  }

  await setLibrary(state.favorites.map((item) => selectedIds.includes(item.id)
    ? {
      ...item,
      tags: normalizeItemTags([...(item.tags || []), normalizedTag]),
      updatedAt: new Date().toISOString()
    }
    : item));
  elements.libraryStatus.textContent = `已为 ${selectedIds.length} 条素材添加标签`;
  renderLibrary();
}

async function batchDeleteSelected() {
  const selectedIds = Array.from(state.selectedLibraryIds);
  if (selectedIds.length === 0) {
    elements.libraryStatus.textContent = "请先选择素材。";
    return;
  }

  if (!confirm(`删除选中的 ${selectedIds.length} 条素材？`)) {
    return;
  }

  await setLibrary(state.favorites.filter((item) => !selectedIds.includes(item.id)));
  state.selectedLibraryIds.clear();
  state.selectedFavoriteId = getVisibleFavorites()[0] ? getVisibleFavorites()[0].id : null;
  elements.libraryStatus.textContent = `已删除 ${selectedIds.length} 条素材`;
  renderLibrary();
}

function updateSelectedCard() {
  Array.from(elements.favoriteList.children).forEach((card) => {
    const isSelected = state.organizeMode
      ? state.selectedLibraryIds.has(card.dataset.favoriteId)
      : card.dataset.favoriteId === state.selectedFavoriteId;
    card.classList.toggle("is-selected", isSelected);
    const checkbox = card.querySelector("input[type='checkbox']");
    if (checkbox) {
      checkbox.checked = state.selectedLibraryIds.has(card.dataset.favoriteId);
    }
  });
}

function renderFavoriteDetail(favorite) {
  const imageData = getFavoriteImage(favorite);
  elements.favoriteDetail.classList.remove("is-hidden");
  elements.detailImage.src = imageData.src;
  elements.detailImage.alt = imageData.pageTitle || favorite.title || "收藏素材预览";
  elements.detailTitle.textContent = imageData.pageTitle || favorite.title || "Untitled page";
  elements.detailRatio.textContent = imageData.aspectRatio || "Unknown";
  elements.detailTime.textContent = formatDateTime(favorite.savedAt || favorite.favoritedAt);
  setLink(elements.detailImageUrl, imageData.src);
  setLink(elements.detailPageUrl, imageData.pageUrl);
  elements.detailTags.replaceChildren(...localizeTags(favorite.tags).map(createTag));
  renderDetailCollections(favorite);
  elements.detailPrompt.textContent = getFinalPromptText(favorite) || buildPrompt(favorite);
  elements.detailNote.textContent = favorite.note || "未添加笔记。";
  renderFavoriteFullAnalysis(favorite);
}

function renderFavoriteFullAnalysis(favorite) {
  elements.detailFullAnalysis.replaceChildren();

  if (!favorite.analysis) {
    const notice = document.createElement("p");
    notice.className = "legacy-analysis-notice";
    notice.textContent = "这条素材没有完整分析数据，请重新分析后保存。";
    elements.detailFullAnalysis.append(
      notice,
      renderCustomDimensions("library", favorite.id, favorite.custom_dimensions || [])
    );
    return;
  }

  elements.detailFullAnalysis.append(renderFullAnalysisAccordion(favorite.analysis, {
    includeTags: true,
    context: "library",
    itemId: favorite.id,
    userEdits: favorite.user_edits || {},
    customDimensions: favorite.custom_dimensions || []
  }));
}

async function deleteSelectedFavorite() {
  const selected = getSelectedFavorite();
  if (!selected) {
    return;
  }

  const nextFavorites = state.favorites.filter((favorite) => favorite.id !== selected.id);
  const visibleAfterDelete = nextFavorites.filter(matchesLibraryFilters);
  state.selectedFavoriteId = visibleAfterDelete[0] ? visibleAfterDelete[0].id : nextFavorites[0] ? nextFavorites[0].id : null;
  await setLibrary(nextFavorites);
  elements.libraryStatus.textContent = nextFavorites.length > 0 ? "已删除收藏。" : "";
}

async function copySelectedField(field) {
  const selected = getSelectedFavorite();
  if (!selected) {
    return;
  }

  const latest = await getLatestLibraryItemById(selected.id);
  const value = field === "markdown" ? buildMarkdown(latest) : getFinalPromptText(latest) || buildPrompt(latest);
  try {
    await navigator.clipboard.writeText(value || "");
    elements.libraryStatus.textContent = field === "markdown" ? "Markdown 已复制。" : "Prompt 已复制。";
  } catch (error) {
    elements.libraryStatus.textContent = `复制失败：${error.message}`;
  }
}

async function copyFullJson(source) {
  try {
    const item = source === "analysis"
      ? buildCurrentAnalysisExportItem()
      : await getLatestLibraryItemById(state.selectedFavoriteId);

    if (!item) {
      throw new Error("No item to export.");
    }

    const data = buildFullJsonExport(item);
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    showCopyStatus(source, "完整 JSON 已复制，可用于文生图");
  } catch (error) {
    showCopyStatus(source, "复制失败，请重试");
  }
}

function buildCurrentAnalysisExportItem() {
  if (!state.activeImage || !state.activeAnalysis) {
    throw new Error("No current analysis to export.");
  }

  return {
    image: getFavoriteImage({
      image: {
        src: state.activeImage.imageUrl,
        pageUrl: state.activeImage.pageUrl,
        pageTitle: state.activeImage.pageTitle,
        width: state.activeImage.width,
        height: state.activeImage.height,
        aspectRatio: state.activeImage.aspectRatio || formatAspectRatio(state.activeImage.width, state.activeImage.height)
      }
    }),
    analysis: state.activeAnalysis,
    template: state.activeAnalysis.template || getTemplateSummary(getSelectedTemplate()),
    user_edits: state.currentUserEdits,
    custom_dimensions: state.currentCustomDimensions,
    tags: localizeTags(state.activeAnalysis.tags || []),
    note: elements.noteInput.value.trim()
  };
}

function buildFullJsonExport(item) {
  const imageData = getFavoriteImage(item);
  const finalAnalysis = buildFinalAnalysis(item.analysis || {}, item.user_edits || {});
  const prompt = normalizePrompt(finalAnalysis.prompt || item.prompt || {});
  const aestheticValue = finalAnalysis.aesthetic_value || {};
  const imageBasic = finalAnalysis.image_basic || {};
  const recommendedAspectRatio = imageData.aspectRatio || imageBasic.aspect_ratio || "";

  // 复制完整 JSON 的用途是创作复用，而不是调试审计。
  // 导出的 JSON 必须是用户编辑后的最终视觉分析结果，不导出 raw_analysis / user_edits / final_analysis 等内部编辑结构。
  return {
    template: normalizeTemplateSummary(item.template || finalAnalysis.template),
    image_reference: {
      source_page_title: imageData.pageTitle || "",
      source_page_url: imageData.pageUrl || "",
      image_url: imageData.src || "",
      width: Number(imageData.width) || 0,
      height: Number(imageData.height) || 0,
      aspect_ratio: recommendedAspectRatio,
      orientation: imageBasic.orientation || ""
    },
    visual_analysis: {
      image_basic: imageBasic,
      cinematic_analysis: finalAnalysis.cinematic_analysis || {},
      template_analysis: finalAnalysis.template_analysis || {},
      aesthetic_value: aestheticValue
    },
    custom_dimensions: normalizeExportCustomDimensions(item.custom_dimensions),
    generation_prompt: prompt,
    tags: Array.isArray(item.user_edits && item.user_edits.tags)
      ? localizeTags(finalAnalysis.tags || [])
      : Array.isArray(item.tags) && item.tags.length > 0
        ? localizeTags(item.tags)
        : localizeTags(finalAnalysis.tags || []),
    usage: {
      best_for: Array.isArray(aestheticValue.can_be_used_for) ? aestheticValue.can_be_used_for : [],
      recommended_aspect_ratio: recommendedAspectRatio,
      style_strength: getStyleStrength(aestheticValue.score),
      reference_value: Array.isArray(aestheticValue.reusable_elements) ? aestheticValue.reusable_elements.join("、") : ""
    },
    note: item.note || "",
    exportedAt: new Date().toISOString()
  };
}

async function exportFullBackup() {
  try {
    const library = filterExportItemsByScope(await getLibrary());
    downloadJsonFile(`aesthetic-lens-full-backup-${getDateStamp()}.json`, {
      app: "Aesthetic Lens",
      type: "full_backup",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      library
    });
    elements.settingsStatus.textContent = "完整备份 JSON 已导出。";
  } catch (error) {
    elements.settingsStatus.textContent = "导出失败，请重试";
  }
}

async function exportGenerationReadyLibrary() {
  try {
    const library = filterExportItemsByScope(await getLibrary());
    downloadJsonFile(`aesthetic-lens-generation-ready-${getDateStamp()}.json`, {
      app: "Aesthetic Lens",
      type: "generation_ready_library",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      items: library.map(buildFullJsonExport)
    });
    elements.settingsStatus.textContent = "创作 JSON 已导出。";
  } catch (error) {
    elements.settingsStatus.textContent = "导出失败，请重试";
  }
}

async function exportLibraryMarkdown() {
  try {
    const library = filterExportItemsByScope(await getLibrary());
    const markdown = [
      "# Aesthetic Lens 素材库",
      "",
      `导出时间：${new Date().toISOString()}`,
      "",
      ...library.map(buildLibraryMarkdownItem)
    ].join("\n");
    downloadTextFile(`aesthetic-lens-library-${getDateStamp()}.md`, markdown, "text/markdown;charset=utf-8");
    elements.settingsStatus.textContent = "Markdown 已导出。";
  } catch (error) {
    elements.settingsStatus.textContent = "导出失败，请重试";
  }
}

function buildLibraryMarkdownItem(item) {
  const exportData = buildFullJsonExport(item);
  const image = exportData.image_reference;
  const visual = exportData.visual_analysis;
  const cinematic = visual.cinematic_analysis || {};
  const aesthetic = visual.aesthetic_value || {};
  const title = image.source_page_title || "Untitled page";

  return [
    `# 视觉样本：${title}`,
    "",
    `![](${image.image_url})`,
    "",
    "## 来源",
    `- 页面：${image.source_page_title || ""}`,
    `- URL：${image.source_page_url || ""}`,
    `- 收藏时间：${item.savedAt || ""}`,
    "",
    "## 核心价值",
    aesthetic.core_value || "",
    "",
    "## 画面分析",
    "",
    "### 景别",
    formatExportAnalysisValue(cinematic.shot_size),
    "",
    "### 视角",
    formatExportAnalysisValue(cinematic.viewpoint),
    "",
    "### 构图",
    formatExportAnalysisValue(cinematic.composition),
    "",
    "### 光影",
    formatExportAnalysisValue(cinematic.lighting),
    "",
    "### 色彩系统",
    formatExportAnalysisValue(cinematic.color_system),
    "",
    "### 影调",
    formatExportAnalysisValue(cinematic.tone),
    "",
    "### 焦段感",
    formatExportAnalysisValue(cinematic.focal_length_feeling),
    "",
    "### 景深",
    formatExportAnalysisValue(cinematic.depth_of_field),
    "",
    "### 空间层次",
    formatExportAnalysisValue(cinematic.spatial_layers),
    "",
    "### 材质响应",
    formatExportAnalysisValue(cinematic.texture),
    "",
    "### 情绪功能",
    formatExportAnalysisValue(cinematic.mood),
    "",
    "## 我的补充分析",
    exportData.custom_dimensions.length > 0
      ? exportData.custom_dimensions.map((dimension) => [
        `### ${dimension.title}`,
        `- 判断：${dimension.label}`,
        `- 画面依据：${dimension.evidence}`,
        `- 视觉作用：${dimension.function}`
      ].join("\n")).join("\n\n")
      : "",
    "",
    "## Prompt",
    "",
    "### 中文 Prompt",
    exportData.generation_prompt.zh || "",
    "",
    "### English Prompt",
    exportData.generation_prompt.en || "",
    "",
    "### Negative Prompt",
    exportData.generation_prompt.negative_prompt || "",
    "",
    "## 标签",
    exportData.tags.join("、"),
    "",
    "---",
    ""
  ].join("\n");
}

function formatExportAnalysisValue(value) {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join("、");
  }

  if (typeof value === "object") {
    if ("label" in value || "evidence" in value || "function" in value) {
      return [
        value.label ? `判断：${formatExportAnalysisValue(value.label)}` : "",
        value.evidence ? `画面依据：${formatExportAnalysisValue(value.evidence)}` : "",
        value.function ? `视觉作用：${formatExportAnalysisValue(value.function)}` : ""
      ].filter(Boolean).join("\n");
    }

    return Object.entries(value)
      .map(([key, item]) => `- ${key}：${formatExportAnalysisValue(item)}`)
      .join("\n");
  }

  return String(value);
}

function downloadJsonFile(filename, data) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function filterExportItemsByScope(library) {
  const scope = elements.exportScopeSelect ? elements.exportScopeSelect.value : "all";
  if (scope === "all") {
    return library;
  }

  const collectionId = scope === "current"
    ? state.selectedCollectionId
    : elements.exportCollectionSelect && elements.exportCollectionSelect.value;

  if (!collectionId || collectionId === ALL_COLLECTIONS_ID) {
    return library;
  }

  return library.filter((item) => Array.isArray(item.collectionIds) && item.collectionIds.includes(collectionId));
}

async function handleLibraryImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";

  if (!file) {
    return;
  }

  const mode = elements.replaceImportInput.checked ? "replace" : "merge";
  await importFullBackup(file, mode);
}

async function importFullBackup(file, mode) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);

    if (!isValidFullBackup(payload)) {
      elements.settingsStatus.textContent = "导入失败：文件格式不正确";
      return;
    }

    const importedLibrary = prepareImportedLibrary(payload.library);
    const preview = previewImport(importedLibrary, await getLibrary());
    alert([
      "导入预览",
      `即将导入素材：${preview.total}`,
      `重复素材：${preview.duplicates}`,
      `新素材：${preview.newItems}`,
      `缺少完整分析：${preview.missingAnalysis}`,
      `新标签数量：${preview.newTags}`
    ].join("\n"));

    if (mode === "replace") {
      if (!confirm("这会清空当前素材库并使用导入文件替换，是否继续？")) {
        elements.settingsStatus.textContent = "已取消导入。";
        return;
      }

      await setLibrary(importedLibrary);
      renderLibrary();
      elements.settingsStatus.textContent = `导入完成，已替换为 ${importedLibrary.length} 条素材`;
      return;
    }

    const currentLibrary = await getLibrary();
    const mergedLibrary = mergeLibrary(currentLibrary, importedLibrary);
    const addedCount = Math.max(0, mergedLibrary.length - currentLibrary.length);
    await setLibrary(mergedLibrary);
    renderLibrary();
    elements.settingsStatus.textContent = `导入完成，新增 ${addedCount} 条素材`;
  } catch (error) {
    elements.settingsStatus.textContent = "导入失败：文件格式不正确";
  }
}

function isValidFullBackup(payload) {
  return Boolean(
    payload
    && payload.app === "Aesthetic Lens"
    && payload.type === "full_backup"
    && Array.isArray(payload.library)
  );
}

function prepareImportedLibrary(library) {
  const strategy = elements.importCollectionStrategySelect ? elements.importCollectionStrategySelect.value : "keep";
  const targetCollectionId = getImportTargetCollectionId(strategy);
  const knownCollectionIds = new Set(state.collections.map((collection) => collection.id));

  return normalizeFavorites(library).map((item) => {
    if (strategy === "keep" && Array.isArray(item.collectionIds) && item.collectionIds.length > 0) {
      const existingIds = item.collectionIds.filter((id) => knownCollectionIds.has(id));
      return normalizeLibraryItem({
        ...item,
        collectionIds: existingIds.length > 0 ? existingIds : [UNCATEGORIZED_COLLECTION_ID]
      });
    }

    return normalizeLibraryItem({
      ...item,
      collectionIds: [targetCollectionId]
    });
  });
}

function getImportTargetCollectionId(strategy) {
  if (strategy === "uncategorized") {
    return UNCATEGORIZED_COLLECTION_ID;
  }

  if (strategy === "current" && state.selectedCollectionId && state.selectedCollectionId !== ALL_COLLECTIONS_ID) {
    return state.selectedCollectionId;
  }

  return DEFAULT_COLLECTION_ID;
}

function previewImport(importedLibrary, currentLibrary) {
  const currentKeys = new Set();
  normalizeFavorites(currentLibrary).forEach((item) => {
    currentKeys.add(getLibraryDedupKey(item));
    currentKeys.add(getImageDedupKey(item));
  });
  const importedTags = new Set();
  const existingTags = new Set(normalizeFavorites(currentLibrary).flatMap((item) => item.tags || []));
  let duplicates = 0;
  let missingAnalysis = 0;

  normalizeFavorites(importedLibrary).forEach((item) => {
    if (currentKeys.has(getLibraryDedupKey(item)) || currentKeys.has(getImageDedupKey(item))) {
      duplicates += 1;
    }
    if (!item.analysis) {
      missingAnalysis += 1;
    }
    (item.tags || []).forEach((tag) => {
      if (!existingTags.has(tag)) {
        importedTags.add(tag);
      }
    });
  });

  return {
    total: importedLibrary.length,
    duplicates,
    newItems: Math.max(0, importedLibrary.length - duplicates),
    missingAnalysis,
    newTags: importedTags.size
  };
}

function mergeLibrary(currentLibrary, importedLibrary) {
  return dedupeLibrary([...normalizeFavorites(currentLibrary), ...normalizeFavorites(importedLibrary)]);
}

function dedupeLibrary(library) {
  const seen = new Set();
  const deduped = [];

  normalizeFavorites(library).forEach((item) => {
    const key = getLibraryDedupKey(item);
    const fallbackKey = getImageDedupKey(item);

    if (seen.has(key) || seen.has(fallbackKey)) {
      return;
    }

    seen.add(key);
    seen.add(fallbackKey);
    deduped.push(item);
  });

  return deduped;
}

function getLibraryDedupKey(item) {
  return item && item.id ? `id:${item.id}` : getImageDedupKey(item);
}

function getImageDedupKey(item) {
  const image = getFavoriteImage(item);
  return `image:${image.src || ""}|${image.pageUrl || ""}`;
}

function showCopyStatus(source, message) {
  if (source === "analysis") {
    elements.analysisStatus.textContent = message;
    return;
  }

  elements.libraryStatus.textContent = message;
}

async function getLibrary() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.FAVORITES);
  const library = normalizeFavorites(result[STORAGE_KEYS.FAVORITES]);
  state.favorites = library;
  updateSettingsLibraryCount();
  return library;
}

async function setLibrary(library) {
  const normalizedLibrary = normalizeFavorites(library);
  state.favorites = normalizedLibrary;
  await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: normalizedLibrary });
  updateSettingsLibraryCount();
}

async function updateLibraryItem(itemId, updater) {
  if (!itemId) {
    throw new Error("Missing library item id.");
  }

  const latestFavorites = await getLibrary();
  const nextFavorites = latestFavorites.map((favorite) => {
    if (favorite.id !== itemId) {
      return favorite;
    }

    return normalizeFavorites([updater(favorite)])[0];
  });
  const updatedItem = nextFavorites.find((favorite) => favorite.id === itemId);

  if (!updatedItem) {
    throw new Error("Library item not found.");
  }

  await setLibrary(nextFavorites);
  return updatedItem;
}

async function getLatestLibraryItemById(itemId) {
  const latestFavorites = await getLibrary();
  return latestFavorites.find((favorite) => favorite.id === itemId) || null;
}

function getSelectedFavorite() {
  return state.favorites.find((favorite) => favorite.id === state.selectedFavoriteId) || null;
}

function getVisibleFavorites() {
  return state.favorites.filter(matchesLibraryFilters);
}

function matchesLibraryFilters(favorite) {
  if (
    state.selectedCollectionId
    && state.selectedCollectionId !== ALL_COLLECTIONS_ID
    && (!Array.isArray(favorite.collectionIds) || !favorite.collectionIds.includes(state.selectedCollectionId))
  ) {
    return false;
  }

  if (state.analysisFilter === "analyzed" && !isAnalyzed(favorite)) {
    return false;
  }

  if (state.analysisFilter === "unanalyzed" && isAnalyzed(favorite)) {
    return false;
  }

  if (!state.searchQuery) {
    return true;
  }

  return getSearchText(favorite).includes(state.searchQuery);
}

function getSearchText(favorite) {
  const prompt = getPromptText(favorite);
  const imageData = getFavoriteImage(favorite);

  return [
    favorite.title,
    imageData.pageTitle,
    favorite.note,
    prompt,
    Array.isArray(favorite.tags) ? localizeTags(favorite.tags).join(" ") : ""
  ].join(" ").toLowerCase();
}

function isAnalyzed(favorite) {
  return Boolean(favorite.analysis || favorite.prompt);
}

function normalizeFavorites(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeLibraryItem);
}

function normalizeLibraryItem(favorite, index = 0) {
  const imageData = getFavoriteImage(favorite);
  const savedAt = favorite && (favorite.savedAt || favorite.favoritedAt) || new Date().toISOString();
  const sourceTags = favorite && Array.isArray(favorite.tags) && favorite.tags.length > 0
    ? favorite.tags
    : favorite && favorite.analysis && Array.isArray(favorite.analysis.tags)
      ? favorite.analysis.tags
      : buildTags(imageData);
  const collectionIds = favorite && Array.isArray(favorite.collectionIds) && favorite.collectionIds.length > 0
    ? favorite.collectionIds
    : [DEFAULT_COLLECTION_ID];

  return {
    ...(favorite || {}),
    id: favorite && favorite.id || `${imageData.src || "favorite"}-${savedAt || index}`,
    image: favorite && favorite.image || imageData,
    analysis: favorite && favorite.analysis || null,
    template: favorite && favorite.template || favorite && favorite.analysis && favorite.analysis.template || normalizeTemplateSummary(null),
    user_edits: favorite && favorite.user_edits && typeof favorite.user_edits === "object" ? favorite.user_edits : {},
    custom_dimensions: favorite && Array.isArray(favorite.custom_dimensions) ? favorite.custom_dimensions : [],
    collectionIds: [...new Set(collectionIds.filter(Boolean))],
    note: favorite && favorite.note || "",
    tags: normalizeItemTags(sourceTags),
    savedAt,
    updatedAt: favorite && favorite.updatedAt || savedAt
  };
}

function getFavoriteImage(favorite) {
  if (favorite && favorite.image) {
    return {
      src: favorite.image.src || favorite.image.imageUrl || "",
      pageUrl: favorite.image.pageUrl || "",
      pageTitle: favorite.image.pageTitle || "",
      width: favorite.image.width || 0,
      height: favorite.image.height || 0,
      aspectRatio: favorite.image.aspectRatio || formatAspectRatio(favorite.image.width, favorite.image.height)
    };
  }

  return {
    src: favorite && favorite.imageUrl ? favorite.imageUrl : "",
    pageUrl: favorite && favorite.pageUrl ? favorite.pageUrl : "",
    pageTitle: favorite && favorite.pageTitle ? favorite.pageTitle : "",
    width: favorite && favorite.width ? favorite.width : 0,
    height: favorite && favorite.height ? favorite.height : 0,
    aspectRatio: favorite && favorite.aspectRatio ? favorite.aspectRatio : formatAspectRatio(favorite && favorite.width, favorite && favorite.height)
  };
}

function localizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags
    .map(localizeTag)
    .filter(Boolean)
    .filter((tag) => tag !== "待判断"))];
}

function localizeTag(tag) {
  const value = String(tag || "").trim();
  if (!value) {
    return "";
  }

  const key = value.toLowerCase();
  if (TAG_LABELS_ZH[key]) {
    return TAG_LABELS_ZH[key];
  }

  if (/^[\d\s:./-]+$/.test(value)) {
    return value;
  }

  if (/^[a-z][a-z0-9\s_-]*$/i.test(value)) {
    return "视觉参考";
  }

  return value;
}

function localizeNegativePrompt(value) {
  return String(value || "")
    .split(",")
    .map((item) => {
      const key = item.trim().toLowerCase();
      return NEGATIVE_PROMPT_ZH[key] || item.trim();
    })
    .filter(Boolean)
    .join("、");
}

function createTag(tag) {
  const chip = document.createElement("span");
  chip.className = "tag-chip";
  chip.textContent = localizeTag(tag);
  return chip;
}

function getPromptText(item) {
  const prompt = item && item.analysis && item.analysis.prompt ? item.analysis.prompt : item && item.prompt;

  if (!prompt) {
    return "";
  }

  if (typeof prompt === "string") {
    return prompt;
  }

  return getPreferredPromptText(prompt);
}

function getFinalPromptText(item) {
  if (!item) {
    return "";
  }

  const finalAnalysis = buildFinalAnalysis(item.analysis || {}, item.user_edits || {});
  return getPreferredPromptText(finalAnalysis.prompt || item.prompt || {});
}

function getPreferredPromptText(prompt) {
  if (!prompt || typeof prompt !== "object") {
    return "";
  }

  if (state.settings.analysisLanguage === "en-US") {
    return prompt.en || prompt.zh || "";
  }

  return prompt.zh || prompt.en || "";
}

function buildMarkdown(item) {
  const imageData = getFavoriteImage(item);
  const title = imageData.pageTitle || item.title || "Untitled page";
  const finalAnalysis = buildFinalAnalysis(item.analysis || {}, item.user_edits || {});
  const prompt = getFinalPromptText(item) || buildPrompt(item);
  const tags = Array.isArray(item.tags) ? localizeTags(item.tags).map((tag) => `#${tag}`).join(" ") : "";
  const customDimensions = normalizeExportCustomDimensions(item.custom_dimensions);

  return [
    `![${title}](${imageData.src})`,
    "",
    `**Source:** [${title}](${imageData.pageUrl || imageData.src})`,
    `**画幅比例：** ${imageData.aspectRatio || "未知"}`,
    `**收藏时间：** ${formatDateTime(item.savedAt || item.favoritedAt)}`,
    tags ? `**标签：** ${tags}` : "",
    "",
    "```prompt",
    prompt,
    "```",
    "",
    "## 最终分析",
    finalAnalysis.aesthetic_value && finalAnalysis.aesthetic_value.core_value ? finalAnalysis.aesthetic_value.core_value : "",
    finalAnalysis.aesthetic_value && finalAnalysis.aesthetic_value.why_it_works ? finalAnalysis.aesthetic_value.why_it_works : "",
    customDimensions.length > 0 ? "\n## 我的补充分析" : "",
    ...customDimensions.map((dimension) => [
      `### ${dimension.title}`,
      `- 判断：${dimension.label}`,
      `- 画面依据：${dimension.evidence}`,
      `- 视觉作用：${dimension.function}`
    ].join("\n")),
    item.note ? `\n> ${item.note}` : ""
  ].filter(Boolean).join("\n");
}

function buildTags(item) {
  const imageData = getFavoriteImage(item);
  return localizeTags([
    getOrientation(imageData.width, imageData.height),
    imageData.aspectRatio || formatAspectRatio(imageData.width, imageData.height),
    "reference"
  ]);
}

function buildPrompt(item) {
  const imageData = getFavoriteImage(item);
  const orientation = getOrientation(imageData.width, imageData.height);
  const ratio = imageData.aspectRatio || formatAspectRatio(imageData.width, imageData.height);
  return `分析这张${orientation}图片，画幅比例为 ${ratio}。请描述构图、色彩情绪、视觉层级、设计风格和可复用的中文提示词方向。`;
}

function createFavoriteId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `favorite-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatImageSize(image) {
  if (!image.width || !image.height) {
    return "Unknown";
  }

  return `${image.width} x ${image.height}px`;
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getOrientation(width, height) {
  if (width > height) {
    return "横向";
  }

  if (height > width) {
    return "纵向";
  }

  return "方形";
}

function formatAspectRatio(width, height) {
  if (!width || !height) {
    return "Unknown";
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
