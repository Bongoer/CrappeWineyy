/*
 * Readable 8x8 core font for WineBox's XWire renderer.
 *
 * The glyph data in font8x8_basic.h is the public-domain IBM VGA font
 * collection published by Daniel Hepper. This replaces Boxedwine64's tiny
 * incomplete 5x7 fallback, which made Wine menus look like corrupted symbols.
 */

#ifndef __XWIREFONT_H__
#define __XWIREFONT_H__

#include <cstdint>
#include "font8x8_basic.h"

namespace xwirefont {

inline constexpr int GLYPH_W = 8;
inline constexpr int GLYPH_H = 8;
inline constexpr int CELL_W = 8;
inline constexpr int FONT_ASCENT = 7;
inline constexpr int FONT_DESCENT = 1;

inline void glyphInto(char c, uint8_t out[GLYPH_W]) {
    unsigned int code = static_cast<unsigned char>(c);
    if (code >= 128) code = static_cast<unsigned int>('?');
    for (int col = 0; col < GLYPH_W; col++) {
        uint8_t bits = 0;
        for (int row = 0; row < GLYPH_H; row++) {
            if (font8x8_basic[code][row] & (1u << col)) bits |= static_cast<uint8_t>(1u << row);
        }
        out[col] = bits;
    }
}

inline void drawText(uint32_t* fb, int width, int height, int x, int y,
                     const char* text, uint32_t color, int scale) {
    for (; *text; text++) {
        unsigned int code = static_cast<unsigned char>(*text);
        if (code >= 0x80) {
            while ((static_cast<unsigned char>(text[1]) & 0xc0) == 0x80) text++;
            code = static_cast<unsigned int>('?');
        }
        for (int row = 0; row < GLYPH_H; row++) {
            uint8_t rowBits = font8x8_basic[code][row];
            for (int col = 0; col < GLYPH_W; col++) {
                if (!(rowBits & (1u << col))) continue;
                for (int sy = 0; sy < scale; sy++) {
                    for (int sx = 0; sx < scale; sx++) {
                        int px = x + col * scale + sx;
                        int py = y + row * scale + sy;
                        if (px >= 0 && px < width && py >= 0 && py < height) {
                            fb[py * width + px] = color;
                        }
                    }
                }
            }
        }
        x += CELL_W * scale;
    }
}

} // namespace xwirefont

#endif
