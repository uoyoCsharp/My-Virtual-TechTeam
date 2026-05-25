### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:

**Language (two distinct fields)**:
- `preferences.interaction_language` → Use for interactive output: chat replies, prompts, status tables, decision rules shown to the user, anything that does NOT get persisted to a file.
- `preferences.document_output_language` → Use for persisted document output: artifact files (`workspace/artifacts/`), `project-context.md`, generated reports, and any other markdown the skill writes to disk.
- **Fallback rule**: if `document_output_language` is missing, fall back to `interaction_language`.
- **Legacy compatibility**: if neither field exists but the deprecated `preferences.language` is present, treat it as both `interaction_language` and `document_output_language`. Prompt the user to run `mvtt update --migrate-config` (this is also surfaced by `mvtt doctor`).

**Other preferences**:
- `preferences.output.no_emojis` → If true, never use emojis
- `preferences.output.data_format` → Use this format for data sections in artifacts
- `preferences.context_routing.relevance_threshold` → Used by `/mvt-manage-context add` for AI routing (default 70 if missing)
