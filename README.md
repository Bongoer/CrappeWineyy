# WineBox Web

WineBox Web runs a real experimental `wine64` environment in the browser. It uses the Boxedwine64 x86-64 interpreter, WebAssembly Memory64, Web Workers, SharedArrayBuffer, and WebGL2.

## Host it on GitHub Pages

1. Create an empty public GitHub repository.
2. Upload everything in this folder, including `.github`.
3. In the repository, open **Settings > Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the **Actions** tab and wait for **Build WineBox Web** to finish.

The first build compiles the browser engine, so it can take several minutes. Later builds use the Emscripten cache.

## Browser support

- Chrome or Edge is recommended.
- Firefox support depends on Memory64 availability in the installed version.
- Safari support is experimental.
- The first launch streams about 55 MB. The complete filesystem is about 196 MB.
- Simple native apps work best. Kernel drivers, anti-cheat, and many recent .NET apps won't work.
- Basic MSI installers are supported through Wine's `msiexec`, but installers that require services, drivers, or recent .NET versions may fail.
- Portable Python 3.12 is included at `C:\Python312`. Upload a `.py` file to run it.
- Multi-file upload accepts EXE, MSI, PY, DLL, and PYD companion files.
- Mobile controls include Standard, Gaming, and Compact keyboard layouts, a touch trackpad, visible cursor, mouse buttons, and pointer-speed settings.
- Mobile pointer movement is sent through a native SDL/XWire bridge instead of moving only a browser overlay.
- The runtime starts an 800x450 Wine desktop inside a visible XFCE-style host shell. The lower guest resolution makes menus and text larger while keeping the screen landscape.
- Boxedwine64's incomplete 5x7 fallback font is replaced at build time with Daniel Hepper's public-domain IBM VGA 8x8 font, preserving lowercase letters and punctuation.
- The runtime page is locked to the browser viewport. Its landscape desktop uses contain sizing in normal and fullscreen modes, so it cannot turn into an oversized portrait page.
- Wine and Boxedwine provide the browser-facing display, audio, keyboard, mouse, and network compatibility layers. Separate Windows kernel, USB, anti-cheat, and hardware drivers cannot be installed because there is no Windows kernel or direct hardware access.
- The visible panel, launcher, shortcuts, task button, clock, and window frame are a lightweight XFCE-style browser shell. A real XFCE or Openbox process cannot run because Boxedwine64 exposes a Wine userspace display rather than a complete Linux virtual machine and X server.

## Why this doesn't use v86

Stock v86 emulates a 32-bit x86 CPU and can't boot 64-bit kernels. Boxedwine64 emulates the 64-bit Linux userspace needed by Wine64 without booting a full guest kernel, which is a much better fit for this project.

## Updating the engine

The workflow pins a tested Boxedwine64 commit. To update it, replace the `ref` value in `.github/workflows/deploy-pages.yml` with a newer commit after testing it.

## License

The launcher files in this folder may be reused freely. The downloaded and compiled Boxedwine64 runtime is GPL-2.0. See the upstream project for its source and license:

https://github.com/andrewnakas/Boxedwine64

The core bitmap font is derived from Daniel Hepper's public-domain `font8x8` collection:

https://github.com/dhepper/font8x8
