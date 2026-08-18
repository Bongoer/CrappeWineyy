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

## Why this doesn't use v86

Stock v86 emulates a 32-bit x86 CPU and can't boot 64-bit kernels. Boxedwine64 emulates the 64-bit Linux userspace needed by Wine64 without booting a full guest kernel, which is a much better fit for this project.

## Updating the engine

The workflow pins a tested Boxedwine64 commit. To update it, replace the `ref` value in `.github/workflows/deploy-pages.yml` with a newer commit after testing it.

## License

The launcher files in this folder may be reused freely. The downloaded and compiled Boxedwine64 runtime is GPL-2.0. See the upstream project for its source and license:

https://github.com/andrewnakas/Boxedwine64
