# #config Command

> Load this file when `#config` command is invoked.

---

## Purpose

Interactive configuration management for framework settings.

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

| Key | Type | Values | Description |
|-----|------|--------|-------------|
| `system.language` | enum | en-US, zh-CN | Response language |
| `system.interaction_mode` | enum | auto, semi-auto, manual | Automation level |
| `system.confirm_before_generate` | bool | true, false | Ask before generating code |
| `system.confirm_before_save` | bool | true, false | Ask before saving files |
| `pattern.active` | enum | ddd, clean-architecture, frontend-react | Architecture pattern |
| `workspace.smart_loading.default_level` | enum | minimal, moderate, full | Context loading level |

---

## Interactive Menu

When user runs `#config` without arguments:

```markdown
## Configuration Manager

| # | Category | Current Settings |
|---|----------|------------------|
| 1 | System | Language: en-US, Mode: semi-auto |
| 2 | Output | Format: yaml, Emojis: off |
| 3 | Pattern | Active: ddd |
| 4 | Workspace | Context Level: minimal |
| 5 | Wizard | Start guided setup |
| 6 | Reset | Reset to defaults |

**Select (1-6):**
```

---

## Direct Set Flow

```
#config set system.language en-US

Preview change:
- system.language: zh-CN --> en-US

Apply this change? [Y/n]
```

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
