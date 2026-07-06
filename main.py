import signal
import sys
import time
from typing import Optional

import requests
from rich.live import Live
from rich.console import Console

from spotify_client import SpotifyClient
from lyrics_fetcher import fetch_lyrics
from display import render_lyrics

console = Console()
_running = True


def _handle_sigint(sig: int, frame) -> None:  # type: ignore[type-arg]
    global _running
    _running = False


def main() -> None:
    global _running
    signal.signal(signal.SIGINT, _handle_sigint)

    # -- initialise Spotify --
    try:
        spotify = SpotifyClient()
    except ValueError as exc:
        console.print(f"[red]Error:[/red] {exc}")
        sys.exit(1)

    # -- state --
    current_track_id: Optional[str] = None
    lyrics: Optional[list[tuple[int, str]]] = None
    synced = False
    track_name = ""
    artist = ""
    duration_ms = 0
    progress_ms = 0
    is_playing = False
    last_poll_time = 0.0
    status = ""

    initial_renderable = render_lyrics(
        progress_ms=0,
        lyrics=None,
        synced=False,
        is_playing=False,
        status_message="Connecting to Spotify…",
        track_name="",
        artist="",
        duration_ms=0,
    )

    with Live(initial_renderable, refresh_per_second=4) as live:
        while _running:
            now = time.monotonic()

            # -- poll Spotify every ~1 s --
            if now - last_poll_time >= 1.0:
                try:
                    playback = spotify.get_current_playback()
                    poll_time = time.monotonic()

                    if playback is None:
                        status = "Nothing playing"
                        if current_track_id is not None:
                            current_track_id = None
                            lyrics = None
                        progress_ms = 0
                        is_playing = False
                    else:
                        status = ""
                        if playback.track_id != current_track_id:
                            current_track_id = playback.track_id
                            track_name = playback.track_name
                            artist = playback.artist
                            duration_ms = playback.duration_ms
                            lyrics, synced = fetch_lyrics(track_name, artist)

                        progress_ms = playback.progress_ms
                        is_playing = playback.is_playing
                        last_poll_time = poll_time

                except requests.ConnectionError:
                    status = "Network error — retrying…"
                except Exception as exc:
                    status = f"Error: {exc}"

            # -- smooth interpolation between polls --
            estimated = progress_ms
            if is_playing and current_track_id is not None and not status.startswith("Error"):
                elapsed = time.monotonic() - last_poll_time
                estimated = progress_ms + int(elapsed * 1000)
                if duration_ms > 0:
                    estimated = min(estimated, duration_ms)

            # -- render --
            live.update(
                render_lyrics(
                    progress_ms=estimated,
                    lyrics=lyrics,
                    synced=synced,
                    is_playing=is_playing,
                    status_message=status or None,
                    track_name=track_name,
                    artist=artist,
                    duration_ms=duration_ms,
                )
            )

            time.sleep(0.25)

    console.print("[dim]TermLyrics closed.[/dim]")


if __name__ == "__main__":
    main()
