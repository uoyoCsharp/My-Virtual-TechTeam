### Step 4: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce it for the whole session:

- `preferences.interaction_language`: language for chat, prompts, status lines, tables, and summaries.
- `preferences.document_output_language`: language for files written to disk.
- `preferences.output.no_emojis`: if true, never use emojis.
- `preferences.output.data_format`: format for artifact data sections.
- `preferences.context_routing.relevance_threshold`: AI routing threshold for `/mvt-manage-context add` (default 70).
