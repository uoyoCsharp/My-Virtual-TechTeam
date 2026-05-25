## Execution Flow

### Interactive Menu (Default)
1. Read current settings from `config.yaml`
2. Display configuration menu with categories and current values
3. Wait for user to select a category (1-4)
4. Show category detail view with editable settings
5. Apply changes after user confirmation

### Direct Set (`set {key} {value}`)
1. Validate key exists -- if not, show available keys
2. Validate value type -- if wrong, show expected type
3. Preview the change (old -> new)
4. Confirm the change with user
5. Apply and write `config.yaml`

### Guided Wizard (`wizard`)
1. Step 1: Interaction Language (chat replies, prompts)
2. Step 2: Document Output Language (artifacts, persisted markdown) -- defaults to interaction language; user can override
3. Step 3: Output Style (emojis, data format)
4. Step 4: Context Routing Threshold (`/mvt-manage-context add`)
5. Summary Preview -> User confirms -> Apply all changes

### Reset (`reset`)
1. Show all settings that will be reset
2. Confirm with user
3. Write default values to `config.yaml`

## Configuration Keys

### User Preferences

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `preferences.interaction_language` | enum | `en-US` | Language for interactive output: chat replies, prompts, tables (en-US, zh-CN) |
| `preferences.document_output_language` | enum | `en-US` | Language for persisted documents: artifacts, project-context.md, reports (en-US, zh-CN). Falls back to `interaction_language` if missing. |
| `preferences.output.no_emojis` | bool | `true` | Disable emojis in output |
| `preferences.output.data_format` | enum | `yaml` | Data output format (yaml, json) |
| `preferences.context_routing.relevance_threshold` | int | `70` | AI routing threshold for `/mvt-manage-context add` (0-100) |

**Legacy compatibility**: older installs may still have `preferences.language`. Run `mvtt update --migrate-config` to split it into the two fields above.

### Knowledge Management

#### View Knowledge
- List shared knowledge entries (from `registry.yaml` > `knowledge.shared`)
- List per-skill knowledge entries (from `registry.yaml` > `skills.*.knowledge`, grouped by skill)
- Show token estimates for each entry (read from knowledge manifest `token_estimate`)

#### Modify Knowledge
- Move knowledge between shared <-> per-skill
- Remove knowledge from loading list (does not delete files)
- Add existing knowledge files to shared or per-skill list
