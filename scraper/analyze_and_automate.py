#!/usr/bin/env python3
"""
NotebookLM Insights x Obsidian Vault Cross-Reference Engine

Reads scraped YouTube transcripts (organized by NotebookLM notebook),
cross-references with Obsidian vault automation ideas,
and generates actionable automation recommendations.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def load_scraped_transcripts():
    """Load all scraped transcripts from NotebookLM export directories."""
    export_dir = SCRIPT_DIR.parent / "scraper" / "notebooklm_exports"
    if not export_dir.exists():
        export_dir = SCRIPT_DIR / "notebooklm_exports"
        if not export_dir.exists():
            # Try parent
            export_dir = SCRIPT_DIR.parent / "notebooklm_exports"

    notebooks = {}

    if not export_dir.exists():
        print(f"  No exports directory found. Run youtube_scraper.py first.")
        return notebooks

    for notebook_dir in export_dir.iterdir():
        if not notebook_dir.is_dir():
            continue

        notebook_name = notebook_dir.name.replace("_", " ")
        notebooks[notebook_name] = []

        for md_file in sorted(notebook_dir.glob("*.md")):
            content = md_file.read_text(encoding="utf-8", errors="replace")
            notebooks[notebook_name].append({
                "file": md_file.name,
                "content": content,
                "tips": extract_tips_from_transcript(content),
                "tools_mentioned": extract_tools(content),
                "techniques": extract_techniques(content),
            })

    return notebooks


def extract_tips_from_transcript(content):
    """Extract actionable tips and tricks from transcript text."""
    tips = []

    # Look for common tip patterns in transcripts
    tip_patterns = [
        r'(?:tip|trick|hack|secret|pro tip)[:\s]+(.{20,200})',
        r'(?:you (?:can|should|need to|want to))\s+(.{20,150})',
        r'(?:the (?:best|easiest|fastest|quickest) way)\s+(.{20,150})',
        r'(?:instead of .{5,50}, (?:you can|try|use))\s+(.{20,150})',
        r'(?:I recommend|I suggest)\s+(.{20,150})',
        r'(?:game.?changer|life.?changer|productivity)\s*[:\s]+(.{20,150})',
        r'(?:step \d+)[:\s]+(.{20,200})',
        r'(?:automat\w+)\s+(.{20,150})',
    ]

    for pattern in tip_patterns:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            tip = match.group(1).strip()
            if len(tip) > 20:
                tips.append(tip[:200])

    return list(set(tips))[:20]  # Deduplicate, limit


def extract_tools(content):
    """Extract AI tools and services mentioned in content."""
    tool_patterns = [
        r'\b(Claude)\b', r'\b(ChatGPT)\b', r'\b(GPT-\d)\b',
        r'\b(Gemini)\b', r'\b(Copilot)\b', r'\b(Cursor)\b',
        r'\b(Windsurf)\b', r'\b(Replit)\b', r'\b(v0)\b',
        r'\b(Lovable)\b', r'\b(Bolt)\b', r'\b(Midjourney)\b',
        r'\b(DALL-?E)\b', r'\b(Stable Diffusion)\b', r'\b(Suno)\b',
        r'\b(ElevenLabs)\b', r'\b(Runway)\b', r'\b(Pika)\b',
        r'\b(Sora)\b', r'\b(Kling)\b', r'\b(Perplexity)\b',
        r'\b(NotebookLM)\b', r'\b(Notion AI)\b', r'\b(Zapier)\b',
        r'\b(Make\.com)\b', r'\b(n8n)\b', r'\b(IFTTT)\b',
        r'\b(Langchain)\b', r'\b(LlamaIndex)\b', r'\b(AutoGen)\b',
        r'\b(CrewAI)\b', r'\b(Devin)\b', r'\b(Anthropic)\b',
        r'\b(OpenAI)\b', r'\b(Google AI)\b', r'\b(Hugging\s?Face)\b',
        r'\b(Supabase)\b', r'\b(Firebase)\b', r'\b(Vercel)\b',
        r'\b(MCP)\b', r'\b(Claude Code)\b', r'\b(Artifacts)\b',
    ]

    tools = set()
    for pattern in tool_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        tools.update(m.strip() for m in matches)

    return sorted(tools)


def extract_techniques(content):
    """Extract AI techniques and methodologies mentioned."""
    technique_patterns = [
        r'\b(prompt engineering)\b',
        r'\b(chain of thought)\b',
        r'\b(few[- ]shot)\b',
        r'\b(zero[- ]shot)\b',
        r'\b(RAG|retrieval augmented)\b',
        r'\b(fine[- ]tun\w+)\b',
        r'\b(embeddings?)\b',
        r'\b(vector (?:store|database|db))\b',
        r'\b(agent\w*)\b',
        r'\b(function calling)\b',
        r'\b(tool use)\b',
        r'\b(system prompt)\b',
        r'\b(MCP server)\b',
        r'\b(API (?:key|call|integration))\b',
        r'\b(webhook)\b',
        r'\b(automation)\b',
        r'\b(workflow)\b',
        r'\b(pipeline)\b',
        r'\b(no[- ]code)\b',
        r'\b(low[- ]code)\b',
    ]

    techniques = set()
    for pattern in technique_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        techniques.update(m.strip().lower() for m in matches)

    return sorted(techniques)


def load_obsidian_report():
    """Load the Obsidian automation report."""
    report_path = SCRIPT_DIR / "obsidian_automation_report.json"
    if report_path.exists():
        with open(report_path) as f:
            return json.load(f)
    return None


def cross_reference(notebooks, obsidian_report):
    """Cross-reference NotebookLM insights with Obsidian automation ideas."""
    recommendations = []

    if not obsidian_report:
        print("  No Obsidian report available. Run obsidian_scanner.py first.")
        print("  Generating recommendations from YouTube content only.\n")

    # Collect all tips, tools, and techniques from notebooks
    all_tips = []
    all_tools = set()
    all_techniques = set()

    for notebook_name, videos in notebooks.items():
        for video in videos:
            for tip in video["tips"]:
                all_tips.append({
                    "tip": tip,
                    "source": notebook_name,
                    "file": video["file"],
                })
            all_tools.update(video["tools_mentioned"])
            all_techniques.update(video["techniques"])

    # If we have Obsidian data, match against automation ideas
    if obsidian_report:
        open_todos = obsidian_report.get("open_todos", [])
        automation_ideas = obsidian_report.get("automation_ideas", [])

        for todo in open_todos:
            task_lower = todo["task"].lower()
            matching_tips = []
            matching_tools = []

            for tip_data in all_tips:
                tip_lower = tip_data["tip"].lower()
                # Simple keyword overlap scoring
                task_words = set(re.findall(r'\w{4,}', task_lower))
                tip_words = set(re.findall(r'\w{4,}', tip_lower))
                overlap = task_words & tip_words
                if len(overlap) >= 2 or any(kw in tip_lower for kw in ['automat', 'workflow', 'integrat', 'script']):
                    matching_tips.append(tip_data)

            for tool in all_tools:
                if tool.lower() in task_lower:
                    matching_tools.append(tool)

            if matching_tips or matching_tools:
                recommendations.append({
                    "type": "obsidian_todo_match",
                    "todo": todo["task"],
                    "source_note": todo["source_note"],
                    "matching_tips": matching_tips[:5],
                    "matching_tools": matching_tools,
                    "priority": "high" if matching_tips else "medium",
                })

        # Also check automation ideas from Obsidian
        for idea in automation_ideas:
            idea_keywords = set(kw.lower() for kw in idea.get("keywords", []))
            relevant_tools = idea_keywords & {t.lower() for t in all_tools}
            relevant_techniques = idea_keywords & all_techniques

            if relevant_tools or relevant_techniques:
                recommendations.append({
                    "type": "idea_enhancement",
                    "idea_title": idea["title"],
                    "idea_path": idea["path"],
                    "new_tools_to_try": sorted(relevant_tools),
                    "techniques_to_apply": sorted(relevant_techniques),
                    "priority": "medium",
                })

    # Always generate general recommendations from new content
    for notebook_name, videos in notebooks.items():
        for video in videos:
            if video["tools_mentioned"] or video["techniques"]:
                recommendations.append({
                    "type": "new_capability",
                    "source": notebook_name,
                    "video": video["file"],
                    "tools": video["tools_mentioned"],
                    "techniques": video["techniques"],
                    "sample_tips": video["tips"][:3],
                    "priority": "low",
                })

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    recommendations.sort(key=lambda r: priority_order.get(r["priority"], 3))

    return {
        "analysis_time": datetime.now(timezone.utc).isoformat(),
        "notebooks_analyzed": list(notebooks.keys()),
        "total_videos": sum(len(v) for v in notebooks.values()),
        "unique_tools_found": sorted(all_tools),
        "unique_techniques_found": sorted(all_techniques),
        "total_tips_extracted": len(all_tips),
        "recommendations": recommendations,
        "obsidian_connected": obsidian_report is not None,
    }


def generate_automation_prompt(analysis):
    """Generate a prompt for Claude to create an automation based on the analysis."""
    prompt = f"""# Automation Opportunity Analysis

Based on scraping {analysis['total_videos']} YouTube videos from AI influencers
and cross-referencing with your Obsidian vault, here's what I found:

## New Tools & Features Discovered
{json.dumps(analysis['unique_tools_found'], indent=2)}

## Techniques Mentioned
{json.dumps(analysis['unique_techniques_found'], indent=2)}

## Top Recommendations
"""

    for i, rec in enumerate(analysis["recommendations"][:10], 1):
        if rec["type"] == "obsidian_todo_match":
            prompt += f"""
### {i}. Match: "{rec['todo']}" (from {rec['source_note']})
- **Priority:** {rec['priority']}
- **Matching tips from YouTube:** {len(rec['matching_tips'])}
- **Tools to use:** {', '.join(rec['matching_tools']) if rec['matching_tools'] else 'See tips'}
"""
            for tip in rec["matching_tips"][:3]:
                prompt += f"  - *{tip['source']}*: {tip['tip'][:100]}\n"

        elif rec["type"] == "idea_enhancement":
            prompt += f"""
### {i}. Enhance: "{rec['idea_title']}"
- **New tools:** {', '.join(rec['new_tools_to_try'])}
- **Techniques:** {', '.join(rec['techniques_to_apply'])}
"""

        elif rec["type"] == "new_capability":
            prompt += f"""
### {i}. New from {rec['source']}
- **Tools:** {', '.join(rec['tools'])}
- **Techniques:** {', '.join(rec['techniques'])}
"""
            for tip in rec.get("sample_tips", []):
                prompt += f"  - {tip[:100]}\n"

    prompt += """
## Next Step
Pick ONE recommendation above and let's automate it now.
Which automation would have the highest impact on your daily workflow?
"""

    return prompt


def main():
    print("=" * 60)
    print("NotebookLM x Obsidian Cross-Reference Analysis")
    print(f"Run time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    # Load scraped content
    print("\nLoading scraped YouTube transcripts...")
    notebooks = load_scraped_transcripts()

    if not notebooks:
        print("No scraped content found. Run youtube_scraper.py first.")
        return None

    for name, videos in notebooks.items():
        print(f"  {name}: {len(videos)} videos")

    # Load Obsidian report
    print("\nLoading Obsidian automation report...")
    obsidian_report = load_obsidian_report()
    if obsidian_report:
        print(f"  {obsidian_report['total_automation_notes']} automation notes found")
        print(f"  {len(obsidian_report.get('open_todos', []))} open TODOs")
    else:
        print("  No Obsidian report found (run obsidian_scanner.py)")

    # Cross-reference
    print("\nCross-referencing insights...")
    analysis = cross_reference(notebooks, obsidian_report)

    # Save analysis
    analysis_path = SCRIPT_DIR / "cross_reference_analysis.json"
    with open(analysis_path, "w") as f:
        json.dump(analysis, f, indent=2)

    # Generate Claude prompt
    prompt = generate_automation_prompt(analysis)
    prompt_path = SCRIPT_DIR / "automation_prompt.md"
    with open(prompt_path, "w") as f:
        f.write(prompt)

    print(f"\nAnalysis saved: {analysis_path}")
    print(f"Claude prompt saved: {prompt_path}")
    print(f"\nResults:")
    print(f"  Tools discovered: {len(analysis['unique_tools_found'])}")
    print(f"  Techniques found: {len(analysis['unique_techniques_found'])}")
    print(f"  Tips extracted: {analysis['total_tips_extracted']}")
    print(f"  Recommendations: {len(analysis['recommendations'])}")

    high_pri = [r for r in analysis["recommendations"] if r["priority"] == "high"]
    if high_pri:
        print(f"\n  HIGH PRIORITY ({len(high_pri)}):")
        for r in high_pri[:5]:
            if r["type"] == "obsidian_todo_match":
                print(f"    - {r['todo'][:60]}")
            elif r["type"] == "idea_enhancement":
                print(f"    - Enhance: {r['idea_title'][:60]}")

    print(f"\n  Run 'cat {prompt_path}' to see the full automation prompt for Claude.")

    return analysis


if __name__ == "__main__":
    main()
