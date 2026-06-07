# Aesthetic Lens

Aesthetic Lens 是一个 Chrome Manifest V3 插件 MVP，用于扫描当前网页中的有效图片，在悬停时提供“分析”入口，并在 Chrome Side Panel 中展示图片信息、mock 分析结果和收藏能力。

## 功能

- 自动扫描当前网页中的 `img` 图片并缓存可分析对象。
- 使用 `MutationObserver` 监听动态加载图片。
- 过滤渲染尺寸或原始尺寸小于 `120px` 的图片。
- 在图片上右键，通过 Chrome 原生菜单选择“用 Aesthetic Lens 分析图片”。
- 选择菜单后打开 Chrome Side Panel。
- Side Panel 展示图片预览、图片尺寸、画幅比例、页面标题、页面 URL、图片 URL。
- Side Panel 提供“当前分析”和“素材库”两个 Tab。
- Side Panel 提供“设置”Tab，可视化配置 Mock/真实 AI、Provider、API Key、模型和分析语言。
- 素材库展示所有已收藏图片，支持查看详情、删除收藏、复制图片 URL、复制 prompt。
- 使用 `lib/aiAnalyzer.js` 提供 AI 图片分析接口层，`analyzeImage(imageInput)` 返回固定结构化 schema。
- 通过 `USE_MOCK_ANALYSIS` 控制 mock / 真实视觉分析模式。
- `USE_MOCK_ANALYSIS = false` 时会调用 `analyzeImageWithVision()`，把图片本身作为多模态输入发送给模型。
- Provider 支持 `openai`、`google` 和 `custom`。
- Google Gemini 模式会先读取图片 URL，将图片转为 `inline_data` 后调用 Gemini `generateContent`。
- AI 配置统一保存到 `chrome.storage.local.aestheticLensSettings`，不再需要通过 DevTools 控制台写入多个配置字段。
- API Key 保存在 `aestheticLensSettings.apiKey` 中，不写死在代码里。
- 如果远程模型无法读取图片 URL，会显示：“当前图片无法被远程模型读取，请使用截图分析模式。”
- 支持将当前图片收藏到 `chrome.storage.local`。
- 收藏字段包含图片 URL、页面 URL、页面标题、图片尺寸、画幅比例、用户笔记、标签、prompt、收藏时间。

## 项目结构

```text
.
├── manifest.json
├── background.js
├── content.js
├── content.css
├── sidepanel.html
├── sidepanel.js
├── sidepanel.css
└── README.md
```

## 在 Chrome 中加载插件

1. 打开 Chrome，进入 `chrome://extensions/`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目根目录：`C:\Users\vh5od\Documents\审美积累`。
5. 加载完成后，Chrome 工具栏会出现 Aesthetic Lens 扩展。

## 如何测试

1. 打开任意包含大图的网页。
2. 在宽高均不小于 `120px` 的图片上点击鼠标右键。
3. 选择“用 Aesthetic Lens 分析图片”。
4. 确认 Chrome 右侧 Side Panel 打开。
5. 检查 Side Panel 是否展示图片预览、尺寸、比例、页面信息。
6. 点击“开始分析”，确认页面展示 `image_basic`、`cinematic_analysis`、`aesthetic_value`、`prompt`、`tags`。
7. 在“用户笔记”中输入内容，点击“收藏当前图片”。
7. 切换到“素材库”，确认素材卡片展示缩略图、页面标题、画幅比例、收藏时间和标签。
8. 点击素材卡片，确认右侧详情展示完整信息。
9. 测试“复制图片 URL”“复制 prompt”和“删除”按钮。
10. 打开扩展页的 Service Worker 或 Side Panel DevTools，在控制台执行：

```js
chrome.storage.local.get("aestheticLensFavorites").then(console.log)
```

确认收藏数据已写入。

## 设置页测试

1. 在 Side Panel 顶部点击“设置”。
2. 确认默认配置为：Mock 分析、provider 为 `openai`、model 为 `gpt-4.1`、语言为 `zh-CN`。
3. 输入 API Key，点击“保存配置”，确认显示“设置已保存”。
4. 确认 API Key 输入框清空，提示显示为 `已保存：••••••••` 加后 4 位。
5. 点击“测试连接”：
   - Mock 模式显示“Mock 模式可用。”
   - 真实 AI 且未填写 API Key 显示“请先填写 API Key。”
   - 真实 AI 且已有 API Key 显示“配置已就绪，真实连接测试将在接入 API 后启用。”
6. 点击“清除 API Key”，确认提示变回“未保存 API Key”。

## 使用 Google Gemini

1. 打开 Side Panel 的“设置”Tab。
2. 选择“使用真实 AI 分析”。
3. Provider 选择 `google`。
4. API Key 填入 Google AI Studio / Gemini API key。
5. Model 可填写 `gemini-3.5-flash`。
6. 点击“保存配置”，回到“当前分析”执行分析。

## 当前未完成的功能

- 真实视觉分析入口已预留并可通过配置启用，但当前默认 `USE_MOCK_ANALYSIS` 为 `true`，方便开发测试。
- 截图分析模式尚未实现。
- 未实现素材库搜索、筛选、批量操作或导出。
- 未处理 CSS `background-image`、`picture/source` 以外的复杂媒体资产。
- 未做跨域图片像素读取，因此 mock 色彩分析不读取真实主色。
- 未添加扩展图标和发布用商店素材。

## 下一步开发建议

1. 抽离真实分析服务接口，例如 `analysisService.analyze(imageContext)`，让 `mockAnalysis` 和 AI API 共用同一返回结构。
2. 增加收藏列表页面，支持查看、编辑笔记、删除、按页面或标签筛选。
3. 使用 Canvas 或后端服务提取主色、亮度、对比度等基础视觉特征。
4. 支持框选页面图片、识别 `background-image` 和响应式 `picture` 资源。
5. 增加错误提示、加载态和 API 调用重试策略。
