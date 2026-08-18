#!/usr/bin/env python3
import pathlib
import shutil
import sys


engine = pathlib.Path(sys.argv[1]).resolve()
overrides = pathlib.Path(__file__).resolve().parent
xwire = engine / "source" / "x11wire"
connection_path = xwire / "xwireconnection.cpp"

if not connection_path.exists():
    raise SystemExit(f"Boxedwine64 XWire source not found: {connection_path}")

shutil.copy2(overrides / "xwirefont.h", xwire / "xwirefont.h")
shutil.copy2(overrides / "font8x8_basic.h", xwire / "font8x8_basic.h")


def replace_required(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"Could not patch {label}: expected engine source was not found")
    return source.replace(old, new)


source = connection_path.read_text(encoding="utf-8")
source = replace_required(
    source,
    "putCharInfo(r + 8,  xwirefont::CELL_W, 6, 1);",
    "putCharInfo(r + 8,  xwirefont::CELL_W, xwirefont::FONT_ASCENT, xwirefont::FONT_DESCENT);",
    "minimum core-font metrics",
)
source = replace_required(
    source,
    "putCharInfo(r + 24, xwirefont::CELL_W, 6, 1);",
    "putCharInfo(r + 24, xwirefont::CELL_W, xwirefont::FONT_ASCENT, xwirefont::FONT_DESCENT);",
    "maximum core-font metrics",
)
source = replace_required(
    source,
    "int16_t fa = 6, fd = 1;",
    "int16_t fa = xwirefont::FONT_ASCENT, fd = xwirefont::FONT_DESCENT;",
    "core-font ascent and descent",
)
source = replace_required(
    source,
    "int top = baselineY - 6;",
    "int top = baselineY - xwirefont::FONT_ASCENT;",
    "core-font baseline",
)
source = replace_required(
    source,
    """            uint8_t gcol[5];
            xwirefont::glyphInto(c, gcol);
            for (int col = 0; col < 5; col++)
                for (int row = 0; row < 7; row++)
""",
    """            uint8_t gcol[xwirefont::GLYPH_W];
            xwirefont::glyphInto(c, gcol);
            for (int col = 0; col < xwirefont::GLYPH_W; col++)
                for (int row = 0; row < xwirefont::GLYPH_H; row++)
""",
    "8x8 core-font raster loop",
)
connection_path.write_text(source, encoding="utf-8")

print("Patched Boxedwine64 XWire with readable 8x8 core fonts")
