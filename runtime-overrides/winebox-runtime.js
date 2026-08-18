(function () {
  "use strict";

  const I = window.WineboxIcons;
  const DESKTOP_WIDTH = 960;
  const DESKTOP_HEIGHT = 540;
  const DESKTOP_PROGRAM = `explorer.exe /desktop=WineBox,${DESKTOP_WIDTH}x${DESKTOP_HEIGHT}`;
  const qs = new URLSearchParams(location.search);
  const storage = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }
  };
  const state = {
    layout: storage.get("wbKeyboard", "gaming"),
    pointerSpeed: Number(storage.get("wbPointerSpeed", "1.2")),
    rendering: storage.get("wbRendering", "sharp"),
    displaySize: storage.get("wbDisplaySize", "fit"),
    performance: qs.get("perf") === "1" || storage.get("wbPerformance", "0") === "1",
    keyboardOpen: false,
    pointerMode: true,
    cursorX: null,
    cursorY: null,
    mouseButtons: 0,
  };
  if (!["smooth", "sharp"].includes(state.rendering)) state.rendering = "sharp";
  if (!["fit", "native", "zoom"].includes(state.displaySize)) state.displaySize = "fit";

  const icon = (name, cls) => I.icon(name, cls || "wb-icon");
  const appIcons = [
    [/notepad|wordpad/i, "file-text"], [/HxD/i, "binary"], [/clock/i, "clock"],
    [/winecfg|regedit|control/i, "settings"], [/winefile/i, "folder-open"],
    [/taskmgr/i, "chart"], [/glcube|d3dtri/i, "box"], [/winemine/i, "bomb"],
    [/snake|tetris|doom/i, "gamepad"], [/explorer/i, "desktop"]
  ];

  function appIcon(program) {
    const found = appIcons.find(([pattern]) => pattern.test(program || ""));
    return found ? found[1] : "monitor";
  }

  function launch(program) {
    let finalProgram = program;
    if (state.performance && /^doom\.exe\b/i.test(finalProgram) && !/-nosound\b/i.test(finalProgram)) finalProgram += " -nosound";
    if (window.launchApp) window.launchApp(finalProgram);
    else {
      const url = new URL(location.href);
      url.searchParams.set("p", finalProgram);
      location.href = url.href;
    }
  }

  function addRuntimeBar() {
    const bar = document.createElement("header");
    bar.id = "winebox-runtime-bar";
    bar.innerHTML = `
      <div class="wb-runtime-brand">
        <button class="wb-icon-button" id="wb-home" aria-label="Back to launcher">${icon("arrow-left")}</button>
        <div><strong>WineBox</strong><span> 64-bit session</span></div>
      </div>
      <div class="wb-runtime-actions">
        <button class="wb-action desktop-only" id="wb-console-toggle">${icon("monitor")}<span>Console</span></button>
        <button class="wb-icon-button" id="wb-fullscreen" aria-label="Fullscreen">${icon("maximize")}</button>
        <button class="wb-icon-button" id="wb-settings-open" aria-label="Settings">${icon("settings")}</button>
      </div>`;
    document.body.prepend(bar);
    document.getElementById("wb-home").onclick = () => location.href = "../";
    document.getElementById("wb-console-toggle").onclick = () => document.body.classList.toggle("wb-console-hidden");
    document.getElementById("wb-fullscreen").onclick = () => {
      const target = document.querySelector("div.emscripten_border") || document.getElementById("dropzone");
      if (!document.fullscreenElement) target?.requestFullscreen?.(); else document.exitFullscreen?.();
    };
  }

  function replaceIconsAndAddApps() {
    document.querySelectorAll(".appbtn").forEach((button) => {
      const holder = button.querySelector(".ico");
      if (holder) holder.innerHTML = icon(appIcon(button.dataset.prog));
      if (state.performance && /^doom\.exe\b/i.test(button.dataset.prog || "")) button.dataset.prog += " -nosound";
    });

    const firstRow = document.querySelector("#apps .approw");
    if (firstRow) {
      const desktop = document.createElement("button");
      desktop.type = "button";
      desktop.className = "appbtn";
      desktop.dataset.prog = DESKTOP_PROGRAM;
      desktop.innerHTML = `<span class="ico">${icon("desktop")}</span>Desktop`;
      desktop.onclick = () => launch(desktop.dataset.prog);
      firstRow.insertBefore(desktop, firstRow.children[1] || null);

      const python = document.createElement("button");
      python.type = "button";
      python.className = "appbtn";
      python.dataset.prog = "C:\\Python312\\python.exe --version";
      python.innerHTML = `<span class="ico">${icon("binary")}</span>Python`;
      python.onclick = () => launch(python.dataset.prog);
      firstRow.appendChild(python);
    }

    const toolbar = document.getElementById("toolbar");
    if (!toolbar) return;
    const buttons = toolbar.querySelectorAll("button");
    if (buttons[0]) buttons[0].innerHTML = `${icon("download")}<span>Download files</span>`;
    if (buttons[1]) buttons[1].innerHTML = `${icon("upload")}<span>Install or run files</span>`;
    if (buttons[2]) buttons[2].innerHTML = `${icon("copy")}<span>Copy</span>`;
    if (buttons[3]) buttons[3].innerHTML = `${icon("clipboard")}<span>Paste</span>`;

    const input = document.getElementById("exeUpload");
    if (input) {
      input.accept = ".exe,.msi,.py,.dll,.pyd,application/octet-stream";
      input.multiple = true;
      input.removeAttribute("onchange");
      input.addEventListener("change", () => {
        if (input.files?.length && window.uploadAndRunFiles) window.uploadAndRunFiles(input.files);
        else if (input.files?.[0] && window.uploadAndRunExe) window.uploadAndRunExe(input.files[0]);
        input.value = "";
      });
    }
  }

  function keyMeta(key) {
    const map = {
      ArrowUp: [38, "ArrowUp"], ArrowDown: [40, "ArrowDown"], ArrowLeft: [37, "ArrowLeft"], ArrowRight: [39, "ArrowRight"],
      Enter: [13, "Enter"], Escape: [27, "Escape"], Tab: [9, "Tab"], Backspace: [8, "Backspace"],
      " ": [32, "Space"], Shift: [16, "ShiftLeft"], Control: [17, "ControlLeft"], Alt: [18, "AltLeft"]
    };
    if (map[key]) return map[key];
    const upper = key.length === 1 ? key.toUpperCase() : key;
    return [upper.charCodeAt(0) || 0, key.length === 1 && /[a-z]/i.test(key) ? `Key${upper}` : key];
  }

  function emitKey(type, key) {
    const [codeNumber, code] = keyMeta(key);
    const event = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
    for (const prop of ["keyCode", "which", "charCode"]) {
      try { Object.defineProperty(event, prop, { get: () => type === "keypress" && prop === "charCode" ? codeNumber : codeNumber }); } catch (_) {}
    }
    window.dispatchEvent(event);
  }

  function tapKey(key) {
    emitKey("keydown", key);
    if (key.length === 1) emitKey("keypress", key);
    setTimeout(() => emitKey("keyup", key), 45);
  }

  const layouts = {
    standard: [["Esc", "Escape"], ["Tab", "Tab"], ["Ctrl", "Control"], ["Alt", "Alt"], ["←", "ArrowLeft"], ["↑", "ArrowUp"], ["↓", "ArrowDown"], ["→", "ArrowRight"], ["Enter", "Enter", "wide"], ["Back", "Backspace", "wide"], ["Space", " ", "space"], ["ABC", "native", "wide"]],
    compact: [["Esc", "Escape"], ["Tab", "Tab"], ["←", "ArrowLeft"], ["↑", "ArrowUp"], ["↓", "ArrowDown"], ["→", "ArrowRight"], ["Enter", "Enter", "wide"], ["Space", " ", "space"], ["ABC", "native", "wide"]],
    gaming: [["Esc", "Escape"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["Q", "q"], ["W", "w"], ["E", "e"], ["R", "r"], ["A", "a"], ["S", "s"], ["D", "d"], ["F", "f"], ["Shift", "Shift", "wide"], ["Ctrl", "Control", "wide"], ["Space", " ", "space"], ["Tab", "Tab"], ["Enter", "Enter"]]
  };

  function renderKeyboard() {
    const grid = document.getElementById("wb-key-grid");
    if (!grid) return;
    grid.innerHTML = "";
    (layouts[state.layout] || layouts.gaming).forEach(([label, key, cls]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `wb-key ${cls || ""}`;
      button.textContent = label;
      if (key === "native") button.onclick = () => document.getElementById("wb-native-input")?.focus();
      else {
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          button.classList.add("active");
          emitKey("keydown", key);
          if (key.length === 1) emitKey("keypress", key);
        });
        const up = () => { button.classList.remove("active"); emitKey("keyup", key); };
        button.addEventListener("pointerup", up);
        button.addEventListener("pointercancel", up);
      }
      grid.appendChild(button);
    });
  }

  function canvasDimensions(canvas) {
    return {
      width: Math.max(1, Number(canvas?.width) || DESKTOP_WIDTH),
      height: Math.max(1, Number(canvas?.height) || DESKTOP_HEIGHT)
    };
  }

  function dispatchMouse(type, button, buttons, dx = 0, dy = 0) {
    const canvas = document.getElementById("canvas");
    if (!canvas) return;
    const size = canvasDimensions(canvas);
    state.cursorX = Math.max(0, Math.min(size.width - 1, state.cursorX ?? size.width / 2));
    state.cursorY = Math.max(0, Math.min(size.height - 1, state.cursorY ?? size.height / 2));
    const x = Math.round(state.cursorX);
    const y = Math.round(state.cursorY);

    if (type === "mousemove" && window.wineboxNativeMouseMove?.(x, y, Math.round(dx), Math.round(dy), buttons)) return;
    if ((type === "mousedown" || type === "mouseup") && window.wineboxNativeMouseButton?.(type === "mousedown", button, x, y)) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + (x / size.width) * rect.width;
    const clientY = rect.top + (y / size.height) * rect.height;
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button, buttons });
    try {
      Object.defineProperty(event, "movementX", { get: () => Math.round(dx) });
      Object.defineProperty(event, "movementY", { get: () => Math.round(dy) });
    } catch (_) {}
    canvas.dispatchEvent(event);
  }

  function applyCanvasDisplay() {
    document.documentElement.dataset.wbDisplaySize = state.displaySize;
  }

  function installCursorAndTrackpad() {
    const border = document.querySelector("div.emscripten_border");
    const canvas = document.getElementById("canvas");
    if (!border || !canvas) return;
    const cursor = document.createElement("div");
    cursor.className = "winebox-cursor";
    cursor.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 2.5v22.7l5.8-5.2 4.4 9.3 4.5-2.2-4.3-9.1 7.6-.9L4 2.5Z"/></svg>';
    border.appendChild(cursor);

    function syncCanvasMetrics() {
      const size = canvasDimensions(canvas);
      state.cursorX = Math.max(0, Math.min(size.width - 1, state.cursorX ?? size.width / 2));
      state.cursorY = Math.max(0, Math.min(size.height - 1, state.cursorY ?? size.height / 2));
      paintCursor();
    }

    function paintCursor() {
      const size = canvasDimensions(canvas);
      const canvasRect = canvas.getBoundingClientRect();
      const borderRect = border.getBoundingClientRect();
      cursor.style.left = `${canvasRect.left - borderRect.left + ((state.cursorX ?? size.width / 2) / size.width) * canvasRect.width}px`;
      cursor.style.top = `${canvasRect.top - borderRect.top + ((state.cursorY ?? size.height / 2) / size.height) * canvasRect.height}px`;
    }
    syncCanvasMetrics();
    new MutationObserver(syncCanvasMetrics).observe(canvas, { attributes: true, attributeFilter: ["width", "height"] });
    if (window.ResizeObserver) new ResizeObserver(paintCursor).observe(canvas);
    window.addEventListener("resize", paintCursor);
    document.addEventListener("fullscreenchange", () => requestAnimationFrame(paintCursor));

    let last = null;
    let moved = false;
    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" || !state.pointerMode) return;
      event.preventDefault();
      last = { x: event.clientX, y: event.clientY };
      moved = false;
      canvas.setPointerCapture?.(event.pointerId);
    }, { passive: false });
    canvas.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      if (event.pointerType === "mouse") {
        const size = canvasDimensions(canvas);
        state.cursorX = Math.max(0, Math.min(size.width - 1, ((event.clientX - rect.left) / rect.width) * size.width));
        state.cursorY = Math.max(0, Math.min(size.height - 1, ((event.clientY - rect.top) / rect.height) * size.height));
        paintCursor();
        return;
      }
      if (!last || !state.pointerMode) return;
      event.preventDefault();
      const size = canvasDimensions(canvas);
      const dx = (event.clientX - last.x) * state.pointerSpeed * (size.width / rect.width);
      const dy = (event.clientY - last.y) * state.pointerSpeed * (size.height / rect.height);
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      state.cursorX = Math.max(0, Math.min(size.width - 1, (state.cursorX ?? size.width / 2) + dx));
      state.cursorY = Math.max(0, Math.min(size.height - 1, (state.cursorY ?? size.height / 2) + dy));
      last = { x: event.clientX, y: event.clientY };
      paintCursor();
      dispatchMouse("mousemove", 0, state.mouseButtons, dx, dy);
    }, { passive: false });
    canvas.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch" || !last) return;
      event.preventDefault();
      if (!moved) {
        state.mouseButtons |= 1;
        dispatchMouse("mousedown", 0, state.mouseButtons);
        setTimeout(() => {
          state.mouseButtons &= ~1;
          dispatchMouse("mouseup", 0, state.mouseButtons);
        }, 40);
      }
      last = null;
    }, { passive: false });
  }

  function addMobileUi() {
    const ui = document.createElement("div");
    ui.id = "winebox-mobile-ui";
    ui.innerHTML = `
      <div class="wb-mobile-launcher-sheet" id="wb-mobile-launcher-sheet" hidden></div>
      <div class="wb-keyboard-sheet" id="wb-keyboard-sheet" hidden><div class="wb-key-grid" id="wb-key-grid"></div></div>
      <div class="wb-mobile-dock">
        <button id="wb-mobile-apps" aria-label="Apps and files">${icon("monitor")}</button>
        <button id="wb-mobile-settings" aria-label="Settings">${icon("settings")}</button>
        <button id="wb-mobile-keyboard" aria-label="Keyboard">${icon("keyboard")}</button>
        <button id="wb-mobile-pointer" class="active" aria-label="Trackpad mode">${icon("mouse-pointer")}</button>
        <button id="wb-mobile-left" aria-label="Left mouse button">L</button>
        <button id="wb-mobile-right" aria-label="Right mouse button">R</button>
        <button id="wb-mobile-escape" aria-label="Escape key">Esc</button>
      </div>
      <input class="wb-native-input" id="wb-native-input" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false">`;
    document.body.appendChild(ui);
    renderKeyboard();
    const launcherSheet = document.getElementById("wb-mobile-launcher-sheet");
    const apps = document.getElementById("apps");
    const toolbar = document.getElementById("toolbar");
    const appsPlace = document.createComment("winebox apps position");
    const toolbarPlace = document.createComment("winebox toolbar position");
    apps?.before(appsPlace);
    toolbar?.before(toolbarPlace);
    const mobileQuery = window.matchMedia("(pointer: coarse), (max-width: 760px)");
    function placeMobilePanels() {
      if (mobileQuery.matches) {
        if (apps && apps.parentNode !== launcherSheet) launcherSheet.appendChild(apps);
        if (toolbar && toolbar.parentNode !== launcherSheet) launcherSheet.appendChild(toolbar);
      } else {
        if (apps && apps.parentNode === launcherSheet) appsPlace.after(apps);
        if (toolbar && toolbar.parentNode === launcherSheet) toolbarPlace.after(toolbar);
        launcherSheet.hidden = true;
        document.getElementById("wb-mobile-apps")?.classList.remove("active");
      }
    }
    placeMobilePanels();
    mobileQuery.addEventListener?.("change", placeMobilePanels);

    const sheet = document.getElementById("wb-keyboard-sheet");
    const keyboardButton = document.getElementById("wb-mobile-keyboard");
    const appsButton = document.getElementById("wb-mobile-apps");
    appsButton.onclick = () => {
      const opening = launcherSheet.hidden;
      launcherSheet.hidden = !opening;
      appsButton.classList.toggle("active", opening);
      if (opening && state.keyboardOpen) keyboardButton.click();
    };
    launcherSheet.addEventListener("click", (event) => {
      if (event.target.closest(".appbtn")) {
        launcherSheet.hidden = true;
        appsButton.classList.remove("active");
      }
    });
    keyboardButton.onclick = () => {
      state.keyboardOpen = !state.keyboardOpen;
      sheet.hidden = !state.keyboardOpen;
      keyboardButton.classList.toggle("active", state.keyboardOpen);
      if (state.keyboardOpen && !launcherSheet.hidden) appsButton.click();
    };
    document.getElementById("wb-mobile-settings").onclick = () => document.getElementById("wb-settings")?.showModal();
    document.getElementById("wb-mobile-pointer").onclick = (event) => {
      state.pointerMode = !state.pointerMode;
      event.currentTarget.classList.toggle("active", state.pointerMode);
    };
    for (const [id, button] of [["wb-mobile-left", 0], ["wb-mobile-right", 2]]) {
      const control = document.getElementById(id);
      const mask = button === 0 ? 1 : 2;
      control.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        state.mouseButtons |= mask;
        dispatchMouse("mousedown", button, state.mouseButtons);
        control.classList.add("active");
      });
      const up = () => {
        state.mouseButtons &= ~mask;
        dispatchMouse("mouseup", button, state.mouseButtons);
        control.classList.remove("active");
      };
      control.addEventListener("pointerup", up);
      control.addEventListener("pointercancel", up);
    }
    document.getElementById("wb-mobile-escape").onclick = () => tapKey("Escape");
    const nativeInput = document.getElementById("wb-native-input");
    nativeInput.addEventListener("input", () => {
      [...nativeInput.value].forEach((character) => tapKey(character));
      nativeInput.value = "";
    });
    nativeInput.addEventListener("keydown", (event) => {
      if (["Backspace", "Enter", "Tab", "Escape"].includes(event.key)) { event.preventDefault(); tapKey(event.key); }
    });
  }

  function addSettings() {
    const dialog = document.createElement("dialog");
    dialog.id = "wb-settings";
    dialog.className = "wb-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="wb-dialog-inner">
        <div class="wb-dialog-head"><h2>Controls and performance</h2><button class="wb-icon-button" value="cancel" aria-label="Close">${icon("x")}</button></div>
        <p>Choose the mobile keyboard, pointer feel, and rendering mode.</p>
        <div class="wb-setting"><label>Keyboard layout</label><div class="wb-segments">
          ${["standard", "gaming", "compact"].map(name => `<label><input type="radio" name="keyboard" value="${name}" ${state.layout === name ? "checked" : ""}><span>${icon(name === "gaming" ? "gamepad" : "keyboard")} ${name[0].toUpperCase() + name.slice(1)}</span></label>`).join("")}
        </div></div>
        <div class="wb-setting"><label for="wb-pointer-speed">Pointer speed</label><input class="wb-range" id="wb-pointer-speed" type="range" min="0.5" max="2.5" step="0.1" value="${state.pointerSpeed}"></div>
        <div class="wb-setting"><label>Image filtering</label><div class="wb-segments wb-segments-two">
          <label><input type="radio" name="rendering" value="smooth" ${state.rendering === "smooth" ? "checked" : ""}><span>Smooth</span></label>
          <label><input type="radio" name="rendering" value="sharp" ${state.rendering === "sharp" ? "checked" : ""}><span>Sharp</span></label>
        </div></div>
        <div class="wb-setting"><label>Display size</label><div class="wb-segments">
          <label><input type="radio" name="displaySize" value="fit" ${state.displaySize === "fit" ? "checked" : ""}><span>Fit</span></label>
          <label><input type="radio" name="displaySize" value="native" ${state.displaySize === "native" ? "checked" : ""}><span>100%</span></label>
          <label><input type="radio" name="displaySize" value="zoom" ${state.displaySize === "zoom" ? "checked" : ""}><span>150%</span></label>
        </div></div>
        <div class="wb-setting"><label class="wb-check"><input id="wb-performance" type="checkbox" ${state.performance ? "checked" : ""}> Performance mode</label><p>Disables runtime tracing and turns off DOOM audio to reduce emulator work.</p></div>
        <p class="wb-warning"><strong>Driver limit:</strong> Windows kernel drivers, anti-cheat, USB drivers, and hardware tools cannot run because this browser environment has no Windows kernel or direct hardware access.</p>
        <div class="wb-dialog-actions"><button class="wb-action" value="cancel">Cancel</button><button class="wb-action wb-primary" id="wb-settings-apply" value="default">Apply</button></div>
      </form>`;
    document.body.appendChild(dialog);
    document.getElementById("wb-settings-open").onclick = () => dialog.showModal();
    document.getElementById("wb-settings-apply").onclick = (event) => {
      event.preventDefault();
      state.layout = dialog.querySelector('input[name="keyboard"]:checked').value;
      state.rendering = dialog.querySelector('input[name="rendering"]:checked').value;
      state.displaySize = dialog.querySelector('input[name="displaySize"]:checked').value;
      state.pointerSpeed = Number(document.getElementById("wb-pointer-speed").value);
      const newPerf = document.getElementById("wb-performance").checked;
      storage.set("wbKeyboard", state.layout);
      storage.set("wbRendering", state.rendering);
      storage.set("wbDisplaySize", state.displaySize);
      storage.set("wbPointerSpeed", state.pointerSpeed);
      storage.set("wbPerformance", newPerf ? "1" : "0");
      document.documentElement.style.setProperty("--wb-rendering", state.rendering === "sharp" ? "pixelated" : "auto");
      applyCanvasDisplay();
      renderKeyboard();
      dialog.close();
      if (newPerf !== state.performance) {
        const url = new URL(location.href);
        url.searchParams.set("perf", newPerf ? "1" : "0");
        url.searchParams.set("gltrace", "0");
        url.searchParams.set("quiet", newPerf ? "1" : "0");
        location.href = url.href;
      }
    };
  }

  function init() {
    document.body.classList.add("wb-console-hidden");
    document.documentElement.style.setProperty("--wb-rendering", state.rendering === "sharp" ? "pixelated" : "auto");
    applyCanvasDisplay();
    addRuntimeBar();
    replaceIconsAndAddApps();
    addSettings();
    addMobileUi();
    installCursorAndTrackpad();
  }

  init();
})();
