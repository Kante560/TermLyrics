from lyrics_fetcher import _sanitize_filename, _cache_path, _parse_lrc


def test_sanitize_filename_basic():
    result = _sanitize_filename("Hello World")
    assert result == "hello_world"


def test_sanitize_filename_special_chars():
    result = _sanitize_filename("Hello! @World#")
    assert result == "hello_world"


def test_sanitize_filename_unicode():
    result = _sanitize_filename("Café")
    assert "cafe" in result


def test_sanitize_filename_empty():
    result = _sanitize_filename("!!!")
    assert result == "unknown"


def test_parse_lrc_empty():
    assert _parse_lrc("") == []


def test_parse_lrc_single():
    lrc = "[00:05.00]Hello world"
    result = _parse_lrc(lrc)
    assert result == [(5000, "Hello world")]


def test_parse_lrc_multiple():
    lrc = "[00:01.00]First\n[00:05.50]Second\n[00:10.00]Third"
    result = _parse_lrc(lrc)
    assert result == [(1000, "First"), (5500, "Second"), (10000, "Third")]


def test_parse_lrc_unsorted():
    lrc = "[00:10.00]Later\n[00:01.00]Earlier"
    result = _parse_lrc(lrc)
    assert result == [(1000, "Earlier"), (10000, "Later")]


def test_parse_lrc_two_digit_frac():
    lrc = "[00:05.50]Fifty"
    result = _parse_lrc(lrc)
    assert result == [(5500, "Fifty")]


def test_parse_lrc_no_frac():
    lrc = "[00:05]No frac"
    result = _parse_lrc(lrc)
    assert result == [(5000, "No frac")]


def test_parse_lrc_empty_text_skipped():
    lrc = "[00:05.00]\n[00:10.00]Actual"
    result = _parse_lrc(lrc)
    assert result == [(10000, "Actual")]


def test_cache_path():
    path = _cache_path("Artist Name", "Song Title")
    assert path.endswith(".lrc")
    assert "artist_name" in path
    assert "song_title" in path
