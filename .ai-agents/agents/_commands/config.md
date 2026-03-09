# #config Command

> Load this file when `#config` command is invoked.

---

## Purpose

Interactive configuration management for framework settings. Provides guided setup for common settings and validates changes before applying.

### Variants

| Variant | Description |
|---------|-------------|
| `#config` | Show configuration menu |
| `#config show` | Display current configuration |
| `#config set {key} {value}` | Set specific value |
| `#config wizard` | Guided setup wizard |
| `#config reset` | Reset to defaults |

---

## Configuration Keys

### System Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `system.default_agent` | string | `conductor` | Default agent on startup |
| `system.language` | enum | `en-US` | Response language (en-US, zh-CN) |
| `system.interaction_mode` | enum | `semi-auto` | Automation level (auto, semi-auto, manual) |
| `system.confirm_before_generate` | bool | `true` | Ask before generating code |
| `system.confirm_before_save` | bool | `true` | Ask before saving files |

### Output Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `output.no_emojis` | bool | `true` | Disable emojis in output |
| `output.flow_charts.use_mermaid` | bool | `true` | Use Mermaid for diagrams |
| `output.data_format` | enum | `yaml` | Default data format (yaml, json) |
| `output.max_description` | int | `500` | Max description length |

### Pattern Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `pattern.active` | enum | `ddd` | Active architecture pattern (ddd, clean-architecture, frontend-react) |

---

## Execution Flow

### Interactive Menu (Default)

When user runs `#config` without arguments:

```markdown
## Configuration Manager

| # | Category | Current Settings |
|---|----------|------------------|
| 1 | System | Language: en-US, Mode: semi-auto |
| 2 | Output | Format: yaml, Emojis: off |
| 3 | Pattern | Active: ddd |
| 4 | Wizard | Start guided setup |
| 5 | Reset | Reset to defaults |

**Select (1-5):**
```

When user selects a category, show the category detail view:

```markdown
## System Settings

| # | Setting | Current | Options |
|---|---------|---------|---------|
| 1 | Language | `en-US` | zh-CN, en-US |
| 2 | Interaction Mode | `semi-auto` | auto, semi-auto, manual |
| 3 | Confirm Before Generate | `true` | true, false |
| 4 | Confirm Before Save | `true` | true, false |
| 5 | Default Agent | `conductor` | conductor, analyst, ... |

**Select a setting to modify (1-5), or reply `back` to return:**
```

### Direct Set

When user runs `#config set {key} {value}`:

1. Validate key exists — if not, show available keys and exit
2. Validate value type — if wrong type, show expected type and exit
3. Preview the change (old → new)
4. Ask user to confirm
5. Apply and write `config.yaml`

### Guided Wizard

When user runs `#config wizard`:

1. Step 1: Language Preference
2. Step 2: Interaction Mode
3. Step 3: Output Style
4. Step 4: Architecture Pattern
5. Summary Preview → User confirms → Apply all changes

---

## Example

```
User: #config set pattern.active clean-architecture

[Conductor Mode]

Preview change:
- pattern.active: ddd --> clean-architecture

This will change the architecture pattern for future operations.

Apply this change? [Y/n]

User: Y

Configuration updated. Changes take effect immediately.

---
**Suggested Next Steps**:
- `#config show` to verify changes
- `#init --refresh` to re-analyze with new pattern
```
