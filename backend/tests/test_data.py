import hashlib
import json
import sqlite3
import xml.etree.ElementTree as ET

import pytest

from scripts.data import ROOT, build, validate_svg


def test_export_matches_committed_snapshot():
    build(check=True)
    assert hashlib.sha256((ROOT / 'speedflags.db').read_bytes()).hexdigest() == '2bf239b7ab787e0ff3ab63c862e0d8630bce047fae684247dc1df5d150b5adcb'
    with sqlite3.connect(f'file:{ROOT / "data/generated/countries.db"}?mode=ro', uri=True) as db:
        assert db.execute('SELECT count(*) FROM countries').fetchone()[0] == 250
        assert db.execute('SELECT count(DISTINCT asset) FROM countries').fetchone()[0] == 246
    manifest = json.loads((ROOT / 'data/generated/manifest.json').read_text())
    assert manifest['shared_groups'] == [['BV', 'NO', 'SJ'], ['FR', 'MF'], ['UM', 'US']]


@pytest.mark.parametrize('content', [
    '', 'undefined', '<html/>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 10"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 NaN 10"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.com/x"/></svg>',
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "x";</style></svg>',
])
def test_bad_assets_rejected(content):
    with pytest.raises((ValueError, ET.ParseError)):
        validate_svg(content)


def test_missing_viewport_is_added_without_changing_drawing():
    source = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><path d="M0 0h900v600z"/></svg>'
    assert 'viewBox="0 0 900 600"' in validate_svg(source)
    assert '<path d="M0 0h900v600z"/>' in validate_svg(source)
