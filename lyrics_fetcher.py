import os
import re
import unicodedata
from typing import Optional

import syncedlyrics

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")


def _sanitize_filename(name: str) -> str:
    name = unicodedata.normalize("NFKD", name)
    name = name.lower()
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"[\s_]+", "_", name)
    return name.strip("_") or "unknown"


def _cache_path(artist: str, track: str) -> str:
    key = f"{_sanitize_filename(artist)}_{_sanitize_filename(track)}"
    return os.path.join(CACHE_DIR, f"{key}.lrc")


def _parse_lrc(lrc_text: str) -> list[tuple[int, str]]:
    pattern = re.compile(r"\[(\d+):(\d+)(?:\.(\d+))?\](.*)")
    lines: list[tuple[int, str]] = []
    for line in lrc_text.splitlines():
        m = pattern.match(line.strip())
        if m:
            minutes = int(m.group(1))
            seconds = int(m.group(2))
            frac = m.group(3)
            if frac is None:
                frac_ms = 0
            elif len(frac) == 2:
                frac_ms = int(frac) * 10
            elif len(frac) == 3:
                frac_ms = int(frac)
            else:
                frac_ms = int(frac[:3])
            timestamp_ms = minutes * 60000 + seconds * 1000 + frac_ms
            text = m.group(4).strip()
            if text:
                lines.append((timestamp_ms, text))
    lines.sort(key=lambda x: x[0])
    return lines


def fetch_lyrics(
    track_name: str, artist: str
) -> tuple[Optional[list[tuple[int, str]]], bool]:
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_path = _cache_path(artist, track_name)

    # Try cache first
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            cached = f.read()
        parsed = _parse_lrc(cached)
        if parsed:
            return parsed, True

    # Search for synced lyrics
    search_term = f"{artist} {track_name}"
    lrc_text: Optional[str] = None
    try:
        lrc_text = syncedlyrics.search(search_term)
    except Exception:
        pass

    if lrc_text:
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(lrc_text)
        parsed = _parse_lrc(lrc_text)
        if parsed:
            return parsed, True
        # Return as unsynced if lrc had no timestamped lines
        plain_lines = [
            (0, line.strip())
            for line in lrc_text.strip().splitlines()
            if line.strip()
        ]
        if plain_lines:
            return plain_lines, False

    # Fallback: try plain-text lyrics
    plain_text: Optional[str] = None
    try:
        plain_text = syncedlyrics.search(
            search_term, synced_only=False, allow_plain_formats=True
        )
    except TypeError:
        pass
    except Exception:
        pass

    if plain_text:
        plain_clean = re.sub(r"\[\d+:\d+(?:\.\d+)?\]", "", plain_text).strip()
        lines = [
            (0, line.strip())
            for line in plain_clean.splitlines()
            if line.strip()
        ]
        if lines:
            return lines, False

    return None, False
