const checks = {
  wasm: typeof WebAssembly === "object",
  memory: false,
  threads: typeof SharedArrayBuffer === "function",
  isolation: window.crossOriginIsolated === true,
};

try {
  const descriptor = { initial: 1, maximum: 1, index: "i64" };
  new WebAssembly.Memory(descriptor);
  checks.memory = true;
} catch (_) {
  checks.memory = false;
}

for (const [name, passed] of Object.entries(checks)) {
  const value = document.querySelector(`[data-check="${name}"] b`);
  if (!value) continue;
  value.textContent = passed ? "READY" : name === "isolation" ? "ON LAUNCH" : "MISSING";
  value.className = passed || name === "isolation" ? "pass" : "fail";
}

const hardRequirementsMet = checks.wasm && checks.memory;
const headerStatus = document.querySelector(".top-status");
const headerText = document.getElementById("header-status");
headerStatus.classList.add(hardRequirementsMet ? "ready" : "warning");
headerText.textContent = hardRequirementsMet ? "Browser ready" : "Compatibility warning";

const dialog = document.getElementById("compat-dialog");
let pendingProgram = "";

function runtimeUrl(program) {
  const url = new URL("./runtime/wine64.html", window.location.href);
  url.searchParams.set("chunked", "1");
  url.searchParams.set("lazy", "1");
  url.searchParams.set("gltrace", "0");
  if (program) url.searchParams.set("p", program);
  return url.href;
}

function launch(program) {
  window.location.href = runtimeUrl(program);
}

document.querySelectorAll("[data-launch]").forEach((button) => {
  button.addEventListener("click", () => {
    pendingProgram = button.dataset.launch || "";
    if (!hardRequirementsMet) {
      dialog.showModal();
      return;
    }
    launch(pendingProgram);
  });
});

document.getElementById("continue-anyway").addEventListener("click", (event) => {
  event.preventDefault();
  dialog.close();
  launch(pendingProgram);
});
