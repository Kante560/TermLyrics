from typing import Optional

from rich.panel import Panel


def _format_time(ms: int) -> str:
    total_seconds = ms // 1000
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes}:{seconds:02d}"


def _find_active_line(progress_ms: int, lyrics: list[tuple[int, str]]) -> int:
    if not lyrics:
        return -1
    lo, hi = 0, len(lyrics) - 1
    result = -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if lyrics[mid][0] <= progress_ms:
            result = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return result


def render_lyrics(
    progress_ms: int,
    lyrics: Optional[list[tuple[int, str]]],
    synced: bool,
    is_playing: bool = True,
    status_message: Optional[str] = None,
    track_name: str = "",
    artist: str = "",
    duration_ms: int = 0,
) -> Panel:
    # -- build title --
    if status_message:
        title = status_message
    elif track_name:
        title = f"{track_name} — {artist}"
    else:
        title = "TermLyrics"

    subtitle = ""
    if not is_playing and track_name and not status_message:
        subtitle = " ⏸ Paused"

    full_title = f"{title}{subtitle}"

    # -- build body --
    parts: list[str] = []

    if lyrics is None:
        parts.append("")
        parts.append("  No lyrics available")
        parts.append("")

    elif not synced:
        parts.append("")
        parts.append("[bright_black]── Unsynced lyrics ──[/bright_black]")
        for _, text in lyrics:
            parts.append(f"  {text}")
        parts.append("")

    else:
        active = _find_active_line(progress_ms, lyrics)

        # determine visible window
        lines_before = 2
        lines_after = 2

        if active < 0:
            vstart = 0
            vend = min(len(lyrics), lines_before + lines_after + 1)
        else:
            vstart = max(0, active - lines_before)
            vend = min(len(lyrics), active + lines_after + 1)

        # top padding
        for _ in range(2):
            parts.append("")

        # empty rows before visible block
        empty_before = max(0, lines_before - active) if active >= 0 else lines_before
        for _ in range(empty_before):
            parts.append("")

        # visible lyrics
        for i in range(vstart, vend):
            _, text = lyrics[i]
            if i == active:
                parts.append(f"[bold cyan]  ★ {text}  [/bold cyan]")
            elif i < active:
                parts.append(f"[bright_black]  {text}  [/bright_black]")
            else:
                parts.append(f"[bright_black]  {text}  [/bright_black]")

        # empty rows after visible block
        empty_after = (
            max(0, lines_after - (len(lyrics) - 1 - active))
            if active >= 0
            else lines_after
        )
        for _ in range(empty_after):
            parts.append("")

        # bottom padding
        for _ in range(2):
            parts.append("")

    body = "\n".join(parts)

    # -- progress bar --
    if duration_ms > 0:
        ratio = min(max(progress_ms / duration_ms, 0.0), 1.0)
        bar_w = 40
        filled = int(bar_w * ratio)
        bar = "█" * filled + "░" * (bar_w - filled)
        time_str = f"{_format_time(progress_ms)} / {_format_time(duration_ms)}"
        body += f"\n  {bar}  {time_str}"

    return Panel(
        body,
        title=full_title,
        title_align="left",
        border_style="bright_blue",
        padding=(0, 2),
    )
