#!/usr/bin/env python3
"""
Full Pipeline Orchestrator
YouTube Scrape → NotebookLM Export → Obsidian Scan → Cross-Reference Analysis

Usage:
  python3 run_pipeline.py              # Run full pipeline
  python3 run_pipeline.py --scrape     # YouTube scrape only
  python3 run_pipeline.py --scan       # Obsidian scan only
  python3 run_pipeline.py --analyze    # Cross-reference analysis only
  python3 run_pipeline.py --status     # Show current state
"""

import sys
import json
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def run_scrape():
    """Step 1: Scrape YouTube channels and export for NotebookLM."""
    print("\n" + "=" * 60)
    print("STEP 1: YouTube Scrape + NotebookLM Export")
    print("=" * 60)
    from youtube_scraper import main as scrape_main
    return scrape_main()


def run_obsidian_scan():
    """Step 2: Scan Obsidian vault for automation ideas."""
    print("\n" + "=" * 60)
    print("STEP 2: Obsidian Vault Scan")
    print("=" * 60)
    from obsidian_scanner import main as scan_main
    return scan_main()


def run_analysis():
    """Step 3: Cross-reference and generate automation recommendations."""
    print("\n" + "=" * 60)
    print("STEP 3: Cross-Reference Analysis")
    print("=" * 60)
    from analyze_and_automate import main as analyze_main
    return analyze_main()


def show_status():
    """Show current pipeline state."""
    print("\n" + "=" * 60)
    print("PIPELINE STATUS")
    print("=" * 60)

    # Config
    config_path = SCRIPT_DIR / "config.json"
    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
        print("\nChannels configured:")
        for key, ch in config["channels"].items():
            print(f"  {ch['name']}: {ch['channel_handle']} → Notebook: '{ch['notebook_name']}'")
        print(f"\nObsidian vault: {config['obsidian_vault_path']}")
        print(f"Skills folder: {config['obsidian_automation_folder']}")
    else:
        print("\nNo config.json found!")

    # State
    state_path = SCRIPT_DIR / "state.json"
    if state_path.exists():
        with open(state_path) as f:
            state = json.load(f)
        processed = state.get("processed_videos", {})
        print(f"\nProcessed videos: {len(processed)}")
        print(f"Last run: {state.get('last_run', 'Never')}")
        if processed:
            print("\nRecent videos:")
            recent = sorted(processed.items(), key=lambda x: x[1].get("processed_at", ""), reverse=True)
            for vid_id, info in recent[:5]:
                print(f"  [{info['channel']}] {info['title'][:50]}")
    else:
        print("\nNo state.json - pipeline has not been run yet.")

    # Exports
    export_dir = SCRIPT_DIR.parent / "scraper" / "notebooklm_exports"
    if not export_dir.exists():
        export_dir = SCRIPT_DIR / "notebooklm_exports"
    if export_dir.exists():
        print(f"\nNotebookLM exports:")
        for nb_dir in export_dir.iterdir():
            if nb_dir.is_dir():
                files = list(nb_dir.glob("*.md"))
                print(f"  {nb_dir.name}: {len(files)} files")
    else:
        print("\nNo NotebookLM exports yet.")

    # Analysis
    analysis_path = SCRIPT_DIR / "cross_reference_analysis.json"
    if analysis_path.exists():
        with open(analysis_path) as f:
            analysis = json.load(f)
        print(f"\nLatest analysis:")
        print(f"  Time: {analysis.get('analysis_time', 'Unknown')}")
        print(f"  Videos analyzed: {analysis.get('total_videos', 0)}")
        print(f"  Tools discovered: {len(analysis.get('unique_tools_found', []))}")
        print(f"  Recommendations: {len(analysis.get('recommendations', []))}")
    else:
        print("\nNo analysis yet.")


def main():
    args = sys.argv[1:]

    print("=" * 60)
    print("YouTube → NotebookLM → Obsidian Pipeline")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    if "--status" in args:
        show_status()
        return

    if "--scrape" in args:
        run_scrape()
        return

    if "--scan" in args:
        run_obsidian_scan()
        return

    if "--analyze" in args:
        run_analysis()
        return

    # Full pipeline
    print("\nRunning full pipeline...")

    # Step 1: Scrape YouTube
    scrape_result = run_scrape()

    # Step 2: Scan Obsidian
    obsidian_result = run_obsidian_scan()

    # Step 3: Cross-reference
    analysis = run_analysis()

    # Final summary
    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)

    if scrape_result:
        print(f"\nNew videos scraped: {scrape_result.get('total_new_videos', 0)}")
        for nb, vids in scrape_result.get("by_notebook", {}).items():
            print(f"  → {nb}: {len(vids)} new")

    if analysis:
        recs = analysis.get("recommendations", [])
        high = [r for r in recs if r.get("priority") == "high"]
        print(f"\nRecommendations: {len(recs)} total, {len(high)} high-priority")

    prompt_path = SCRIPT_DIR / "automation_prompt.md"
    if prompt_path.exists():
        print(f"\nNext step: Review automation_prompt.md for actionable insights")
        print(f"  cat {prompt_path}")

    print(f"\nNotebookLM import instructions:")
    print(f"  1. Open notebooklm.google.com")
    print(f"  2. Create/open 'Jack AI' and 'Chase AI' notebooks")
    print(f"  3. Upload .md files from scraper/notebooklm_exports/")
    print(f"  4. Query each notebook for new AI tips & workflow improvements")
    print(f"  5. Run this pipeline again with --analyze to cross-reference")


if __name__ == "__main__":
    main()
