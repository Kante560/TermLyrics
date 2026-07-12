from display import _format_time, _find_active_line, render_lyrics


def test_format_time():
    assert _format_time(0) == "0:00"
    assert _format_time(1000) == "0:01"
    assert _format_time(61000) == "1:01"
    assert _format_time(60000) == "1:00"
    assert _format_time(3661000) == "61:01"


def test_find_active_line_empty():
    assert _find_active_line(1000, []) == -1


def test_find_active_line_before_first():
    lyrics = [(1000, "a"), (2000, "b")]
    assert _find_active_line(500, lyrics) == -1


def test_find_active_line_exact_match():
    lyrics = [(1000, "a"), (2000, "b"), (3000, "c")]
    assert _find_active_line(1000, lyrics) == 0
    assert _find_active_line(2000, lyrics) == 1
    assert _find_active_line(3000, lyrics) == 2


def test_find_active_line_between():
    lyrics = [(1000, "a"), (3000, "b")]
    assert _find_active_line(2000, lyrics) == 0


def test_find_active_line_after_last():
    lyrics = [(1000, "a"), (2000, "b")]
    assert _find_active_line(9999, lyrics) == 1


def test_render_lyrics_no_lyrics():
    panel = render_lyrics(progress_ms=0, lyrics=None, synced=False, is_playing=True, status_message="Loading...")
    assert "Loading..." in str(panel.title)


def test_render_lyrics_unsynced():
    lyrics = [(0, "Hello"), (0, "World")]
    panel = render_lyrics(progress_ms=0, lyrics=lyrics, synced=False, is_playing=True, track_name="Song", artist="Artist")
    assert "Song" in str(panel.title)
    assert "Artist" in str(panel.title)
    assert "Unsynced" in panel.renderable


def test_render_lyrics_paused():
    panel = render_lyrics(progress_ms=0, lyrics=[(0, "test")], synced=True, is_playing=False, track_name="Song", artist="Artist")
    assert "Paused" in str(panel.title)


def test_render_lyrics_progress_bar():
    panel = render_lyrics(progress_ms=30000, lyrics=[(0, "test")], synced=False, is_playing=True, track_name="Song", artist="Artist", duration_ms=60000)
    rendered = str(panel.renderable)
    assert "0:30" in rendered
    assert "1:00" in rendered


def test_render_lyrics_active_line_highlight():
    lyrics = [(1000, "first"), (2000, "second"), (3000, "third")]
    panel = render_lyrics(progress_ms=2000, lyrics=lyrics, synced=True, is_playing=True, track_name="Song", artist="Artist")
    assert "second" in panel.renderable
