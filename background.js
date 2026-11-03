// ============================================================
//  h2dev_flow — background service worker
//  Dùng chrome.debugger để GÕ CHỮ THẬT vào ô prompt (Slate),
//  Slate chỉ nhận sự kiện thật nên phải đi đường này.
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn("[h2dev_flow] setPanelBehavior:", e));
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let attachedTab = null;

// Nếu người dùng bấm Hủy thanh vàng -> debugger tự tách -> reset trạng thái
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId === attachedTab) {
    console.warn("[h2dev_flow] debugger bị tách khỏi tab", source.tabId);
    attachedTab = null;
  }
});

function sendCmd(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res);
    });
  });
}

async function ensureAttached(tabId) {
  if (attachedTab === tabId) return;
  if (attachedTab !== null) {
    try {
      await chrome.debugger.detach({ tabId: attachedTab });
    } catch (_) {}
    attachedTab = null;
  }
  await new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
  attachedTab = tabId;
}

async function detach() {
  if (attachedTab !== null) {
    try {
      await chrome.debugger.detach({ tabId: attachedTab });
    } catch (_) {}
    attachedTab = null;
  }
}

// Gõ prompt + Enter bằng input THẬT qua CDP
async function debugTypeAndSubmit(tabId, x, y, prompt) {
  await ensureAttached(tabId);

  // 1) click vào ô để đặt con trỏ (focus thật)
  await sendCmd(tabId, "Input.dispatchMouseEvent", {
    type: "mousePressed", x, y, button: "left", clickCount: 1,
  });
  await sendCmd(tabId, "Input.dispatchMouseEvent", {
    type: "mouseReleased", x, y, button: "left", clickCount: 1,
  });
  await wait(180);

  // 2) chọn hết (Ctrl+A) để xoá nội dung cũ nếu có
  await sendCmd(tabId, "Input.dispatchKeyEvent", {
    type: "keyDown", modifiers: 2, key: "a", code: "KeyA", windowsVirtualKeyCode: 65,
  });
  await sendCmd(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp", modifiers: 2, key: "a", code: "KeyA", windowsVirtualKeyCode: 65,
  });
  await wait(60);

  // 3) GÕ CHỮ THẬT — Slate nhận chuẩn 100%
  await sendCmd(tabId, "Input.insertText", { text: prompt });
  await wait(250);

  // 4) Enter để gửi (key thật)
  await sendCmd(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "Enter", code: "Enter",
    windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
  });
  await sendCmd(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp", key: "Enter", code: "Enter",
    windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "DEBUG_SUBMIT") {
    debugTypeAndSubmit(msg.tabId, msg.x, msg.y, msg.prompt)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }

  if (msg.type === "DEBUG_DETACH") {
    detach().then(() => sendResponse({ ok: true }));
    return true;
  }
});
