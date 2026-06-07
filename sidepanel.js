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
  FAVORITES: "aestheticLensFavorites"
};

const ANALYSIS_SECTIONS = [
  { title: "基础信息", getItem: (analysis) => buildBasicInfoItem(analysis.image_basic) },
  { title: "景别", getItem: (analysis) => analysis.cinematic_analysis.shot_size },
  { title: "镜头角度", getItem: (analysis) => analysis.cinematic_analysis.camera_angle },
  { title: "观看视角", getItem: (analysis) => analysis.cinematic_analysis.viewpoint },
  { title: "构图", getItem: (analysis) => buildCompositionItem(analysis.cinematic_analysis.composition) },
  { title: "光影", getItem: (analysis) => buildLightingItem(analysis.cinematic_analysis.lighting) },
  { title: "色彩系统", getItem: (analysis) => buildColorSystemItem(analysis.cinematic_analysis.color_system) },
  { title: "影调", getItem: (analysis) => analysis.cinematic_analysis.tone },
  { title: "焦段感", getItem: (analysis) => analysis.cinematic_analysis.focal_length_feeling },
  { title: "景深", getItem: (analysis) => analysis.cinematic_analysis.depth_of_field },
  { title: "空间层次", getItem: (analysis) => buildSpatialLayersItem(analysis.cinematic_analysis.spatial_layers) },
  { title: "材质响应", getItem: (analysis) => buildTextureItem(analysis.cinematic_analysis.texture) },
  { title: "情绪功能", getItem: (analysis) => buildMoodItem(analysis.cinematic_analysis.mood) },
  { title: "审美价值", getItem: (analysis) => buildAestheticValueItem(analysis.aesthetic_value) },
  { title: "Prompt", getItem: (analysis) => buildPromptItem(analysis.prompt) },
  { title: "标签", getItem: (analysis) => buildTagsItem(analysis.tags) }
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

const state = {
  activeImage: null,
  activeAnalysis: null,
  favorites: [],
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
  analyzeButton: document.getElementById("analyzeButton"),
  analysisStatus: document.getElementById("analysisStatus"),
  analysisResult: document.getElementById("analysisResult"),
  copyAnalysisJsonButton: document.getElementById("copyAnalysisJsonButton"),
  noteInput: document.getElementById("noteInput"),
  saveFavoriteButton: document.getElementById("saveFavoriteButton"),
  saveStatus: document.getElementById("saveStatus"),
  favoriteCount: document.getElementById("favoriteCount"),
  librarySearchInput: document.getElementById("librarySearchInput"),
  filterButtons: Array.from(document.querySelectorAll(".filter-button")),
  libraryEmptyState: document.getElementById("libraryEmptyState"),
  libraryContent: document.getElementById("libraryContent"),
  libraryNoResults: document.getElementById("libraryNoResults"),
  favoriteList: document.getElementById("favoriteList"),
  favoriteDetail: document.getElementById("favoriteDetail"),
  detailImage: document.getElementById("detailImage"),
  detailTitle: document.getElementById("detailTitle"),
  deleteFavoriteButton: document.getElementById("deleteFavoriteButton"),
  detailRatio: document.getElementById("detailRatio"),
  detailTime: document.getElementById("detailTime"),
  detailImageUrl: document.getElementById("detailImageUrl"),
  detailPageUrl: document.getElementById("detailPageUrl"),
  detailTags: document.getElementById("detailTags"),
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
  settingsStatus: document.getElementById("settingsStatus")
};

init();

function init() {
  elements.analysisTab.addEventListener("click", () => switchTab("analysis"));
  elements.libraryTab.addEventListener("click", () => switchTab("library"));
  elements.settingsTab.addEventListener("click", () => switchTab("settings"));
  elements.librarySearchInput.addEventListener("input", handleLibrarySearch);
  elements.filterButtons.forEach((button) => {
    button.addEventListener("click", () => setAnalysisFilter(button.dataset.filter));
  });
  elements.analyzeButton.addEventListener("click", analyzeActiveImage);
  elements.copyAnalysisJsonButton.addEventListener("click", () => copyFullJson("analysis"));
  elements.saveFavoriteButton.addEventListener("click", saveFavorite);
  elements.deleteFavoriteButton.addEventListener("click", deleteSelectedFavorite);
  elements.copyPromptButton.addEventListener("click", () => copySelectedField("prompt"));
  elements.copyMarkdownButton.addEventListener("click", () => copySelectedField("markdown"));
  elements.copyDetailJsonButton.addEventListener("click", () => copyFullJson("library"));
  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.clearApiKeyButton.addEventListener("click", clearApiKey);
  elements.testConnectionButton.addEventListener("click", testConnection);
  elements.toggleApiKeyButton.addEventListener("click", toggleApiKeyVisibility);
  elements.providerSelect.addEventListener("change", handleProviderChange);
  chrome.storage.onChanged.addListener(handleStorageChange);
  loadSettings();
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
  const result = await chrome.storage.local.get(STORAGE_KEYS.FAVORITES);
  state.favorites = normalizeFavorites(result[STORAGE_KEYS.FAVORITES]);
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
  elements.favoriteDetail.classList.toggle("is-hidden", !hasFilteredLibrary || !getSelectedFavorite());
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
    const analysis = await analyzeImage(buildImageInput(state.activeImage));
    state.activeAnalysis = analysis;
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
  elements.analysisResult.replaceChildren(
    createCoreSummary(analysis),
    createFocusBreakdown(analysis),
    renderFullAnalysisAccordion(analysis)
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
  return [
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
  const wrapper = document.createElement("section");
  wrapper.className = "analysis-full-section";

  const title = document.createElement("h2");
  title.textContent = "完整分析";

  const list = document.createElement("div");
  list.className = "analysis-accordion-list";

  const sections = options.includeTags
    ? ANALYSIS_SECTIONS
    : ANALYSIS_SECTIONS.filter((section) => section.title !== "标签");

  sections.forEach((section) => {
    const item = section.getItem(analysis);
    list.append(createAccordionItem(section.title, item));
  });

  wrapper.append(title, list);
  return wrapper;
}

function createAccordionItem(title, analysisItem) {
  const details = document.createElement("details");
  details.className = "analysis-accordion-item";

  const summary = document.createElement("summary");
  summary.textContent = title;

  const content = createSchemaAnalysisItem(title, analysisItem);
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
    const result = await chrome.storage.local.get(STORAGE_KEYS.FAVORITES);
    const favorites = normalizeFavorites(result[STORAGE_KEYS.FAVORITES]);
    const favorite = buildFavorite(state.activeImage, elements.noteInput.value, state.activeAnalysis);

    await chrome.storage.local.set({
      [STORAGE_KEYS.FAVORITES]: [favorite, ...favorites]
    });

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
    note: note.trim(),
    tags: analysis && Array.isArray(analysis.tags) ? localizeTags(analysis.tags) : buildTags(image),
    savedAt: new Date().toISOString()
  };
}

function renderLibrary() {
  const visibleFavorites = getVisibleFavorites();

  elements.favoriteCount.textContent = String(state.favorites.length);
  updateEmptyStates(visibleFavorites);
  elements.libraryNoResults.classList.add("is-hidden");
  elements.favoriteList.replaceChildren(...visibleFavorites.map(createFavoriteCard));

  if (visibleFavorites.length === 0) {
    state.selectedFavoriteId = null;
    elements.favoriteDetail.classList.add("is-hidden");
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
  const favorite = state.favorites.find((item) => item.id === favoriteId);
  if (!favorite) {
    return;
  }

  state.selectedFavoriteId = favorite.id;
  elements.libraryStatus.textContent = "";
  updateSelectedCard();
  renderFavoriteDetail(favorite);
}

function updateSelectedCard() {
  Array.from(elements.favoriteList.children).forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.favoriteId === state.selectedFavoriteId);
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
  elements.detailPrompt.textContent = getPromptText(favorite) || buildPrompt(favorite);
  elements.detailNote.textContent = favorite.note || "未添加笔记。";
  renderFavoriteFullAnalysis(favorite);
}

function renderFavoriteFullAnalysis(favorite) {
  elements.detailFullAnalysis.replaceChildren();

  if (!favorite.analysis) {
    const notice = document.createElement("p");
    notice.className = "legacy-analysis-notice";
    notice.textContent = "这条素材没有完整分析数据，请重新分析后保存。";
    elements.detailFullAnalysis.append(notice);
    return;
  }

  elements.detailFullAnalysis.append(renderFullAnalysisAccordion(favorite.analysis, { includeTags: true }));
}

async function deleteSelectedFavorite() {
  const selected = getSelectedFavorite();
  if (!selected) {
    return;
  }

  const nextFavorites = state.favorites.filter((favorite) => favorite.id !== selected.id);
  const visibleAfterDelete = nextFavorites.filter(matchesLibraryFilters);
  state.selectedFavoriteId = visibleAfterDelete[0] ? visibleAfterDelete[0].id : nextFavorites[0] ? nextFavorites[0].id : null;
  await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: nextFavorites });
  elements.libraryStatus.textContent = nextFavorites.length > 0 ? "已删除收藏。" : "";
}

async function copySelectedField(field) {
  const selected = getSelectedFavorite();
  if (!selected) {
    return;
  }

  const value = field === "markdown" ? buildMarkdown(selected) : getPromptText(selected) || buildPrompt(selected);
  try {
    await navigator.clipboard.writeText(value || "");
    elements.libraryStatus.textContent = field === "markdown" ? "Markdown 已复制。" : "Prompt 已复制。";
  } catch (error) {
    elements.libraryStatus.textContent = `复制失败：${error.message}`;
  }
}

async function copyFullJson(source) {
  try {
    const data = buildFullJsonExport(source);
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    showCopyStatus(source, "完整 JSON 已复制");
  } catch (error) {
    showCopyStatus(source, "复制失败，请重试");
  }
}

function buildFullJsonExport(source) {
  if (source === "analysis") {
    if (!state.activeImage || !state.activeAnalysis) {
      throw new Error("No current analysis to export.");
    }

    return {
      image: state.activeImage,
      analysis: state.activeAnalysis,
      note: elements.noteInput.value.trim(),
      tags: localizeTags(state.activeAnalysis.tags || []),
      exportedAt: new Date().toISOString()
    };
  }

  const selected = getSelectedFavorite();
  if (!selected) {
    throw new Error("No selected library item to export.");
  }

  return selected;
}

function showCopyStatus(source, message) {
  if (source === "analysis") {
    elements.analysisStatus.textContent = message;
    return;
  }

  elements.libraryStatus.textContent = message;
}

function getSelectedFavorite() {
  return state.favorites.find((favorite) => favorite.id === state.selectedFavoriteId) || null;
}

function getVisibleFavorites() {
  return state.favorites.filter(matchesLibraryFilters);
}

function matchesLibraryFilters(favorite) {
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

  return value.map((favorite, index) => {
    const imageData = getFavoriteImage(favorite);
    return {
      ...favorite,
      id: favorite.id || `${imageData.src || "favorite"}-${favorite.savedAt || favorite.favoritedAt || index}`,
      image: favorite.image || imageData,
      tags: Array.isArray(favorite.tags) && favorite.tags.length > 0
        ? localizeTags(favorite.tags)
        : buildTags(imageData),
      savedAt: favorite.savedAt || favorite.favoritedAt || new Date().toISOString()
    };
  });
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
  const prompt = getPromptText(item) || buildPrompt(item);
  const tags = Array.isArray(item.tags) ? localizeTags(item.tags).map((tag) => `#${tag}`).join(" ") : "";

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
