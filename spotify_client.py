import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyOAuth

load_dotenv()


@dataclass
class PlaybackData:
    track_name: str
    artist: str
    progress_ms: int
    duration_ms: int
    is_playing: bool
    track_id: str


class SpotifyClient:
    def __init__(self) -> None:
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        redirect_uri = os.getenv(
            "SPOTIFY_REDIRECT_URI",
            "http://127.0.0.1:8888/callback",
        )

        if not client_id or not client_secret:
            raise ValueError(
                "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env"
            )

        self.sp = spotipy.Spotify(
            auth_manager=SpotifyOAuth(
                client_id=client_id,
                client_secret=client_secret,
                redirect_uri=redirect_uri,
                scope="user-read-currently-playing user-read-playback-state",
                cache_path="./.spotipy_token_cache",
                open_browser=True,
            )
        )

    def get_current_playback(self) -> Optional[PlaybackData]:
        result = self.sp.current_user_playing_track()

        if result is None:
            return None

        item = result.get("item")
        if item is None:
            return None

        return PlaybackData(
            track_name=item.get("name", "Unknown Track"),
            artist=", ".join(a["name"] for a in item.get("artists", [])),
            progress_ms=result.get("progress_ms", 0),
            duration_ms=item.get("duration_ms", 0),
            is_playing=result.get("is_playing", False),
            track_id=item.get("id", ""),
        )
