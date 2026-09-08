from __future__ import annotations

from PIL import Image, ImageDraw

from satquery.graph.geometry import change_mask, parse_boxes


def test_parse_boxes_bracket_fraction():
    boxes = parse_boxes("BOX: [0.1, 0.2, 0.5, 0.8]", width=100, height=100)
    assert boxes == [[0.1, 0.2, 0.5, 0.8]]


def test_parse_boxes_qwen_tag_and_0_1000_scale():
    raw = "<|box_start|>(100,200),(600,900)<|box_end|>"
    boxes = parse_boxes(raw, width=200, height=200)  # values > max dim -> 0-1000 scale
    assert len(boxes) == 1
    assert boxes[0] == [0.1, 0.2, 0.6, 0.9]


def test_parse_boxes_pixel_coords():
    boxes = parse_boxes("(10,20),(90,120)", width=100, height=200)
    assert boxes[0] == [0.1, 0.1, 0.9, 0.6]


def test_parse_boxes_none_and_degenerate():
    assert parse_boxes("", width=10, height=10) == []
    assert parse_boxes("NOT_FOUND", width=10, height=10) == []
    assert parse_boxes("[0.5, 0.5, 0.5, 0.5]", width=10, height=10) == []  # zero area


def test_change_mask_localises_a_painted_change(tmp_path):
    a = tmp_path / "t1.png"
    b = tmp_path / "t2.png"
    Image.new("RGB", (256, 256), (30, 120, 40)).save(a)
    later = Image.new("RGB", (256, 256), (30, 120, 40))
    ImageDraw.Draw(later).rectangle([120, 60, 210, 150], fill=(150, 130, 100))
    later.save(b)

    result = change_mask(a, b)
    assert 0.05 < result["changed_fraction"] < 0.30
    x1, y1, x2, y2 = result["change_bbox"]
    assert 0.4 < x1 < 0.55 and 0.75 < x2 < 0.90
    assert 0.20 < y1 < 0.30 and 0.55 < y2 < 0.65
    assert result["mask"].size == (256, 256)


def test_change_mask_no_change(tmp_path):
    a = tmp_path / "t1.png"
    b = tmp_path / "t2.png"
    Image.new("RGB", (128, 128), (40, 110, 60)).save(a)
    Image.new("RGB", (128, 128), (40, 110, 60)).save(b)
    result = change_mask(a, b)
    assert result["changed_fraction"] == 0.0
    assert result["change_bbox"] is None
