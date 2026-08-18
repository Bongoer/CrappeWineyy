#if defined(__EMSCRIPTEN__) && defined(BOXEDWINE_GUEST_X64)

#include <SDL.h>
#include <emscripten/emscripten.h>
#include "../../x11wire/xwirepresent.h"

extern "C" {

EMSCRIPTEN_KEEPALIVE
void bw64_mobile_mouse_move(int x, int y, int xrel, int yrel, unsigned int buttons) {
    SDL_Event event = {};
    event.type = SDL_MOUSEMOTION;
    event.motion.x = x;
    event.motion.y = y;
    event.motion.xrel = xrel;
    event.motion.yrel = yrel;
    event.motion.state = buttons;
    xwireForwardSdlEvent(event);
}

EMSCRIPTEN_KEEPALIVE
void bw64_mobile_mouse_button(int down, int browserButton, int x, int y) {
    SDL_Event event = {};
    event.type = down ? SDL_MOUSEBUTTONDOWN : SDL_MOUSEBUTTONUP;
    event.button.state = down ? SDL_PRESSED : SDL_RELEASED;
    event.button.button = browserButton == 2 ? SDL_BUTTON_RIGHT :
                          browserButton == 1 ? SDL_BUTTON_MIDDLE : SDL_BUTTON_LEFT;
    event.button.x = x;
    event.button.y = y;
    xwireForwardSdlEvent(event);
}

}

#endif
