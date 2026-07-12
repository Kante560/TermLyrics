from spotify_client import PlaybackData


def test_playback_data_dataclass():
    data = PlaybackData(
        track_name="Test Song",
        artist="Test Artist",
        progress_ms=1000,
        duration_ms=300000,
        is_playing=True,
        track_id="abc123",
    )
    assert data.track_name == "Test Song"
    assert data.artist == "Test Artist"
    assert data.progress_ms == 1000
    assert data.duration_ms == 300000
    assert data.is_playing is True
    assert data.track_id == "abc123"


def test_playback_data_mutable():
    data = PlaybackData(track_name="A", artist="B", progress_ms=0, duration_ms=0, is_playing=False, track_id="")
    data.is_playing = True
    assert data.is_playing is True
