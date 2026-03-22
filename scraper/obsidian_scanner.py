#!/usr/bin/env python3
"""
Obsidian Vault Scanner
Scans an Obsidian vault for automation ideas and tasks,
then cross-references with NotebookLM insights to find
actionable improvements.
"""

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CONFIG_PATH = SCRIPT_DIR / "config.json"


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def expand_path(p):
    return Path(os.path.expanduser(p)).resolve()


def find_automation_notes(vault_path, automation_folder=None):
    """
    Scan the Obsidian vault for notes related to automation.
    Looks in a specific folder if configured, otherwise searches all notes.
    """
    vault = expand_path(vault_path)
    if not vault.exists():
        print(f"  WARNING: Obsidian vault not found at {vault}")
        print(f"  Please update 'obsidian_vault_path' in config.json")
        return []

    notes = []

    # Automation keywords to search for
    automation_keywords = [
        r'\bautoma\w+',        # automate, automation, automated, etc.
        r'\bworkflow\w*',
        r'\bscript\w*',
        r'\bcron\b',
        r'\bschedul\w+',
        r'\btrigger\w*',
        r'\bintegrat\w+',
        r'\bpipeline\w*',
        r'\bwebhook\w*',
        r'\bAPI\b',
        r'\bbot\b',
        r'\bscrape\w*',
        r'\bscraping\b',
        r'\bnotification\w*',
        r'\balert\w*',
        r'\bdashboard\w*',
        r'\bmonitor\w*',
        r'\boptimiz\w+',
        r'\befficienc\w+',
        r'\bproductivit\w+',
        r'\btool\w*',
        r'\bAI\b',
        r'\bClaude\b',
        r'\bGPT\b',
        r'\bLLM\b',
        r'\bprompt\w*',
    ]
    pattern = re.compile('|'.join(automation_keywords), re.IGNORECASE)

    # Determine search scope
    if automation_folder:
        search_root = vault / automation_folder
        if not search_root.exists():
            print(f"  Automation folder '{automation_folder}' not found, searching entire vault")
            search_root = vault
    else:
        search_root = vault

    for md_file in search_root.rglob("*.md"):
        # Skip hidden files and folders
        if any(part.startswith('.') for part in md_file.parts):
            continue

        try:
            content = md_file.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        matches = pattern.findall(content)
        if matches:
            # Extract key sections
            note_data = {
                "path": str(md_file.relative_to(vault)),
                "title": md_file.stem,
                "keyword_matches": list(set(m.lower() for m in matches)),
                "match_count": len(matches),
                "sections": extract_sections(content),
                "todos": extract_todos(content),
                "tags": extract_tags(content),
            }
            notes.append(note_data)

    # Sort by relevance (match count)
    notes.sort(key=lambda n: n["match_count"], reverse=True)
    return notes


def extract_sections(content):
    """Extract markdown headers and their content."""
    sections = []
    lines = content.split('\n')
    current_header = None
    current_content = []

    for line in lines:
        if line.startswith('#'):
            if current_header:
                sections.append({
                    "header": current_header,
                    "content": '\n'.join(current_content).strip()[:500]
                })
            current_header = line.lstrip('#').strip()
            current_content = []
        else:
            current_content.append(line)

    if current_header:
        sections.append({
            "header": current_header,
            "content": '\n'.join(current_content).strip()[:500]
        })

    return sections[:10]  # Limit to first 10 sections


def extract_todos(content):
    """Extract TODO items from the note."""
    todos = []
    for line in content.split('\n'):
        line = line.strip()
        # Match checkbox items
        if re.match(r'^- \[ \]', line):
            todos.append({"text": line[6:].strip(), "done": False})
        elif re.match(r'^- \[x\]', line, re.IGNORECASE):
            todos.append({"text": line[6:].strip(), "done": True})
    return todos


def extract_tags(content):
    """Extract Obsidian tags from the note."""
    tags = re.findall(r'#([a-zA-Z][a-zA-Z0-9_/-]+)', content)
    return list(set(tags))


def generate_automation_report(notes):
    """Generate a structured report of automation opportunities."""
    report = {
        "scan_time": datetime.now(timezone.utc).isoformat(),
        "total_automation_notes": len(notes),
        "open_todos": [],
        "automation_ideas": [],
        "top_tags": {},
    }

    # Collect all open TODOs
    for note in notes:
        for todo in note["todos"]:
            if not todo["done"]:
                report["open_todos"].append({
                    "task": todo["text"],
                    "source_note": note["title"],
                    "source_path": note["path"],
                })

    # Collect automation ideas (notes with high keyword density)
    for note in notes[:20]:  # Top 20 most relevant
        report["automation_ideas"].append({
            "title": note["title"],
            "path": note["path"],
            "keywords": note["keyword_matches"][:10],
            "tags": note["tags"][:5],
            "sections": [s["header"] for s in note["sections"][:5]],
        })

    # Tag frequency
    all_tags = {}
    for note in notes:
        for tag in note["tags"]:
            all_tags[tag] = all_tags.get(tag, 0) + 1
    report["top_tags"] = dict(sorted(all_tags.items(), key=lambda x: -x[1])[:20])

    return report


def main():
    print("=" * 60)
    print("Obsidian Vault Automation Scanner")
    print(f"Run time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    config = load_config()
    vault_path = config.get("obsidian_vault_path", "~/ObsidianVault")
    automation_folder = config.get("obsidian_automation_folder")

    print(f"\nScanning vault: {vault_path}")
    if automation_folder:
        print(f"Automation folder: {automation_folder}")

    notes = find_automation_notes(vault_path, automation_folder)
    print(f"\nFound {len(notes)} notes with automation-related content")

    if notes:
        report = generate_automation_report(notes)

        # Save report
        report_path = SCRIPT_DIR / "obsidian_automation_report.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

        print(f"\nReport saved: {report_path}")
        print(f"Open automation TODOs: {len(report['open_todos'])}")
        print(f"Top automation ideas: {len(report['automation_ideas'])}")

        if report["open_todos"]:
            print(f"\nOpen Automation TODOs:")
            for todo in report["open_todos"][:10]:
                print(f"  - {todo['task']} (from: {todo['source_note']})")

        return report
    else:
        print("No automation-related notes found.")
        print("Make sure 'obsidian_vault_path' in config.json points to your vault.")
        return None


if __name__ == "__main__":
    main()
