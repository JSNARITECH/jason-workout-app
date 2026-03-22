#!/usr/bin/env python3
"""
YouTube AI Influencer Scraper
Monitors YouTube channels for new videos, extracts transcripts,
and organizes content for NotebookLM import by influencer.
"""

import json
import os
import re
import sys
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print("Installing youtube-transcript-api...")
    os.system(f"{sys.executable} -m pip install youtube-transcript-api")
    from youtube_transcript_api import YouTubeTranscriptApi


SCRIPT_DIR = Path(__file__).parent
CONFIG_PATH = SCRIPT_DIR / "config.json"
STATE_PATH = SCRIPT_DIR / "state.json"


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def load_state():
    if STATE_PATH.exists():
        with open(STATE_PATH) as f:
            return json.load(f)
    return {"processed_videos": {}, "last_run": None}


def save_state(state):
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def resolve_channel_id(handle_or_id):
    """Resolve a YouTube channel handle (@Name) or ID to the actual channel ID."""
    if handle_or_id.startswith("UC"):
        return handle_or_id

    # Try to resolve handle via YouTube page
    handle = handle_or_id.lstrip("@")
    url = f"https://www.youtube.com/@{handle}"
    try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        })
        html = urlopen(req, timeout=15).read().decode("utf-8", errors="replace")
        # Look for channel ID in page source
        match = re.search(r'"channelId":"(UC[a-zA-Z0-9_-]+)"', html)
        if match:
            return match.group(1)
        # Alternative pattern
        match = re.search(r'channel/(UC[a-zA-Z0-9_-]+)', html)
        if match:
            return match.group(1)
        # Try externalId pattern
        match = re.search(r'"externalId":"(UC[a-zA-Z0-9_-]+)"', html)
        if match:
            return match.group(1)
    except Exception as e:
        print(f"  Warning: Could not resolve handle @{handle}: {e}")
    return None


def fetch_channel_feed(channel_id):
    """Fetch the YouTube RSS feed for a channel."""
    feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    try:
        req = Request(feed_url, headers={"User-Agent": "Mozilla/5.0"})
        xml_data = urlopen(req, timeout=15).read()
        return xml_data
    except URLError as e:
        print(f"  Error fetching feed for {channel_id}: {e}")
        return None


def fetch_channel_feed_by_handle(handle):
    """Fallback: Try to fetch videos via YouTube search/handle page scraping."""
    handle = handle.lstrip("@")
    url = f"https://www.youtube.com/@{handle}/videos"
    try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/120.0.0.0 Safari/537.36",
        })
        html = urlopen(req, timeout=15).read().decode("utf-8", errors="replace")

        # Extract video IDs from page
        video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
        video_ids = list(dict.fromkeys(video_ids))  # Deduplicate preserving order

        # Extract titles (paired with video IDs in JSON)
        titles = re.findall(r'"title":\{"runs":\[\{"text":"([^"]+)"\}', html)

        videos = []
        for i, vid in enumerate(video_ids[:15]):
            title = titles[i] if i < len(titles) else f"Video {vid}"
            videos.append({
                "video_id": vid,
                "title": title,
                "published": "",
                "description": "",
                "url": f"https://www.youtube.com/watch?v={vid}",
            })

        return videos if videos else None
    except Exception as e:
        print(f"  Warning: Handle-based fetch failed for @{handle}: {e}")
        return None


def parse_feed(xml_data):
    """Parse YouTube RSS feed and extract video entries."""
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
        "media": "http://search.yahoo.com/mrss/",
    }
    root = ET.fromstring(xml_data)
    videos = []

    for entry in root.findall("atom:entry", ns):
        video_id = entry.find("yt:videoId", ns)
        title = entry.find("atom:title", ns)
        published = entry.find("atom:published", ns)
        media_group = entry.find("media:group", ns)
        description = ""
        if media_group is not None:
            desc_elem = media_group.find("media:description", ns)
            if desc_elem is not None and desc_elem.text:
                description = desc_elem.text

        if video_id is not None and title is not None:
            videos.append({
                "video_id": video_id.text,
                "title": title.text,
                "published": published.text if published is not None else "",
                "description": description,
                "url": f"https://www.youtube.com/watch?v={video_id.text}",
            })

    return videos


def get_transcript(video_id, language="en"):
    """Extract transcript for a YouTube video. Supports multiple API versions."""
    try:
        # youtube-transcript-api v1.x uses .fetch() directly
        try:
            fetched = YouTubeTranscriptApi.get_transcript(video_id, languages=[language])
        except Exception:
            try:
                fetched = YouTubeTranscriptApi.get_transcript(video_id)
            except Exception:
                # v0.x fallback: list_transcripts approach
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                try:
                    transcript = transcript_list.find_transcript([language])
                except Exception:
                    try:
                        transcript = transcript_list.find_generated_transcript([language])
                    except Exception:
                        for t in transcript_list:
                            transcript = t
                            break
                        else:
                            return None
                fetched = transcript.fetch()

        # Handle different segment formats across API versions
        segments = []
        for segment in fetched:
            if isinstance(segment, dict):
                segments.append(segment.get("text", ""))
            elif hasattr(segment, "text"):
                segments.append(segment.text)
            else:
                segments.append(str(segment))

        full_text = " ".join(s for s in segments if s)
        return full_text if full_text.strip() else None

    except Exception as e:
        print(f"  Could not get transcript for {video_id}: {e}")
        return None


def format_for_notebooklm(video, transcript, influencer_name):
    """Format video data as a document suitable for NotebookLM import."""
    doc = f"""# {video['title']}

**Source:** {influencer_name} (YouTube)
**URL:** {video['url']}
**Published:** {video['published']}
**Scraped:** {datetime.now(timezone.utc).isoformat()}

## Description
{video['description']}

## Full Transcript
{transcript if transcript else '[Transcript not available]'}

---
*Auto-scraped for {influencer_name} NotebookLM notebook*
"""
    return doc


def scrape_channel(channel_key, channel_config, state, config):
    """Scrape a single channel for new videos."""
    print(f"\n{'='*60}")
    print(f"Scraping: {channel_config['name']}")
    print(f"{'='*60}")

    # Resolve channel ID if needed
    channel_id = channel_config.get("channel_id")
    handle = channel_config.get("channel_handle", "")
    videos = None

    if not channel_id and handle:
        print(f"  Resolving channel handle: {handle}")
        channel_id = resolve_channel_id(handle)

    if channel_id:
        print(f"  Channel ID: {channel_id}")
        # Fetch RSS feed
        xml_data = fetch_channel_feed(channel_id)
        if xml_data:
            videos = parse_feed(xml_data)
            print(f"  Found {len(videos)} videos in feed")

    # Fallback: scrape handle page directly if RSS failed
    if not videos and handle:
        print(f"  RSS feed unavailable, trying handle-based scrape...")
        videos = fetch_channel_feed_by_handle(handle)
        if videos:
            print(f"  Found {len(videos)} videos via handle scrape")

    if not videos:
        print(f"  ERROR: Could not fetch videos for {channel_config['name']}")
        print(f"  Try setting 'channel_id' manually in config.json")
        print(f"  Find it at: https://www.youtube.com/{handle}")
        return []

    # Filter to only new/unprocessed videos
    processed = state.get("processed_videos", {})
    max_videos = config.get("max_videos_per_channel", 10)
    new_videos = []

    for video in videos[:max_videos]:
        vid = video["video_id"]
        if vid in processed:
            print(f"  Skipping (already processed): {video['title'][:50]}")
            continue
        new_videos.append(video)

    print(f"  New videos to process: {len(new_videos)}")

    # Process each new video
    results = []
    output_dir = Path(SCRIPT_DIR.parent) / config.get("notebooklm_export_dir", "scraper/notebooklm_exports")
    notebook_dir = output_dir / channel_config["notebook_name"].replace(" ", "_")
    notebook_dir.mkdir(parents=True, exist_ok=True)

    for video in new_videos:
        print(f"\n  Processing: {video['title'][:60]}")
        print(f"  URL: {video['url']}")

        # Get transcript
        transcript = get_transcript(
            video["video_id"],
            config.get("transcript_language", "en")
        )

        if transcript:
            print(f"  Transcript: {len(transcript)} characters")
        else:
            print(f"  Transcript: Not available (will use description only)")

        # Format for NotebookLM
        doc = format_for_notebooklm(video, transcript, channel_config["name"])

        # Save to file
        safe_title = re.sub(r'[^\w\s-]', '', video['title'])[:80].strip()
        safe_title = re.sub(r'\s+', '_', safe_title)
        filename = f"{video['published'][:10]}_{safe_title}.md"
        filepath = notebook_dir / filename

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(doc)

        print(f"  Saved: {filepath.name}")

        # Mark as processed
        processed[video["video_id"]] = {
            "title": video["title"],
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "channel": channel_key,
            "notebook": channel_config["notebook_name"],
            "file": str(filepath),
        }

        results.append({
            "video": video,
            "transcript_available": transcript is not None,
            "file": str(filepath),
            "notebook": channel_config["notebook_name"],
        })

    state["processed_videos"] = processed
    return results


def generate_summary(all_results):
    """Generate a summary of all scraped content."""
    summary = {
        "scrape_time": datetime.now(timezone.utc).isoformat(),
        "total_new_videos": len(all_results),
        "by_notebook": {},
    }

    for result in all_results:
        nb = result["notebook"]
        if nb not in summary["by_notebook"]:
            summary["by_notebook"][nb] = []
        summary["by_notebook"][nb].append({
            "title": result["video"]["title"],
            "url": result["video"]["url"],
            "transcript_available": result["transcript_available"],
            "file": result["file"],
        })

    return summary


def main():
    print("=" * 60)
    print("YouTube AI Influencer Scraper")
    print(f"Run time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    config = load_config()
    state = load_state()

    all_results = []

    for channel_key, channel_config in config["channels"].items():
        results = scrape_channel(channel_key, channel_config, state, config)
        all_results.extend(results)
        save_state(state)  # Save after each channel

    # Generate summary
    summary = generate_summary(all_results)
    summary_path = SCRIPT_DIR / "last_scrape_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n{'='*60}")
    print(f"SCRAPE COMPLETE")
    print(f"Total new videos processed: {summary['total_new_videos']}")
    for nb, vids in summary["by_notebook"].items():
        print(f"  {nb}: {len(vids)} new videos")
    print(f"Summary saved: {summary_path}")
    print(f"{'='*60}")

    # Print NotebookLM import instructions
    if all_results:
        print(f"\n📋 NOTEBOOKLM IMPORT INSTRUCTIONS:")
        print(f"{'='*60}")
        for nb_name in summary["by_notebook"]:
            nb_dir = Path(SCRIPT_DIR.parent) / config["notebooklm_export_dir"] / nb_name.replace(" ", "_")
            print(f"\n  Notebook: '{nb_name}'")
            print(f"  Files to upload: {nb_dir}/")
            print(f"  1. Open NotebookLM (notebooklm.google.com)")
            print(f"  2. Open or create notebook '{nb_name}'")
            print(f"  3. Click 'Add source' > 'Upload'")
            print(f"  4. Select the .md files from: {nb_dir}/")

    return summary


if __name__ == "__main__":
    main()
