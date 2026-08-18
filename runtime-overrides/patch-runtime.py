#!/usr/bin/env python3
import json
import os
import pathlib
import sys

runtime = pathlib.Path(sys.argv[1]).resolve()
html_path = runtime / "wine64.html"
launcher_path = runtime / "wine64-launcher.js"

html = html_path.read_text(encoding="utf-8")
css_marker = '<link rel="stylesheet" type="text/css" href="boxedwine.css">'
script_marker = '<script src="wine64-launcher.js"></script>'
if "winebox-runtime.css" not in html:
    html = html.replace(css_marker, css_marker + '\n    <link rel="stylesheet" href="winebox-runtime.css">')
if "winebox-runtime.js" not in html:
    html = html.replace(script_marker, '<script src="winebox-icons.js"></script>\n    <script src="winebox-runtime.js"></script>\n    ' + script_marker)
html_path.write_text(html, encoding="utf-8")

launcher = launcher_path.read_text(encoding="utf-8")

def replace_required(source, old, new, label):
    if new in source:
        return source
    if old not in source:
        raise RuntimeError(f"Could not patch {label}: expected launcher source was not found")
    return source.replace(old, new, 1)

# Always boot a fixed Explorer desktop first. Without this, the first small app
# becomes the XWire display owner and resizes the browser framebuffer to its own
# window, which produces the tall, stretched Notepad/Minesweeper screen.
launcher = replace_required(
    launcher,
    '    var DO_BOOT, NOVIDEO, PROG, USE_PREFIX, SESSION;\n',
    '''    var DO_BOOT, NOVIDEO, PROG, USE_PREFIX, SESSION;
    var REQUESTED_PROG = param("p");
    var DESKTOP_PROG = "explorer.exe /desktop=WineBox,800x450";
    var USE_DESKTOP_SHELL = param("desktop") !== "0" && param("boot") !== "1" && param("novideo") !== "1";
    var pendingDesktopProgram = USE_DESKTOP_SHELL && REQUESTED_PROG && REQUESTED_PROG !== DESKTOP_PROG
        ? REQUESTED_PROG : null;
''',
    "desktop session variables",
)
launcher = replace_required(
    launcher,
    '    applyRunConfig(param("p"), {\n',
    '    applyRunConfig(USE_DESKTOP_SHELL ? DESKTOP_PROG : REQUESTED_PROG, {\n',
    "desktop-first boot program",
)
launcher = replace_required(
    launcher,
    '            canvas.width = 800;\n            canvas.height = 600;\n',
    '            canvas.width = 800;\n            canvas.height = 450;\n',
    "landscape canvas size",
)

desktop_spawn = r'''    var sessionServerPinned = false;
    function spawnInsideDesktop(prog) {
        if (!prog || prog === DESKTOP_PROG) return true;
        if (!sessionReady()) {
            pendingDesktopProgram = prog;
            setStatusText("Desktop is still starting. " + prog + " is queued.");
            return true;
        }
        setStatusText("Opening " + prog + " on the Wine desktop...");
        return spawnArgv(wineProgArgv(prog), "desktop app: " + prog);
    }

'''
launcher = replace_required(
    launcher,
    '    var sessionServerPinned = false;\n',
    desktop_spawn,
    "desktop child launcher",
)
launcher = replace_required(
    launcher,
    '                    spawnArgv(wineProgArgv("Z:\\\\home\\\\username\\\\deskpin.exe"), "deskpin (hold desktop open)");\n',
    '''                    spawnArgv(wineProgArgv("Z:\\\\home\\\\username\\\\deskpin.exe"), "deskpin (hold desktop open)");
                    if (USE_DESKTOP_SHELL && pendingDesktopProgram) {
                        var queuedProgram = pendingDesktopProgram;
                        pendingDesktopProgram = null;
                        setTimeout(function () { spawnInsideDesktop(queuedProgram); }, 350);
                    }
''',
    "queued desktop app start",
)
launcher = replace_required(
    launcher,
    '        if (window.setActiveApp) try { window.setActiveApp(prog); } catch (e) {}\n        // In-session spawn when we can (default session mode, kernel up, real app).\n',
    '''        if (window.setActiveApp) try { window.setActiveApp(prog); } catch (e) {}
        if (USE_DESKTOP_SHELL && SESSION && !(opts && opts.boot) && prog && prog !== "--version") {
            if (spawnInsideDesktop(prog)) return;
        }
        // In-session spawn when we can (default session mode, kernel up, real app).
''',
    "desktop-aware app switching",
)
launcher = replace_required(
    launcher,
    '    if (window.setActiveApp) try { window.setActiveApp(PROG || "--version"); } catch (e) {}\n',
    '    if (window.setActiveApp) try { window.setActiveApp(REQUESTED_PROG || DESKTOP_PROG); } catch (e) {}\n',
    "active app marker",
)

launcher = launcher.replace('liveModule["ENV"]["BW64_GLTRACE"] = (param("gltrace") || "1")',
                            'liveModule["ENV"]["BW64_GLTRACE"] = (param("gltrace") || "0")')

module_marker = 'liveModule = (typeof Module !== "undefined") ? Module : window.Module;\n'
module_bridge = r'''
                window.wineboxNativeMouseMove = function (x, y, dx, dy, buttons) {
                    if (!liveModule || typeof liveModule.ccall !== "function") return false;
                    try {
                        liveModule.ccall("bw64_mobile_mouse_move", null,
                            ["number", "number", "number", "number", "number"],
                            [x, y, dx, dy, buttons]);
                        return true;
                    } catch (error) {
                        console.warn("Native mouse move bridge failed", error);
                        return false;
                    }
                };
                window.wineboxNativeMouseButton = function (down, button, x, y) {
                    if (!liveModule || typeof liveModule.ccall !== "function") return false;
                    try {
                        liveModule.ccall("bw64_mobile_mouse_button", null,
                            ["number", "number", "number", "number"],
                            [down ? 1 : 0, button, x, y]);
                        return true;
                    } catch (error) {
                        console.warn("Native mouse button bridge failed", error);
                        return false;
                    }
                };
'''
if "window.wineboxNativeMouseMove" not in launcher:
    launcher = launcher.replace(module_marker, module_marker + module_bridge)

upload_marker = "    window.uploadAndRunExe = uploadAndRunExe;\n"
upload_code = r'''

    // WineBox multi-file launcher. Supports a portable EXE with sibling DLLs,
    // a basic MSI through Wine's msiexec, and .py scripts through bundled Python.
    function uploadAndRunFiles(fileList) {
        var files = Array.prototype.slice.call(fileList || []);
        if (!files.length) return;
        if (!window.Module || !getFS()) {
            alert("Not ready yet - wait for the first app to finish booting, then try again.");
            return;
        }
        var total = files.reduce(function (sum, file) { return sum + file.size; }, 0);
        if (total > 384 * 1024 * 1024) {
            alert("Those files are too large for the browser sandbox. Keep the upload below 384 MB.");
            return;
        }
        // Keep uploaded companion files beside the EXE in the already-registered
        // Wine home directory. A newly-created subdirectory would not exist in
        // Boxedwine's cached guest VFS until the next boot.
        var root = HOME_IN_MEMFS;
        Promise.all(files.map(function (file) {
            var clean = (file.name || "uploaded.bin").replace(/[^A-Za-z0-9._-]/g, "_");
            return file.arrayBuffer().then(function (buffer) {
                var dest = root + "/" + clean;
                try { getFS().unlink(dest); } catch (e) {}
                getFS().writeFile(dest, new Uint8Array(buffer));
                callExport("bw64_register_file", ["string"], ["/home/username/" + clean]);
                return { name: clean, guest: "Z:\\home\\username\\" + clean };
            });
        })).then(function (saved) {
            var msi = saved.find(function (f) { return /\.msi$/i.test(f.name); });
            var py = saved.find(function (f) { return /\.py$/i.test(f.name); });
            var exe = saved.find(function (f) { return /\.exe$/i.test(f.name); });
            var prog = msi ? "msiexec.exe /i " + msi.guest :
                       py ? "C:\\Python312\\python.exe " + py.guest :
                       exe ? exe.guest : null;
            if (!prog) {
                alert("Files uploaded. Add an EXE, MSI, or PY file to launch them.");
                return;
            }
            if (window.launchApp) window.launchApp(prog);
            else window.location.search = "?p=" + encodeURIComponent(prog);
        }).catch(function (error) {
            console.error("uploadAndRunFiles failed", error);
            alert("Could not upload those files: " + error);
        });
    }
    window.uploadAndRunFiles = uploadAndRunFiles;
'''
if "window.uploadAndRunFiles" not in launcher:
    launcher = launcher.replace(upload_marker, upload_marker + upload_code)

launcher_path.write_text(launcher, encoding="utf-8")

# If Python was added to prefix64.zip, keep a one-part chunk manifest accurate.
prefix_path = runtime / "prefix64.zip"
manifest_path = runtime / "prefix64.zip.manifest.json"
if prefix_path.exists() and manifest_path.exists():
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    data["name"] = "prefix64.zip"
    data["parts"] = ["prefix64.zip"]
    data["totalBytes"] = prefix_path.stat().st_size
    manifest_path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
