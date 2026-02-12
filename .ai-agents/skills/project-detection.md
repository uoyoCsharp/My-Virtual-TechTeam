# Project Detection Skill

Detect project structure, technology stack, and conventions.

## Usage

This skill is invoked by: **Conductor**

## Capabilities

### Tech Stack Detection
- Identify programming language(s)
- Detect frameworks in use
- Identify build tools

### Structure Analysis
- Map project directories
- Identify key files
- Detect configuration patterns

### Convention Detection
- Identify naming conventions
- Detect code style
- Find existing patterns

## Execution

When invoked, perform these steps:

1. **Scan Root**: Look for configuration files
2. **Identify Language**: Detect primary language(s)
3. **Detect Framework**: Identify frameworks in use
4. **Map Structure**: Understand directory organization
5. **Find Conventions**: Detect existing patterns
6. **Report Findings**: Summarize project profile

## Detection Indicators

### Language Detection
| Indicator Files | Language |
|----------------|----------|
| `package.json` | JavaScript/TypeScript |
| `*.csproj`, `*.sln` | C# |
| `pom.xml`, `build.gradle` | Java |
| `requirements.txt`, `pyproject.toml` | Python |
| `go.mod` | Go |
| `Cargo.toml` | Rust |

### Framework Detection
| Indicator | Framework |
|-----------|-----------|
| `next.config.*` | Next.js |
| `angular.json` | Angular |
| `vite.config.*` | Vite |
| `Startup.cs` | ASP.NET Core |
| `manage.py` | Django |
| `main.go` with gin/echo imports | Gin/Echo |

### Architecture Pattern Detection
| Indicator | Pattern |
|-----------|---------|
| `Domain/`, `Application/`, `Infrastructure/` | Clean Architecture |
| `Entities/`, `ValueObjects/`, `Aggregates/` | DDD |
| `Controllers/`, `Services/`, `Repositories/` | Layered |

## Output Format

```markdown
## 项目检测结果

### 技术栈
- 语言: [Language(s)]
- 框架: [Framework(s)]
- 构建工具: [Build tool]

### 目录结构
\`\`\`
project/
├── [dir1]/
├── [dir2]/
└── ...
\`\`\`

### 检测到的模式
- 架构模式: [Pattern]
- 命名约定: [Convention]

### 建议
- [Suggestions based on detection]
```
