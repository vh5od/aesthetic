# Aesthetic Lens

Aesthetic Lens 是一个 Chrome Manifest V3 插件，用来把网页上的图片沉淀成可复用的审美素材。

它适合设计师、影像创作者、AI 图像/视频工作流使用：在浏览网页时右键选中图片，打开 Side Panel 查看图片信息、进行 AI 视觉分析、编辑分析结果、添加自己的补充维度，并把素材收藏到本地素材库。最终可以复制结构化 JSON，用于文生图、图生图、视频生成、Prompt 复用和审美参考管理。

## 核心用途

- 从网页中快速收集有参考价值的图片。
- 记录图片来源、尺寸、画幅比例和页面信息。
- 使用 Mock 或真实多模态 AI 生成结构化视觉分析。
- 按 schema 拆解景别、镜头角度、观看视角、构图、光影、色彩、影调、景深、空间层次、材质、情绪和审美价值。
- 手动编辑 AI 分析结果，不直接覆盖原始 AI 分析。
- 添加自定义分析维度，例如“造型分析”“品牌感”“动作姿态”“商业可用性”。
- 将素材保存到 `chrome.storage.local`。
- 导出编辑合并后的最终 JSON，作为创作复用输入。

## 当前功能

- Chrome Side Panel 三个 Tab：
  - 当前分析
  - 素材库
  - 设置
- 右键网页图片，选择 Aesthetic Lens 分析图片。
- 自动过滤小于 `120px` 的图片。
- 使用 `MutationObserver` 监听动态加载图片。
- 当前分析页展示：
  - 图片预览
  - 图片尺寸
  - 画幅比例
  - 页面标题
  - 页面 URL
  - 图片 URL
  - AI 分析结果
  - 用户笔记
- 素材库使用缩略图网格展示收藏素材。
- 素材详情支持：
  - 大图预览
  - 标签
  - Prompt
  - 笔记
  - 完整分析
  - 删除
  - 复制 Prompt
  - 复制 Markdown
  - 复制完整 JSON
- 设置页支持：
  - Mock / 真实 AI 分析切换
  - Provider 选择：`openai`、`google`、`custom`
  - API Key 本地保存
  - 模型名称配置
  - 分析语言配置
  - 自动保存分析结果开关
  - 调试信息开关

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
├── README.md
└── lib
    ├── aiAnalyzer.js
    └── AI_ANALYSIS_SCHEMA.json
```

## 在 Chrome 中加载插件

1. 打开 Chrome。
2. 进入 `chrome://extensions/`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择项目根目录：

```text
C:\Users\vh5od\Documents\审美积累
```

6. 加载后，Chrome 工具栏会出现 Aesthetic Lens 扩展。

更新代码后，需要回到 `chrome://extensions/`，点击该扩展卡片上的“重新加载”。

## 基本使用方法

1. 打开任意包含图片的网页。
2. 在图片上点击鼠标右键。
3. 选择“用 Aesthetic Lens 分析图片”。
4. Chrome 右侧会打开 Side Panel。
5. 在“当前分析”页查看图片预览和基础信息。
6. 点击“开始分析”生成 AI 分析结果。
7. 可在完整分析中编辑某个模块，例如构图、光影、Prompt。
8. 可添加“我的补充分析”维度。
9. 输入笔记后点击“收藏当前图片”。
10. 切换到“素材库”查看已收藏素材。

## AI 设置

打开 Side Panel 顶部的“设置”Tab。

默认配置为：

```json
{
  "useMockAnalysis": true,
  "provider": "openai",
  "apiKey": "",
  "model": "gpt-4.1",
  "analysisLanguage": "zh-CN",
  "autoSaveAnalysis": true,
  "showDebugInfo": false
}
```

### 使用 Mock 分析

Mock 分析适合开发和界面测试，不会调用真实 AI API。

1. 打开“设置”。
2. 选择“使用 Mock 分析”。
3. 保存配置。
4. 回到“当前分析”点击“开始分析”。

### 使用 Google Gemini

1. 打开“设置”。
2. 选择“使用真实 AI 分析”。
3. Provider 选择 `google`。
4. API Key 填入 Google AI Studio / Gemini API Key。
5. Model 可填写：

```text
gemini-3.5-flash
```

6. 点击“保存配置”。
7. 回到“当前分析”执行分析。

### 使用 OpenAI

1. 打开“设置”。
2. 选择“使用真实 AI 分析”。
3. Provider 选择 `openai`。
4. API Key 填入 OpenAI API Key。
5. Model 可填写：

```text
gpt-4.1
```

6. 保存后回到“当前分析”执行分析。

## API Key 与隐私

API Key 不会写死在代码中。

当前 API Key 保存在 Chrome 扩展本机存储：

```text
chrome.storage.local.aestheticLensSettings.apiKey
```

它不会被 Git 上传，也不会出现在项目源码里。

插件只会在你启用真实 AI 分析时，把 API Key 用于请求所选 AI 服务。项目的 `.gitignore` 已排除常见密钥文件：

```gitignore
.env
.env.*
*.key
*.pem
secrets/
```

## 收藏数据保存在哪里

收藏数据保存在 Chrome 扩展本地存储：

```text
chrome.storage.local.aestheticLensFavorites
```

当前不会把图片文件本身下载到本地。收藏里保存的是图片 URL、页面信息、分析结果、标签、笔记和收藏时间。

如果原图失效、网页限制访问或图片被删除，素材库中的图片预览可能无法加载。后续如果要做真正的离线素材库，建议将图片 Blob 存入 IndexedDB。

## 编辑完整分析

完整分析支持编辑以下模块：

- 基础信息
- 景别
- 镜头角度
- 观看视角
- 构图
- 光影
- 色彩系统
- 影调
- 焦段感
- 景深
- 空间层次
- 材质响应
- 情绪功能
- 审美价值
- Prompt
- 标签

点击模块右侧“编辑”后，可以修改字段内容。保存后：

- 不会直接覆盖原始 AI 分析 `analysis`。
- 修改内容保存到 `user_edits`。
- 页面展示会优先使用编辑后的最终版本。
- 素材库详情页中的编辑会直接写入 `chrome.storage.local`。

## 我的补充分析

在完整分析区域下方可以添加自定义维度。

每个自定义维度包含：

```json
{
  "title": "",
  "label": "",
  "evidence": "",
  "function": ""
}
```

适合补充 AI schema 中暂时没有覆盖的内容，例如：

- 造型分析
- 妆发分析
- 品牌感
- 广告可用性
- 动作姿态
- 视频镜头延展方向

## 复制完整 JSON

“复制完整 JSON”的用途不是调试，而是创作复用。

点击后导出的 JSON 是用户编辑合并后的最终结果，不会导出：

- `raw_analysis`
- `user_edits`
- `final_analysis`
- `debug`
- `mock`
- `internalState`
- `currentUserEdits`
- `currentCustomDimensions`

导出结构：

```json
{
  "image_reference": {
    "source_page_title": "",
    "source_page_url": "",
    "image_url": "",
    "width": 0,
    "height": 0,
    "aspect_ratio": "",
    "orientation": ""
  },
  "visual_analysis": {
    "image_basic": {},
    "cinematic_analysis": {},
    "aesthetic_value": {}
  },
  "custom_dimensions": [],
  "generation_prompt": {
    "zh": "",
    "en": "",
    "negative_prompt": ""
  },
  "tags": [],
  "usage": {
    "best_for": [],
    "recommended_aspect_ratio": "",
    "style_strength": "",
    "reference_value": ""
  },
  "note": "",
  "exportedAt": ""
}
```

这个 JSON 可以用于：

- 文生图
- 图生图
- 视频生成
- Prompt 复用
- 审美素材整理
- 后续训练素材标注

## 如何测试

### 测试当前分析

1. 在网页图片上右键。
2. 选择“用 Aesthetic Lens 分析图片”。
3. 确认 Side Panel 打开。
4. 点击“开始分析”。
5. 确认出现核心价值、重点拆解和完整分析。

### 测试编辑分析

1. 展开“完整分析”。
2. 找到“构图”模块。
3. 点击“编辑”。
4. 修改字段并保存。
5. 确认模块右侧出现“已编辑”。
6. 点击“复制完整 JSON”。
7. 粘贴 JSON，确认：

```text
visual_analysis.cinematic_analysis.composition
```

是编辑后的内容。

### 测试自定义维度

1. 在“我的补充分析”中点击“添加自定义维度”。
2. 添加“造型分析”。
3. 填写判断、画面依据和视觉作用。
4. 保存后点击“复制完整 JSON”。
5. 确认 `custom_dimensions` 中包含“造型分析”。

### 测试素材库

1. 分析图片后点击“收藏当前图片”。
2. 切换到“素材库”。
3. 点击素材卡片。
4. 在详情页编辑“光影”或 Prompt。
5. 点击“复制完整 JSON”。
6. 确认导出的是最新编辑后的结果。

## 当前限制

- 当前收藏保存的是图片 URL，不是图片文件本身。
- 当前分析页的编辑在收藏前只保存在 Side Panel 内存中，刷新面板会丢失。
- 截图分析模式尚未实现。
- 图片 URL 如果被跨域、防盗链或平台限制，真实模型可能无法读取。
- 编辑表单是通用结构化表单，还不是每个分析维度的专用表单。
- 暂未实现批量导出、批量标签、素材分组和云同步。

## 后续开发建议

1. 使用 IndexedDB 保存图片 Blob，支持离线素材库。
2. 增加截图分析模式，解决远程模型无法读取图片 URL 的问题。
3. 为构图、光影、色彩、Prompt 等模块设计专用编辑表单。
4. 增加素材批量导出 JSON / Markdown / CSV。
5. 增加标签管理、素材分组和搜索语法。
6. 支持将完整 JSON 直接发送到文生图或视频生成工作流。
