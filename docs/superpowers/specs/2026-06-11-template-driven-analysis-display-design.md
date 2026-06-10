# Template-Driven Analysis Display Design

## Goal

Aesthetic Lens should treat the selected analysis template as the display contract for the "完整分析" section. When a user analyzes with a preset or custom template, the report should show only the dimensions declared by that template, in that template's order. Preset template definitions should also move out of `sidepanel.js` into clearly maintained template files.

## Problems

Preset templates and field definitions are currently hardcoded inside `sidepanel.js`, mixed with UI, storage, library, and export logic. This makes preset maintenance difficult.

The current "完整分析" renderer always starts from the fixed `ANALYSIS_SECTIONS` list, then appends `template_analysis`. This means choosing a non-default template still shows unrelated base dimensions, such as focal length or depth of field, even when the selected template is for product ads or portrait analysis.

## Design

### Template Files

Create a dedicated template folder:

```text
lib/templates/
  templateFields.js
  presetTemplates.js
```

`templateFields.js` exports reusable field definitions. Each field includes:

```js
{
  key: "composition",
  label: "构图",
  source: "cinematic_analysis.composition",
  outputTarget: "base",
  type: "analysis_card",
  promptInstruction: "...",
  enabled: true,
  outputFields: ["label", "evidence", "function"]
}
```

`presetTemplates.js` exports built-in preset templates using field keys and order. It is the source of truth for preset composition:

- `cinematic_general`
- `portrait_analysis`
- `product_ad_analysis`
- `ai_reproduction_analysis`
- `video_storyboard_analysis`

### Field Targets

Template fields are split by `outputTarget`:

- `base`: maps to existing schema paths, such as `cinematic_analysis.composition`.
- `template_analysis`: custom extension fields, such as `styling`, `product_subject`, or `motion_potential`.

Base fields influence the model prompt and display their corresponding base schema data. They must not be duplicated inside `template_analysis`.

Extension fields are requested through `template_analysis` and displayed from `analysis.template_analysis[field.key]`.

### Report Rendering

Replace the fixed "完整分析" section list with a template-derived list:

1. Determine the template used by the analysis:
   - Prefer `analysis.template.id`.
   - Fall back to the currently selected template.
   - Fall back to `cinematic_general`.
2. Read that template's enabled fields in order.
3. For each field:
   - If `outputTarget === "base"`, display data from `field.source`.
   - If `outputTarget === "template_analysis"`, display data from `template_analysis[field.key]`.
4. Do not render base schema fields that are not declared by the active template.
5. Do not render template analysis keys that are not declared by the active template, except for legacy custom data with no matching template, which can be shown under a small "其他模板维度" fallback group.

### Current Analysis And Library Detail

Current analysis and saved library details use the same template-aware rendering function.

Saved favorites should keep their `template` summary. When rendering a saved item, use the saved template id so older items keep the report shape they were analyzed with.

### AI Request Shape

`aiAnalyzer.js` continues to receive the full selected template.

For response schema:

- Include only extension fields in `template_analysis`.
- Keep base fields inside the original schema.

For prompt:

- Pass both base fields and extension fields.
- Tell the model to apply base field instructions to base schema sections.
- Tell the model to output extension fields only under `template_analysis`.

### Export

`buildFullJsonExport()` keeps the same generation-ready structure, but `visual_analysis` should remain data-complete:

- `image_basic`
- `cinematic_analysis`
- `template_analysis`
- `aesthetic_value`

The export is not limited to visible UI sections, because downstream generation may still benefit from the full structured analysis. The visible report is template-filtered; the export remains complete.

## Alternatives Considered

### Keep All Templates In `sidepanel.js`

Fastest, but it keeps the maintenance problem. It also encourages future UI and template logic to stay tangled.

### Give Each Template Its Own Full JSON Schema

This would be clean in theory, but it would require deeper changes to schema validation, model prompts, exports, old favorites, and import compatibility. It is too large for the current project state.

### Recommended Approach

Use modular template definitions plus template-driven display. This solves the immediate confusion while keeping the existing analysis schema and storage model compatible.

## Acceptance Criteria

1. Preset template definitions are maintained outside `sidepanel.js`.
2. Selecting "商品广告分析" shows only that template's dimensions in "完整分析".
3. Selecting "人像写真分析" shows only that template's dimensions in "完整分析".
4. Base fields such as `composition` or `lighting` are not duplicated in `template_analysis`.
5. Saved library items render according to the template saved with that item.
6. Old favorites without template metadata still render using `cinematic_general`.
7. Copy/export JSON still includes `template` and `visual_analysis.template_analysis`.
8. Existing settings, library, collection, import/export, mock/real AI flows remain functional.

## Verification Plan

- Run `node --check sidepanel.js`.
- Run `node --check lib/aiAnalyzer.js`.
- Use a small Node mock to confirm product template response schema only requires extension keys under `template_analysis`.
- Manually inspect rendered template section selection logic with sample analysis objects.
