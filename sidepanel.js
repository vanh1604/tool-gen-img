// ============================================================
//  Flow Batch — sidepanel.js
//  Điều phối: đọc prompt -> gửi từng cái cho content.js trên
//  tab Flow -> nhận ảnh -> tải về -> nghỉ ngẫu nhiên -> lặp.
// ============================================================

const $ = (id) => document.getElementById(id);
const els = {
  prompts: $("prompts"),
  count: $("count"),
  loadTxt: $("loadTxt"),
  txtFile: $("txtFile"),
  folder: $("folder"),
  serial: $("serial"),
  delayMin: $("delayMin"),
  delayMax: $("delayMax"),
  start: $("start"),
  stop: $("stop"),
  queue: $("queue"),
  progress: $("progress"),
  pfill: $("pfill"),
  conn: $("conn"),
  connText: $("connText"),
};

let running = false;
let items = []; // [{prompt, status}]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Lưu / khôi phục cài đặt ----------
function saveSettings() {
  chrome.storage.local.set({
    prompts: els.prompts.value,
    folder: els.folder.value,
    serial: els.serial.checked,
    delayMin: els.delayMin.value,
    delayMax: els.delayMax.value,
  });
}
async function loadSettings() {
  const s = await chrome.storage.local.get();
  if (s.prompts != null) els.prompts.value = s.prompts;
  if (s.folder) els.folder.value = s.folder;
  if (s.serial != null) els.serial.checked = s.serial;
  if (s.delayMin != null) els.delayMin.value = s.delayMin;
  if (s.delayMax != null) els.delayMax.value = s.delayMax;
  refreshCount();
}

// ---------- Đếm prompt ----------
function parsePrompts() {
  return els.prompts.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
function refreshCount() {
  els.count.textContent = `${parsePrompts().length} prompt`;
}

// ---------- Tìm tab Google Flow ----------
async function getFlowTab() {
  // Tên miền mới: flow.google.com/project/...
  // Tên miền cũ: labs.google/fx/tools/flow HOẶC /fx/vi/tools/flow
  const tabs = await chrome.tabs.query({
    url: ["https://flow.google.com/*", "https://labs.google/fx/*"],
  });
  const isFlow = (u) =>
    /^https:\/\/flow\.google\.com\//.test(u) || /\/tools\/flow/.test(u);
  // ưu tiên tab đang mở một project, rồi tới tab Flow bất kỳ
  return (
    tabs.find((t) => isFlow(t.url || "") && /\/project\//.test(t.url || "")) ||
    tabs.find((t) => isFlow(t.url || "")) ||
    null
  );
}

// ---------- Gửi tin nhắn tới content script ----------
function sendToTab(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

// gửi cho background (nơi điều khiển chrome.debugger)
function sendToBg(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

// ---------- Kiểm tra kết nối ----------
async function checkConnection() {
  const tab = await getFlowTab();
  if (!tab) return setConn(false, "Hãy mở một project Google Flow");

  // thử ping
  let resp = await sendToTab(tab.id, { type: "PING" });

  // không thấy content script -> tự tiêm lại rồi ping lần nữa (tự chữa)
  if (!resp) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await new Promise((r) => setTimeout(r, 400));
      resp = await sendToTab(tab.id, { type: "PING" });
    } catch (e) {
      console.warn("[h2dev_flow] Không tiêm được content script:", e);
    }
  }

  if (!resp) return setConn(false, "Tải lại trang Flow (F5) rồi thử lại");
  // PING ok => coi như đã kết nối (lúc chạy bot sẽ focus để ô prompt hiện ra)
  if (resp.hasInput) setConn(true, "Đã kết nối với Google Flow");
  else setConn(true, "Đã kết nối (ô prompt sẽ nhận diện khi chạy)");
  return tab;
}
function setConn(on, text) {
  els.conn.className = "conn " + (on ? "conn--on" : "conn--off");
  els.connText.textContent = text;
}

// ---------- Vẽ hàng đợi ----------
function renderQueue() {
  els.queue.innerHTML = "";
  items.forEach((it, i) => {
    const li = document.createElement("li");
    li.className = "qitem " + it.status;
    li.innerHTML = `
      <span class="num">${i + 1}</span>
      <span class="txt">${escapeHtml(it.prompt)}</span>
      <span class="tag ${it.status}">${statusLabel(it.status)}</span>`;
    els.queue.appendChild(li);
  });
  const done = items.filter((i) => i.status === "done").length;
  const finished = items.filter((i) =>
    ["done", "error", "timeout"].includes(i.status)
  ).length;
  els.progress.textContent = items.length ? `${done}/${items.length} xong` : "—";
  if (els.pfill) {
    els.pfill.style.width = items.length
      ? Math.round((finished / items.length) * 100) + "%"
      : "0%";
  }
}
function statusLabel(s) {
  return {
    pending: "Chờ",
    generating: "Đang tạo",
    done: "Xong",
    error: "Lỗi",
    timeout: "Quá giờ",
  }[s] || s;
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// ---------- Tên file ----------
function safeName(s) {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50)
    .replace(/-+$/, "");
}
function buildFilename(serial, prompt) {
  const folder = safeName(els.folder.value || "h2dev_flow") || "h2dev_flow";
  const snippet = safeName(prompt) || "image";
  const num = els.serial.checked ? String(serial).padStart(3, "0") + "_" : "";
  return `${folder}/${num}${snippet}.png`;
}

// ---------- Tải ảnh ----------
async function downloadImage(src, serial, prompt, tabId) {
  let url = src;
  // blob: thì nhờ content script đổi sang dataURL
  if (!/^https?:/i.test(src)) {
    const r = await sendToTab(tabId, { type: "TODATAURL", src });
    if (r && r.dataUrl) url = r.dataUrl;
    else throw new Error("Không tải được ảnh blob");
  }
  await chrome.downloads.download({
    url,
    filename: buildFilename(serial, prompt),
    conflictAction: "uniquify",
    saveAs: false,
  });
}

// ---------- Delay ngẫu nhiên ----------
function randDelay() {
  const a = Math.max(0, parseInt(els.delayMin.value) || 0);
  const b = Math.max(a, parseInt(els.delayMax.value) || 0);
  return (a + Math.random() * (b - a)) * 1000;
}

// ---------- Vòng lặp chính ----------
async function run() {
  const tab = await checkConnection();
  if (!tab) return;

  const list = parsePrompts();
  if (list.length === 0) {
    setConn(false, "Chưa có prompt nào");
    return;
  }

  items = list.map((p) => ({ prompt: p, status: "pending" }));
  renderQueue();

  running = true;
  els.start.disabled = true;
  els.stop.disabled = false;

  for (let i = 0; i < items.length; i++) {
    if (!running) break;

    items[i].status = "generating";
    renderQueue();

    // 1) lấy toạ độ ô prompt từ content script (+ chụp baseline ảnh)
    const box = await sendToTab(tab.id, { type: "GET_BOX" });
    if (!running) { items[i].status = "pending"; break; }
    if (!box || !box.ok) {
      items[i].status = "error";
      if (box && box.error) setConn(false, box.error);
      renderQueue();
      continue;
    }

    // 2) GÕ CHỮ THẬT + Enter qua background (chrome.debugger)
    const typed = await sendToBg({
      type: "DEBUG_SUBMIT",
      tabId: tab.id,
      x: box.x,
      y: box.y,
      prompt: items[i].prompt,
    });
    if (!running) { items[i].status = "pending"; break; }
    if (!typed || !typed.ok) {
      items[i].status = "error";
      setConn(
        false,
        typed && typed.error
          ? "Lỗi debugger: " + typed.error + " (đóng DevTools F12 trên tab Flow rồi thử lại)"
          : "Không gõ được (hãy đóng DevTools F12 trên tab Flow)"
      );
      renderQueue();
      // không tiếp tục nếu debugger lỗi
      break;
    }

    // 3) chờ ảnh mới rồi tải
    const resp = await sendToTab(tab.id, { type: "WAIT_IMAGE" });
    if (!running) { items[i].status = "pending"; break; }

    if (resp && resp.ok && resp.src) {
      try {
        await downloadImage(resp.src, i + 1, items[i].prompt, tab.id);
        items[i].status = "done";
      } catch (e) {
        console.warn("Download lỗi:", e);
        items[i].status = "error";
      }
    } else if (resp && resp.timeout) {
      items[i].status = "timeout";
    } else {
      items[i].status = "error";
    }
    renderQueue();

    // nghỉ ngẫu nhiên trước prompt kế (trừ prompt cuối)
    if (i < items.length - 1 && running) {
      await sleep(randDelay());
    }
  }

  // xong hàng đợi -> tách debugger để thanh vàng biến mất
  await sendToBg({ type: "DEBUG_DETACH" });

  running = false;
  els.start.disabled = false;
  els.stop.disabled = true;
}

async function stop() {
  running = false;
  els.stop.disabled = true;
  const tab = await getFlowTab();
  if (tab) await sendToTab(tab.id, { type: "STOP" });
  await sendToBg({ type: "DEBUG_DETACH" });
}

// ---------- Sự kiện ----------
els.prompts.addEventListener("input", () => {
  refreshCount();
  saveSettings();
});
[els.folder, els.serial, els.delayMin, els.delayMax].forEach((el) =>
  el.addEventListener("change", saveSettings)
);
els.loadTxt.addEventListener("click", () => els.txtFile.click());
els.txtFile.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    els.prompts.value = reader.result;
    refreshCount();
    saveSettings();
  };
  reader.readAsText(f);
});
els.start.addEventListener("click", run);
els.stop.addEventListener("click", stop);

// ---------- Khởi động ----------
loadSettings();
checkConnection();
setInterval(checkConnection, 5000); // tự kiểm tra kết nối mỗi 5s
