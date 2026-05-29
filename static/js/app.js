/* ================================================
   ThermoLabel — Frontend JS
   ================================================ */

let selectedFile = null;
let currentJobId = null;

// ── File Handling ──────────────────────────────

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const fileSelected = document.getElementById("file-selected");
const fileName = document.getElementById("file-name");

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("drag-over");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith(".pdf")) {
    setFile(file);
  } else {
    showToast("Apenas arquivos PDF são aceitos.");
  }
});

dropzone.addEventListener("click", (e) => {
  if (e.target === dropzone || e.target.classList.contains("drop-icon") ||
    e.target.classList.contains("drop-label")) {
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) {
    setFile(fileInput.files[0]);
  }
});

function setFile(file) {
  selectedFile = file;
  fileName.textContent = file.name;
  fileSelected.style.display = "flex";
  document.querySelector(".drop-icon").style.display = "none";
  document.querySelector(".drop-label").style.display = "none";
  document.querySelector(".drop-sub").style.display = "none";
}

function removeFile() {
  selectedFile = null;
  fileInput.value = "";
  fileSelected.style.display = "none";
  document.querySelector(".drop-icon").style.display = "block";
  document.querySelector(".drop-label").style.display = "block";
  document.querySelector(".drop-sub").style.display = "block";
}

// ── Presets ────────────────────────────────────

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".preset-btn").forEach((b) =>
      b.classList.remove("active")
    );
    btn.classList.add("active");

    document.getElementById("width_mm").value = btn.dataset.w;
    document.getElementById("height_mm").value = btn.dataset.h;
    document.getElementById("cols").value = btn.dataset.c;
    document.getElementById("rows").value = btn.dataset.r;
    updateSizePreview();
  });
});

// ── Size Preview ───────────────────────────────

function updateSizePreview() {
  const w = parseFloat(document.getElementById("width_mm").value) || 50;
  const h = parseFloat(document.getElementById("height_mm").value) || 25;

  const maxW = 180;
  const maxH = 90;
  const scale = Math.min(maxW / w, maxH / h, 2.5);

  const pxW = Math.max(w * scale, 40);
  const pxH = Math.max(h * scale, 20);

  const sizeVisual = document.getElementById("size-visual");
  sizeVisual.style.width = pxW + "px";
  sizeVisual.style.height = pxH + "px";

  document.getElementById("size-preview-text").textContent = `${w} × ${h} mm`;
}

["width_mm", "height_mm"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    updateSizePreview();
    // Deselect presets if custom values entered
    const w = document.getElementById("width_mm").value;
    const h = document.getElementById("height_mm").value;
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      if (btn.dataset.w == w && btn.dataset.h == h) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  });
});

// Initialize preview
updateSizePreview();

// ── Conversion ─────────────────────────────────

async function convertPDF() {
  if (!selectedFile) {
    showToast("Por favor, selecione um arquivo PDF primeiro.");
    return;
  }

  const widthMm = parseFloat(document.getElementById("width_mm").value);
  const heightMm = parseFloat(document.getElementById("height_mm").value);
  const cols = parseInt(document.getElementById("cols").value);
  const rows = parseInt(document.getElementById("rows").value);

  if (!widthMm || !heightMm || widthMm < 10 || heightMm < 10) {
    showToast("Dimensões inválidas. Mínimo 10mm.");
    return;
  }

  // Show progress
  const convertBtn = document.getElementById("convert-btn");
  const progressWrap = document.getElementById("progress-wrap");
  const progressFill = document.getElementById("progress-fill");
  const progressMsg = document.getElementById("progress-msg");
  const resultWrap = document.getElementById("result-wrap");
  const errorWrap = document.getElementById("error-wrap");

  convertBtn.disabled = true;
  progressWrap.style.display = "block";
  resultWrap.style.display = "none";
  errorWrap.style.display = "none";

  // Fake progress animation
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 15, 85);
    progressFill.style.width = progress + "%";
    if (progress < 30) progressMsg.textContent = "Lendo o PDF...";
    else if (progress < 60) progressMsg.textContent = "Recortando etiquetas...";
    else progressMsg.textContent = "Gerando PDF de saída...";
  }, 300);

  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("width_mm", widthMm);
  formData.append("height_mm", heightMm);
  formData.append("cols", cols);
  formData.append("rows", rows);

  try {
    const response = await fetch("/convert", {
      method: "POST",
      body: formData,
    });

    clearInterval(progressInterval);
    progressFill.style.width = "100%";
    progressMsg.textContent = "Concluído!";

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Erro desconhecido");
    }

    currentJobId = data.job_id;

    // Show result
    await delay(400);
    progressWrap.style.display = "none";
    resultWrap.style.display = "flex";

    document.getElementById("stat-labels").textContent = data.output_labels;
    document.getElementById("stat-size").textContent = data.label_size;

    // Setup download button
    const downloadBtn = document.getElementById("download-btn");
    downloadBtn.onclick = () => downloadResult();

  } catch (err) {
    clearInterval(progressInterval);
    progressWrap.style.display = "none";
    errorWrap.style.display = "flex";
    document.getElementById("error-msg").textContent = err.message || "Erro ao processar o arquivo.";
  } finally {
    convertBtn.disabled = false;
  }
}

function downloadResult() {
  if (!currentJobId) return;
  const a = document.createElement("a");
  a.href = `/download/${currentJobId}`;
  a.download = "etiquetas_termicas.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function resetApp() {
  removeFile();
  currentJobId = null;
  document.getElementById("result-wrap").style.display = "none";
  document.getElementById("progress-wrap").style.display = "none";
  document.getElementById("error-wrap").style.display = "none";
  document.getElementById("convert-btn").disabled = false;
}

function resetError() {
  document.getElementById("error-wrap").style.display = "none";
}

// ── Utils ──────────────────────────────────────

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function showToast(msg) {
  // Simple toast — create and remove
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #1a1a1a; border: 1px solid #e8ff47; color: #e8ff47;
    font-family: 'DM Mono', monospace; font-size: 0.8rem;
    padding: 10px 20px; border-radius: 4px; z-index: 9999;
    animation: fadeIn 0.2s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Entry animation ───────────────────────────

window.addEventListener("load", () => {
  const cards = document.querySelectorAll(".card, .hero, .info-card");
  cards.forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = `opacity 0.5s ease ${i * 0.08}s, transform 0.5s ease ${i * 0.08}s`;
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  });
});
