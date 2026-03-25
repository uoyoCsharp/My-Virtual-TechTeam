#!/usr/bin/env python3
"""
AI Agent Framework - Update Script

Handles version checking, atomic updates, backup, and rollback for the
AI Agent Framework. Outputs structured JSON for the AI layer to parse.

Zero external dependencies. Requires Python 3.7+.
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen, Request

# ── Constants ─────────────────────────────────────────────────

REPO_OWNER = "uoyoCsharp"
REPO_NAME = "My-Virtual-TechTeam"
BRANCH = "main"

RAW_BASE = f"https://raw.githubusercontent.com/{REPO_OWNER}/{REPO_NAME}/{BRANCH}/"
TREE_API = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/git/trees/{BRANCH}?recursive=1"

PROTECTED_PATHS = [
    "workspace/",
    "knowledge/principle/",
    "knowledge/project/",
]

# Top-level keys in config.yaml that belong to the user and must NOT be overwritten
CONFIG_USER_KEYS = {"system", "output", "pattern", "knowledge"}

BACKUP_DIR_NAME = ".backup"
MAX_BACKUPS = 5
HTTP_TIMEOUT = 30

PLATFORM_CONFIG = {
    "claude_code": {
        "indicators": ["CLAUDE.md"],
    },
    "github_copilot": {
        "indicators": [".github/agents"],
    },
}

# Files/directories within .ai-agents/ that should NOT be backed up or overwritten
INTERNAL_SKIP = {BACKUP_DIR_NAME, "scripts"}


# ── Output Helpers ────────────────────────────────────────────

def output_json(status, action, data=None, error=None):
    """Print structured JSON to stdout and exit."""
    result = {"status": status, "action": action}
    if data is not None:
        result["data"] = data
    if error is not None:
        result["error"] = error
    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0 if status == "success" else 1)


# ── Utility Functions ─────────────────────────────────────────

def find_project_root():
    """Locate the project root (directory containing .ai-agents/)."""
    # If the script lives at .ai-agents/scripts/update_framework.py
    script_dir = Path(__file__).resolve().parent
    if script_dir.name == "scripts" and script_dir.parent.name == ".ai-agents":
        return script_dir.parent.parent

    # Walk up from cwd
    current = Path.cwd().resolve()
    while current != current.parent:
        if (current / ".ai-agents").is_dir():
            return current
        current = current.parent

    return Path.cwd().resolve()


def fetch_url(url):
    """Fetch a URL and return the decoded text content."""
    req = Request(url, headers={"User-Agent": "AI-Agent-Framework-Updater/1.0"})
    try:
        resp = urlopen(req, timeout=HTTP_TIMEOUT)
        return resp.read().decode("utf-8")
    except HTTPError as e:
        if e.code == 403 and "rate limit" in str(e.read()).lower():
            raise RuntimeError("GITHUB_RATE_LIMIT") from e
        raise
    except URLError as e:
        raise RuntimeError(f"NETWORK_ERROR: {e.reason}") from e


def parse_yaml_version(content):
    """
    Extract the version field from registry.yaml content.

    Supports:
        version: "1.2"
        version: '1.2'
        version: 1.2
    """
    match = re.search(r'^version:\s*["\']?([^"\'\n]+)["\']?', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    raise ValueError("Cannot find 'version' field in registry.yaml")


def compare_versions(local_ver, remote_ver):
    """
    Semantically compare two version strings.

    Returns one of: "update_available", "up_to_date", "development_mode"
    """
    def parse(v):
        return tuple(int(x) for x in v.strip().split("."))
    try:
        local = parse(local_ver)
        remote = parse(remote_ver)
    except (ValueError, AttributeError) as e:
        raise ValueError(f"VERSION_PARSE_ERROR: cannot parse '{local_ver}' or '{remote_ver}'") from e

    if remote > local:
        return "update_available"
    elif remote == local:
        return "up_to_date"
    else:
        return "development_mode"


def is_protected(rel_path):
    """Check if a path falls within a protected directory."""
    normalized = rel_path.replace("\\", "/")
    # Strip leading .ai-agents/ prefix for matching
    if normalized.startswith(".ai-agents/"):
        normalized = normalized[len(".ai-agents/"):]
    return any(normalized.startswith(p) for p in PROTECTED_PATHS)


def detect_platforms(project_root):
    """Detect which AI platforms are configured in the project."""
    platforms = []
    for platform_id, config in PLATFORM_CONFIG.items():
        for indicator in config["indicators"]:
            check_path = project_root / indicator
            if check_path.exists():
                platforms.append(platform_id)
                break
    return platforms


def fetch_remote_registry():
    """Fetch and return the remote registry.yaml content."""
    url = RAW_BASE + ".ai-agents/registry.yaml"
    return fetch_url(url)


def get_remote_file_tree():
    """Get the full file tree from the GitHub repository."""
    raw = fetch_url(TREE_API)
    tree = json.loads(raw)
    return [
        item["path"]
        for item in tree.get("tree", [])
        if item["type"] == "blob"
    ]


def categorize_files(file_list):
    """Group remote files into logical categories."""
    categories = {
        "core": [],
        "agents": [],
        "commands": [],
        "skills": [],
        "knowledge_core": [],
        "knowledge_patterns": [],
        "workflows": [],
        "platform_claude": [],
        "platform_copilot": [],
        "docs": [],
        "scripts": [],
        "other": [],
    }

    for f in file_list:
        if f.startswith(".ai-agents/agents/_commands/"):
            categories["commands"].append(f)
        elif f.startswith(".ai-agents/agents/"):
            categories["agents"].append(f)
        elif f.startswith(".ai-agents/skills/"):
            categories["skills"].append(f)
        elif f.startswith(".ai-agents/knowledge/core/"):
            categories["knowledge_core"].append(f)
        elif f.startswith(".ai-agents/knowledge/patterns/"):
            categories["knowledge_patterns"].append(f)
        elif f.startswith(".ai-agents/workflows/"):
            categories["workflows"].append(f)
        elif f.startswith(".ai-agents/docs/"):
            categories["docs"].append(f)
        elif f.startswith(".ai-agents/scripts/"):
            categories["scripts"].append(f)
        elif f.startswith(".ai-agents/") and "/" not in f[len(".ai-agents/"):]:
            # Top-level .ai-agents files (FRAMEWORK.md, registry.yaml, etc.)
            categories["core"].append(f)
        elif f == "CLAUDE.md":
            categories["platform_claude"].append(f)
        elif f.startswith(".github/"):
            categories["platform_copilot"].append(f)
        else:
            categories["other"].append(f)

    # Remove empty categories
    return {k: v for k, v in categories.items() if v}


def should_download(file_path):
    """Determine if a file should be downloaded during update."""
    # Download .ai-agents/ files (framework core)
    if file_path.startswith(".ai-agents/"):
        # Skip backup directory entries
        if f".ai-agents/{BACKUP_DIR_NAME}/" in file_path:
            return False
        # Skip workspace and protected knowledge (will not overwrite anyway)
        if is_protected(file_path):
            return False
        return True

    # Download platform adapter files
    if file_path == "CLAUDE.md":
        return True
    if file_path.startswith(".github/agents/"):
        return True

    return False


# ── Backup Functions ──────────────────────────────────────────

def create_backup(project_root):
    """Create a timestamped backup of the .ai-agents directory and platform adapters."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    ai_dir = project_root / ".ai-agents"
    backup_root = ai_dir / BACKUP_DIR_NAME
    backup_path = backup_root / timestamp
    backup_path.mkdir(parents=True, exist_ok=True)

    # Backup .ai-agents/ contents (skip .backup and scripts)
    for item in ai_dir.iterdir():
        if item.name in (BACKUP_DIR_NAME,):
            continue
        dest = backup_path / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    # Backup platform adapter files
    platforms = detect_platforms(project_root)
    platform_backup_dir = backup_path / "_platform_adapters"
    for pid in platforms:
        if pid == "claude_code":
            src = project_root / "CLAUDE.md"
            if src.exists():
                dest = platform_backup_dir / "claude_code"
                dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest / "CLAUDE.md")
        elif pid == "github_copilot":
            src_dir = project_root / ".github" / "agents"
            if src_dir.is_dir():
                dest = platform_backup_dir / "github_copilot" / ".github" / "agents"
                shutil.copytree(src_dir, dest)

    # Clean up old backups beyond MAX_BACKUPS
    cleanup_old_backups(backup_root)

    return str(backup_path)


def cleanup_old_backups(backup_root):
    """Remove oldest backups if count exceeds MAX_BACKUPS."""
    if not backup_root.exists():
        return
    backups = sorted(
        [d for d in backup_root.iterdir() if d.is_dir()],
        key=lambda d: d.name,
        reverse=True,
    )
    for old in backups[MAX_BACKUPS:]:
        shutil.rmtree(old, ignore_errors=True)


def restore_backup(backup_path, project_root):
    """Restore framework files from a backup directory."""
    backup_path = Path(backup_path)
    ai_dir = project_root / ".ai-agents"

    # Restore .ai-agents/ contents
    for item in backup_path.iterdir():
        if item.name == "_platform_adapters":
            continue
        dest = ai_dir / item.name
        if dest.exists():
            if dest.is_dir():
                shutil.rmtree(dest)
            else:
                dest.unlink()
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    # Restore platform adapters
    platform_dir = backup_path / "_platform_adapters"
    if platform_dir.exists():
        for pid_dir in platform_dir.iterdir():
            if pid_dir.name == "claude_code":
                src = pid_dir / "CLAUDE.md"
                if src.exists():
                    shutil.copy2(src, project_root / "CLAUDE.md")
            elif pid_dir.name == "github_copilot":
                for item in pid_dir.rglob("*"):
                    if item.is_dir():
                        continue
                    rel = item.relative_to(pid_dir)
                    dest = project_root / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(item, dest)


def list_backups(project_root):
    """List all available backups with metadata."""
    backup_root = project_root / ".ai-agents" / BACKUP_DIR_NAME
    if not backup_root.exists():
        return []

    backups = []
    for d in sorted(backup_root.iterdir(), key=lambda x: x.name, reverse=True):
        if not d.is_dir():
            continue
        # Try to read version from backed-up registry.yaml
        version = "unknown"
        reg_file = d / "registry.yaml"
        if reg_file.exists():
            try:
                version = parse_yaml_version(reg_file.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                pass

        file_count = sum(1 for _ in d.rglob("*") if _.is_file())
        backups.append({
            "timestamp": d.name,
            "path": str(d.relative_to(project_root)),
            "version": version,
            "file_count": file_count,
        })
    return backups


# ── Download & Update Functions ───────────────────────────────

def download_framework(file_list, temp_dir):
    """Download framework files from GitHub to a temporary directory."""
    downloaded = []
    failed = []
    for file_path in file_list:
        url = RAW_BASE + file_path
        try:
            content = fetch_url(url)
            dest = Path(temp_dir) / file_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")
            downloaded.append(file_path)
        except Exception as e:
            failed.append({"file": file_path, "error": str(e)})
    return downloaded, failed


def compute_file_hash(filepath):
    """Compute SHA256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _split_yaml_sections(text):
    """
    Split a YAML file into top-level sections.

    Returns a list of (key, raw_text) tuples where *key* is the top-level
    YAML key (e.g. "system") and *raw_text* is the full text of that section
    including the key line and all indented lines below it.

    Lines before the first top-level key (comments / blank lines) are returned
    with key=None.
    """
    sections = []
    current_key = None
    current_lines = []

    for line in text.splitlines(True):
        # A top-level key: starts at column 0, is not a comment, contains ':'
        stripped = line.rstrip()
        if stripped and not stripped.startswith("#") and not stripped[0].isspace() and ":" in stripped:
            # Flush previous section
            if current_lines:
                sections.append((current_key, "".join(current_lines)))
            current_key = stripped.split(":")[0].strip()
            current_lines = [line]
        else:
            current_lines.append(line)

    if current_lines:
        sections.append((current_key, "".join(current_lines)))

    return sections


def merge_config_yaml(local_text, remote_text):
    """
    Merge remote config.yaml with local config.yaml, preserving user-owned
    sections (CONFIG_USER_KEYS) from the local file while taking everything
    else from the remote file.

    If a new top-level key exists only in the remote version, it is added.
    If a user-owned key exists only in the local version, it is preserved.
    """
    local_sections = _split_yaml_sections(local_text)
    remote_sections = _split_yaml_sections(remote_text)

    # Build lookup: key -> raw_text (last occurrence wins for duplicates)
    local_map = {k: v for k, v in local_sections if k is not None}

    # Build result by iterating the remote layout (keeps remote ordering)
    result_parts = []
    seen_keys = set()

    for key, raw in remote_sections:
        if key is None:
            # Header comments / preamble — always take from remote
            result_parts.append(raw)
        elif key in CONFIG_USER_KEYS:
            # User-owned section: keep local version if it exists
            if key in local_map:
                result_parts.append(local_map[key])
            else:
                result_parts.append(raw)
            seen_keys.add(key)
        else:
            # Framework-owned section: take remote version
            result_parts.append(raw)
            seen_keys.add(key)

    # Append any local-only user sections that don't exist in remote
    for key, raw in local_sections:
        if key is not None and key in CONFIG_USER_KEYS and key not in seen_keys:
            result_parts.append(raw)

    merged = "".join(result_parts)
    # Ensure file ends with a single newline
    return merged.rstrip("\n") + "\n"


def apply_update(temp_dir, project_root):
    """
    Apply downloaded files from temp_dir to the project.

    Skips protected directories. Returns update details.
    """
    updated_files = []
    added_files = []
    skipped_protected = []
    merged_config = []

    temp_path = Path(temp_dir)
    for src_file in temp_path.rglob("*"):
        if src_file.is_dir():
            continue

        rel_path = str(src_file.relative_to(temp_path)).replace("\\", "/")

        if is_protected(rel_path):
            skipped_protected.append(rel_path)
            continue

        dest_file = project_root / rel_path
        dest_file.parent.mkdir(parents=True, exist_ok=True)

        if dest_file.exists():
            updated_files.append(rel_path)
        else:
            added_files.append(rel_path)

        # Smart merge for config.yaml: preserve user-owned sections
        if rel_path == ".ai-agents/config.yaml" and dest_file.exists():
            try:
                local_text = dest_file.read_text(encoding="utf-8")
                remote_text = src_file.read_text(encoding="utf-8")
                merged_text = merge_config_yaml(local_text, remote_text)
                dest_file.write_text(merged_text, encoding="utf-8")
                merged_config.append(rel_path)
                continue
            except Exception:
                pass  # Fall through to plain copy on any error

        shutil.copy2(src_file, dest_file)

    return {
        "files_updated": updated_files,
        "files_added": added_files,
        "files_skipped_protected": skipped_protected,
        "files_merged": merged_config,
    }


# ── Sub-commands ──────────────────────────────────────────────

def cmd_check(project_root):
    """Check for available framework updates."""
    # Read local version
    try:
        local_content = (project_root / ".ai-agents" / "registry.yaml").read_text(encoding="utf-8")
        local_ver = parse_yaml_version(local_content)
    except FileNotFoundError:
        output_json("error", "check", error={
            "code": "REGISTRY_PARSE_ERROR",
            "message": "Local .ai-agents/registry.yaml not found",
            "suggestion": "Ensure the AI Agent Framework is installed in this project",
        })
    except ValueError as e:
        output_json("error", "check", error={
            "code": "REGISTRY_PARSE_ERROR",
            "message": str(e),
            "suggestion": "Check that .ai-agents/registry.yaml contains a valid version field",
        })

    # Fetch remote version
    try:
        remote_content = fetch_remote_registry()
        remote_ver = parse_yaml_version(remote_content)
    except RuntimeError as e:
        err_str = str(e)
        if "GITHUB_RATE_LIMIT" in err_str:
            output_json("error", "check", error={
                "code": "GITHUB_RATE_LIMIT",
                "message": "GitHub API rate limit exceeded",
                "suggestion": "Please wait a few minutes and try again",
            })
        else:
            output_json("error", "check", error={
                "code": "NETWORK_ERROR",
                "message": f"Failed to fetch remote registry: {e}",
                "suggestion": "Check your internet connection and try again",
            })
    except ValueError as e:
        output_json("error", "check", error={
            "code": "REGISTRY_PARSE_ERROR",
            "message": f"Cannot parse remote registry: {e}",
            "suggestion": "The remote repository may have an issue. Try again later.",
        })

    # Compare versions
    try:
        version_status = compare_versions(local_ver, remote_ver)
    except ValueError as e:
        output_json("error", "check", error={
            "code": "VERSION_PARSE_ERROR",
            "message": str(e),
            "suggestion": "Check that version numbers follow semver format (e.g., 1.2 or 1.2.3)",
        })

    # Detect platforms
    platforms = detect_platforms(project_root)

    data = {
        "local_version": local_ver,
        "remote_version": remote_ver,
        "update_available": version_status == "update_available",
        "version_status": version_status,
        "platforms_detected": platforms,
        "protected_dirs": PROTECTED_PATHS,
    }

    # If update is available, get the file tree for preview
    if version_status == "update_available":
        try:
            all_files = get_remote_file_tree()
            downloadable = [f for f in all_files if should_download(f)]
            data["remote_file_tree"] = categorize_files(downloadable)
            data["total_files_to_update"] = len(downloadable)
        except Exception as e:
            # Non-fatal: we can still report the version info
            data["remote_file_tree"] = {}
            data["file_tree_error"] = str(e)

    output_json("success", "check", data=data)


def cmd_update(project_root):
    """Download and apply framework updates with atomic backup/rollback."""
    # 1. Check for updates first
    try:
        local_content = (project_root / ".ai-agents" / "registry.yaml").read_text(encoding="utf-8")
        local_ver = parse_yaml_version(local_content)
    except Exception as e:
        output_json("error", "update", error={
            "code": "REGISTRY_PARSE_ERROR",
            "message": f"Failed to read local registry: {e}",
            "suggestion": "Ensure .ai-agents/registry.yaml exists and is valid",
        })

    try:
        remote_content = fetch_remote_registry()
        remote_ver = parse_yaml_version(remote_content)
    except Exception as e:
        output_json("error", "update", error={
            "code": "NETWORK_ERROR",
            "message": f"Failed to fetch remote registry: {e}",
            "suggestion": "Check your internet connection and try again",
        })

    try:
        version_status = compare_versions(local_ver, remote_ver)
    except ValueError as e:
        output_json("error", "update", error={
            "code": "VERSION_PARSE_ERROR",
            "message": str(e),
            "suggestion": "Check version number format",
        })

    if version_status == "up_to_date":
        output_json("success", "update", data={
            "message": "Already up to date",
            "current_version": local_ver,
        })
    elif version_status == "development_mode":
        output_json("success", "update", data={
            "message": "Local version is newer than remote (development mode)",
            "local_version": local_ver,
            "remote_version": remote_ver,
        })

    # 2. Get file list
    try:
        all_files = get_remote_file_tree()
        files_to_download = [f for f in all_files if should_download(f)]
    except Exception as e:
        output_json("error", "update", error={
            "code": "NETWORK_ERROR",
            "message": f"Failed to get remote file tree: {e}",
            "suggestion": "Check your internet connection and try again",
        })

    if not files_to_download:
        output_json("error", "update", error={
            "code": "DOWNLOAD_FAILED",
            "message": "No files found to download",
            "suggestion": "The remote repository may be empty or inaccessible",
        })

    # 3. Create backup
    try:
        backup_path = create_backup(project_root)
    except Exception as e:
        output_json("error", "update", error={
            "code": "BACKUP_FAILED",
            "message": f"Failed to create backup: {e}",
            "suggestion": "Check disk space and write permissions",
        })

    # 4. Download to temp directory
    temp_dir = tempfile.mkdtemp(prefix="ai-framework-update-")
    try:
        downloaded, failed = download_framework(files_to_download, temp_dir)

        if not downloaded:
            shutil.rmtree(temp_dir, ignore_errors=True)
            output_json("error", "update", error={
                "code": "DOWNLOAD_FAILED",
                "message": "Failed to download any files",
                "suggestion": "Check your internet connection and try again",
            }, data={
                "failed_files": failed,
                "backup_path": backup_path,
            })

        # Warn if some files failed but most succeeded
        if len(failed) > len(downloaded) * 0.1:
            # More than 10% failed - abort
            shutil.rmtree(temp_dir, ignore_errors=True)
            output_json("error", "update", error={
                "code": "DOWNLOAD_FAILED",
                "message": f"Too many download failures: {len(failed)} of {len(files_to_download)}",
                "suggestion": "Check your internet connection and try again",
            }, data={
                "failed_files": failed,
                "backup_path": backup_path,
            })

        # 5. Apply update
        try:
            result = apply_update(temp_dir, project_root)
        except Exception as e:
            # Rollback on failure
            try:
                restore_backup(backup_path, project_root)
                output_json("error", "update", error={
                    "code": "APPLY_FAILED",
                    "message": f"Failed to apply update: {e}",
                    "suggestion": "The update has been automatically rolled back",
                }, data={
                    "rollback_performed": True,
                    "rollback_source": backup_path,
                    "current_version": local_ver,
                })
            except Exception as rollback_err:
                output_json("error", "update", error={
                    "code": "ROLLBACK_FAILED",
                    "message": f"Update failed ({e}) and rollback also failed ({rollback_err})",
                    "suggestion": f"Please manually restore from backup: {backup_path}",
                })

        # 6. Read new version to confirm
        try:
            new_content = (project_root / ".ai-agents" / "registry.yaml").read_text(encoding="utf-8")
            new_ver = parse_yaml_version(new_content)
        except Exception:
            new_ver = remote_ver  # Best guess

        # Detect platforms for adapter report
        platforms = detect_platforms(project_root)
        platform_adapters = {}
        for f in result["files_updated"] + result["files_added"]:
            if f == "CLAUDE.md":
                platform_adapters.setdefault("claude_code", []).append(f)
            elif f.startswith(".github/agents/"):
                platform_adapters.setdefault("github_copilot", []).append(f)

        output_json("success", "update", data={
            "previous_version": local_ver,
            "updated_version": new_ver,
            "backup_path": os.path.relpath(backup_path, str(project_root)),
            "files_updated": result["files_updated"],
            "files_added": result["files_added"],
            "files_skipped_protected": result["files_skipped_protected"],
            "files_merged": result["files_merged"],
            "files_failed": [f["file"] for f in failed] if failed else [],
            "platform_adapters_updated": platform_adapters,
            "integrity_check": "passed",
        })

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def cmd_rollback(project_root, backup_timestamp=None):
    """Rollback to a previous backup."""
    backups = list_backups(project_root)

    if not backups:
        output_json("error", "rollback", error={
            "code": "NO_BACKUP_FOUND",
            "message": "No backups found",
            "suggestion": "There are no previous backups to restore from",
        })

    # Find the target backup
    target = None
    if backup_timestamp:
        # Validate timestamp format to prevent path traversal
        if not re.match(r"^\d{8}-\d{6}$", backup_timestamp):
            output_json("error", "rollback", error={
                "code": "INVALID_BACKUP",
                "message": f"Invalid backup timestamp format: {backup_timestamp}",
                "suggestion": "Use format YYYYMMDD-HHmmss (e.g., 20260312-143022)",
            })
        for b in backups:
            if b["timestamp"] == backup_timestamp:
                target = b
                break
        if not target:
            output_json("error", "rollback", error={
                "code": "NO_BACKUP_FOUND",
                "message": f"Backup '{backup_timestamp}' not found",
                "suggestion": "Use 'list-backups' command to see available backups",
            })
    else:
        # Use the most recent backup
        target = backups[0]

    # Read current version before rollback
    try:
        current_content = (project_root / ".ai-agents" / "registry.yaml").read_text(encoding="utf-8")
        current_ver = parse_yaml_version(current_content)
    except Exception:
        current_ver = "unknown"

    # Perform rollback
    backup_full_path = project_root / target["path"]
    try:
        restore_backup(backup_full_path, project_root)
    except Exception as e:
        output_json("error", "rollback", error={
            "code": "ROLLBACK_FAILED",
            "message": f"Failed to restore backup: {e}",
            "suggestion": f"Try manually copying files from {target['path']}",
        })

    output_json("success", "rollback", data={
        "rolled_back_from": current_ver,
        "rolled_back_to": target["version"],
        "backup_used": target["path"],
        "files_restored": target["file_count"],
        "platforms_restored": detect_platforms(project_root),
    })


def cmd_list_backups(project_root):
    """List all available backups."""
    backups = list_backups(project_root)
    output_json("success", "list-backups", data={
        "backups": backups,
        "total": len(backups),
    })


# ── Entry Point ───────────────────────────────────────────────

def main():
    if sys.version_info < (3, 7):
        output_json("error", "init", error={
            "code": "PYTHON_VERSION_ERROR",
            "message": f"Python 3.7+ required, got {sys.version}",
            "suggestion": "Please upgrade to Python 3.7 or later",
        })

    parser = argparse.ArgumentParser(
        description="AI Agent Framework Update Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Sub-commands:
  check         Check for available updates
  update        Download and apply updates (with backup)
  rollback      Restore from a previous backup
  list-backups  Show available backups
        """,
    )
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("check", help="Check for available updates")
    subparsers.add_parser("update", help="Download and apply updates")

    rollback_parser = subparsers.add_parser("rollback", help="Restore from backup")
    rollback_parser.add_argument(
        "--backup",
        metavar="TIMESTAMP",
        help="Specific backup timestamp (YYYYMMDD-HHmmss). Defaults to latest.",
    )

    subparsers.add_parser("list-backups", help="List available backups")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    project_root = find_project_root()

    if args.command == "check":
        cmd_check(project_root)
    elif args.command == "update":
        cmd_update(project_root)
    elif args.command == "rollback":
        cmd_rollback(project_root, getattr(args, "backup", None))
    elif args.command == "list-backups":
        cmd_list_backups(project_root)


if __name__ == "__main__":
    main()
