## Execution Flow

### Interactive Menu (Default)
1. Read current settings from `config.yaml`
2. Display configuration menu with categories and current values
3. Wait for user to select a category (1-5)
4. Show category detail view with editable settings
5. Apply changes after user confirmation

### Direct Set (`set {key} {value}`)
1. Validate key exists -- if not, show available keys
2. Validate value type -- if wrong, show expected type
3. Preview the change (old -> new)
4. Ask user to confirm
5. Apply and write `config.yaml`

### Guided Wizard (`wizard`)
1. Step 1: Language Preference
2. Step 2: Output Style (emojis, data format)
3. Step 3: Architecture Pattern
4. Summary Preview -> User confirms -> Apply all changes

### Reset (`reset`)
1. Show all settings that will be reset
2. Ask user confirmation
3. Write default values to `config.yaml`
