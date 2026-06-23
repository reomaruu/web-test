let displayDate = new Date();
let selectedDateKey = "";
let rootDirectoryEntry = null;
let currentDirectoryEntry = null;
let currentEntriesList = [];
let currentInputPin = "";
let lockStatusMode = "auth";
let tempRegisteredPin = "";
let currentClockFont = "font-sf";

// ⏱️ 動的スタイル管理用変数
let dynamicClockSize = localStorage.getItem("clock_dyn_size") || "52";
let dynamicClockWeight = localStorage.getItem("clock_dyn_weight") || "300";
let memoryMemoBackup = {};

// 🌐 ブラウザナビゲーション＆進捗管理用オブジェクト
let browserProgressTimer = null;

// アクティブなiframeの読込進捗アニメーション
function simulateBrowserProgress() {
  const pBar = document.getElementById("browser-load-progress");
  if (!pBar) return;
  
  clearInterval(browserProgressTimer);
  pBar.style.opacity = "1";
  pBar.style.width = "0%";
  
  let currentProgress = 0;
  browserProgressTimer = setInterval(() => {
    if (currentProgress < 75) {
      currentProgress += Math.floor(Math.random() * 10) + 2;
    } else if (currentProgress < 92) {
      currentProgress += Math.floor(Math.random() * 3) + 0.5;
    }
    if (currentProgress > 95) currentProgress = 95;
    pBar.style.width = currentProgress + "%";
  }, 150);
}

function completeBrowserProgress() {
  const pBar = document.getElementById("browser-load-progress");
  if (!pBar) return;
  
  clearInterval(browserProgressTimer);
  pBar.style.width = "100%";
  setTimeout(() => {
    pBar.style.opacity = "0";
    setTimeout(() => { pBar.style.width = "0%"; }, 300);
  }, 200);
}

function getActiveBrowserIframe() {
  const target = document.getElementById("browser-iframes-target");
  if (!target) return null;
  const iframes = target.getElementsByTagName("iframe");
  for (let i = 0; i < iframes.length; i++) {
    if (iframes[i].style.display !== "none") {
      return iframes[i];
    }
  }
  return iframes[0] || null;
}

function updateBrowserNavButtons() {
  const activeIframe = getActiveBrowserIframe();
  const backBtn = document.getElementById("browser-back-btn");
  const forwardBtn = document.getElementById("browser-forward-btn");
  
  if (!activeIframe || !backBtn || !forwardBtn) return;
  
  backBtn.classList.add("active");
  forwardBtn.classList.add("active");
}

function goBackBrowserTab() {
  const iframe = getActiveBrowserIframe();
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.history.back();
    } catch(e) {
      iframe.contentWindow.postMessage('goBack', '*');
    }
    simulateBrowserProgress(); 
    setTimeout(completeBrowserProgress, 1200);
  }
}

function goForwardBrowserTab() {
  const iframe = getActiveBrowserIframe();
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.history.forward();
    } catch(e) {
      iframe.contentWindow.postMessage('goForward', '*');
    }
    simulateBrowserProgress();
    setTimeout(completeBrowserProgress, 1200);
  }
}

function attachBrowserLoadListeners(iframeElement) {
  if (!iframeElement) return;
  
  simulateBrowserProgress();
  updateBrowserNavButtons();
  
  iframeElement.addEventListener("load", () => {
    completeBrowserProgress();
    updateBrowserNavButtons();
    
    try {
      const currentUrl = iframeElement.contentWindow.location.href;
      const urlLabel = document.getElementById("browser-current-url");
      if (urlLabel) urlLabel.innerText = currentUrl;
    } catch(e) {}
  });
}

function onBrowserTabChanged() {
  updateBrowserNavButtons();
}

// Cordovaデバイス準備完了イベント
document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
  console.log("Cordova Ready! デバイス情報を環境に適用します。");
  
  if (window.cordova && cordova.plugins && cordova.plugins.notification) {
    cordova.plugins.notification.local.hasPermission(function (granted) {
      if (!granted) {
        cordova.plugins.notification.local.requestPermission(function(res) {
          console.log("Notification permission requested: " + res);
        });
      }
    });
  }

  // 実機デバイス情報の表示更新
  if (window.device) {
    if (document.getElementById('dev-model')) document.getElementById('dev-model').innerText = window.device.model || '不明なモデル';
    if (document.getElementById('dev-platform')) document.getElementById('dev-platform').innerText = window.device.platform || '不明なOS';
    if (document.getElementById('dev-version')) document.getElementById('dev-version').innerText = window.device.version || '不明なバージョン';
    if (document.getElementById('dev-cordova')) document.getElementById('dev-cordova').innerText = window.device.cordova || 'N/A';
    if (document.getElementById('dev-uuid')) document.getElementById('dev-uuid').innerText = window.device.uuid || '取得失敗';
  }

  if (window.cordova && cordova.file && cordova.file.dataDirectory) {
    window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(dirEntry) {
      rootDirectoryEntry = dirEntry;
      currentDirectoryEntry = dirEntry;
      fetchAllEntriesForSearch(); 
      if (document.getElementById('files-page').classList.contains('active')) renderFiles();
    }, function(e) { 
      fallbackFileSystem();
    });
  } else {
    fallbackFileSystem();
  }
}

function fallbackFileSystem() {
  if (window.requestFileSystem) {
    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fs) {
      rootDirectoryEntry = fs.root;
      currentDirectoryEntry = fs.root;
      fetchAllEntriesForSearch(); 
      if (document.getElementById('files-page').classList.contains('active')) renderFiles();
    }, function(e) { loadMemoryMemos(); });
  } else {
    loadMemoryMemos();
  }
}

function loadMemoryMemos() {
  try {
    const stored = localStorage.getItem("app_notes_backup_object");
    if(stored) memoryMemoBackup = JSON.parse(stored);
  } catch(e) { memoryMemoBackup = {}; }
  fetchAllEntriesForSearch();
  const filesPage = document.getElementById('files-page');
  if (filesPage && filesPage.classList.contains('active')) renderFiles();
}

function saveMemoryMemosToStorage() {
  localStorage.setItem("app_notes_backup_object", JSON.stringify(memoryMemoBackup));
  fetchAllEntriesForSearch();
}

// 画面読み込み時の初期化処理
window.onload = function() {
  if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'light'); 
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.checked = true;
  } else {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.checked = false;
  }
  
  applyAccentColor(localStorage.getItem('accentColor') || "#34c759");
  currentClockFont = localStorage.getItem('clockFontClass') || "font-sf";
  
  initDynamicClockSettings();
  applyClockStyle();

  if (document.getElementById('clock-font-selector')) document.getElementById('clock-font-selector').value = currentClockFont;

  const savedBg = localStorage.getItem('bgGradientClass') || "default";
  applyBgGradient(savedBg);
  if (document.getElementById('bg-gradient-selector')) document.getElementById('bg-gradient-selector').value = savedBg;

  const savedClockColor = localStorage.getItem('clockTextColor') || "";
  if (savedClockColor) changeClockTextColor(savedClockColor);

  try {
    const stored = localStorage.getItem("app_notes_backup_object");
    if(stored) memoryMemoBackup = JSON.parse(stored);
  } catch(e){}

  // ブラウザ環境用のモックデバイス情報初期設定
  if (!window.device) {
    if (document.getElementById('dev-model')) document.getElementById('dev-model').innerText = 'Webブラウザプレビュー';
    if (document.getElementById('dev-platform')) document.getElementById('dev-platform').innerText = navigator.platform || 'Browser';
    if (document.getElementById('dev-version')) document.getElementById('dev-version').innerText = '1.0.0';
    if (document.getElementById('dev-cordova')) document.getElementById('dev-cordova').innerText = 'N/A';
    if (document.getElementById('dev-uuid')) document.getElementById('dev-uuid').innerText = 'Browser-Mock-ID';
  }

  syncSecurityUIElements();
  checkSecurityLockOnInit();
  initHome();
  updateBatteryStatus(); 
  renderCalendar();
  setInterval(updateClock, 1000);
};

function updateClockFont(fontClass) {
  currentClockFont = fontClass;
  localStorage.setItem('clockFontClass', fontClass);
  applyClockStyle();
}

function applyClockStyle() {
  const clock = document.getElementById('clock-display');
  if (clock) {
    clock.className = `time-display ${currentClockFont}`;
    clock.style.fontSize = dynamicClockSize + "px";
    clock.style.fontWeight = dynamicClockWeight;
  }
}

function shareCalendarMemo() {
  const memoText = document.getElementById("memo-input").value;
  if (!memoText || !memoText.trim()) {
    alert("共有するメモが入力されていません。");
    return;
  }
  if (window.plugins && window.plugins.socialsharing) {
    window.plugins.socialsharing.share(memoText, `${selectedDateKey}のメモ`, null, null);
  } else {
    alert(`【メモ共有のプレビュー】\n件名: ${selectedDateKey}のメモ\n内容: ${memoText}`);
  }
}

function shareNativeFile(filename) {
  const plainName = filename.replace(".txt", "");
  const content = memoryMemoBackup[plainName] || "内容はありません。";
  if (window.plugins && window.plugins.socialsharing) {
    window.plugins.socialsharing.share(content, plainName, null, null);
  } else {
    alert(`【メモ共有】\nタイトル: ${plainName}\n内容: ${content}`);
  }
}

function scheduleNativeNotification(dateKey, memoText, timeStr) {
  if (!window.cordova || !cordova.plugins || !cordova.plugins.notification) return;
  
  const notificationId = hashDateKeyToInt(dateKey);
  cordova.plugins.notification.local.cancel(notificationId, function() {
    const toggle = document.getElementById("notify-toggle");
    const isNotifyEnabled = toggle ? toggle.checked : false;
    if (!isNotifyEnabled || !memoText.trim()) return;

    const [year, month, day] = dateKey.split("-").map(Number);
    const [hour, minute] = timeStr.split(":").map(Number);
    
    const targetDate = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (targetDate.getTime() <= new Date().getTime()) return;

    cordova.plugins.notification.local.schedule({
      id: notificationId,
      title: "📌 カレンダーメモのリマインダー",
      text: memoText.length > 50 ? memoText.substring(0, 50) + "..." : memoText,
      trigger: { at: targetDate },
      foreground: true,
      sound: true,
      vibrate: true
    });
  });
}

function hashDateKeyToInt(dateKey) {
  return parseInt(dateKey.replace(/-/g, ""), 10);
}

function selectDate(key) {
  selectedDateKey = key;
  renderCalendar();
  document.getElementById("selected-date-label").innerText = `${key} のメモ`;
  document.getElementById("memo-input").value = localStorage.getItem(key) || "";
  document.getElementById("notify-time").value = localStorage.getItem(key + "_notify_time") || "09:00";
  
  const toggle = document.getElementById("notify-toggle");
  if (toggle) toggle.checked = localStorage.getItem(key + "_notify_active") === "true";
}

function saveMemo() {
  const val = document.getElementById("memo-input").value;
  const timeStr = document.getElementById("notify-time").value;
  const toggle = document.getElementById("notify-toggle");
  const isNotifyActive = toggle ? toggle.checked : false;
  if (!selectedDateKey) return;

  if (val.trim() === "") {
    localStorage.removeItem(selectedDateKey);
    localStorage.removeItem(selectedDateKey + "_notify_time");
    localStorage.removeItem(selectedDateKey + "_notify_active");
  } else {
    localStorage.setItem(selectedDateKey, val);
    localStorage.setItem(selectedDateKey + "_notify_time", timeStr);
    localStorage.setItem(selectedDateKey + "_notify_active", isNotifyActive);
  }

  if(selectedDateKey === formatDateKey(new Date())) {
    document.getElementById("today-memo-display").innerText = val.trim() === "" ? "予定はありません。" : val;
  }
  renderCalendar();
  scheduleNativeNotification(selectedDateKey, val, timeStr);
  alert("予定と通知設定を保存しました。");
}

// 🔋 バッテリー情報を取得してUIを更新
function updateBatteryStatus() {
  if (navigator.getBattery) {
    navigator.getBattery().then(function(battery) {
      function updateAllBatteryInfo() {
        const level = Math.floor(battery.level * 100);
        const levelText = document.getElementById("battery-level-text");
        const progressBar = document.getElementById("battery-progress-bar");
        const statusText = document.getElementById("battery-status-text");
        
        if (levelText) levelText.innerText = level + "%";
        if (progressBar) progressBar.style.width = level + "%";
        if (statusText) {
          statusText.innerText = battery.charging ? "バッテリー (充電中)" : "バッテリー";
        }
      }
      updateAllBatteryInfo();
      battery.onlevelchange = updateAllBatteryInfo;
      battery.onchargingchange = updateAllBatteryInfo;
    });
  } else {
    const statusText = document.getElementById("battery-status-text");
    if (statusText) statusText.innerText = "バッテリー環境 (常時100%)";
    const levelText = document.getElementById("battery-level-text");
    if (levelText) levelText.innerText = "100%";
    const progressBar = document.getElementById("battery-progress-bar");
    if (progressBar) progressBar.style.width = "100%";
  }
}

function initHome() {
  const today = new Date();
  const dateLabel = document.getElementById("home-date-label");
  if (dateLabel) {
    dateLabel.innerText = today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }
  const todayKey = formatDateKey(today);
  const memoDisp = document.getElementById("today-memo-display");
  if (memoDisp) {
    memoDisp.innerText = localStorage.getItem(todayKey) || "予定はありません。";
  }
  updateClock();
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const clock = document.getElementById('clock-display');
  if (clock) clock.innerText = `${h}:${m}`;
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  
  const targetPage = document.getElementById(pageId);
  if (targetPage) targetPage.classList.add('active');
  
  if (pageId === 'home-page') { 
    if (document.getElementById('tab-home')) document.getElementById('tab-home').classList.add('active'); 
    initHome(); 
    updateBatteryStatus(); 
  }
  if (pageId === 'calendar-page') { 
    if (document.getElementById('tab-calendar')) document.getElementById('tab-calendar').classList.add('active'); 
    renderCalendar(); 
  }
  if (pageId === 'search-page') {
    if (document.getElementById('tab-search')) document.getElementById('tab-search').classList.add('active');
  }
  if (pageId === 'files-page') { 
    if (document.getElementById('tab-files')) document.getElementById('tab-files').classList.add('active'); 
    renderFiles(); 
  }
  if (pageId === 'settings-page') { 
    if (document.getElementById('tab-settings')) document.getElementById('tab-settings').classList.add('active'); 
    initDynamicClockSettings(); 
  }
}

function initDynamicClockSettings() {
  let clockEl = document.getElementById("clock-display");
  if(!clockEl) return;
  
  clockEl.style.fontSize = dynamicClockSize + "px";
  clockEl.style.fontWeight = dynamicClockWeight;
  
  let szSlider = document.getElementById("clock-size-slider");
  let wtSlider = document.getElementById("clock-weight-slider");
  if(szSlider) szSlider.value = dynamicClockSize;
  if(wtSlider) wtSlider.value = dynamicClockWeight;
  
  let szVal = document.getElementById("clock-size-val");
  let wtVal = document.getElementById("clock-weight-val");
  if(szVal) szVal.innerText = dynamicClockSize + "px";
  if(wtVal) wtVal.innerText = dynamicClockWeight;
}

function changeClockSizeDynamic(val) {
  dynamicClockSize = val;
  let clockEl = document.getElementById("clock-display");
  if(clockEl) clockEl.style.fontSize = val + "px";
  
  let indicator = document.getElementById("clock-size-val");
  if(indicator) indicator.innerText = val + "px";
  localStorage.setItem("clock_dyn_size", val);
}

function changeClockWeightDynamic(val) {
  dynamicClockWeight = val;
  let clockEl = document.getElementById("clock-display");
  if(clockEl) clockEl.style.fontWeight = val;
  
  let indicator = document.getElementById("clock-weight-val");
  if(indicator) indicator.innerText = val;
  localStorage.setItem("clock_dyn_weight", val);
}

document.addEventListener("DOMContentLoaded", initDynamicClockSettings);

function toggleTheme() {
  if (document.body.classList.contains('dark-theme')) {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    localStorage.setItem('theme', 'light');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    localStorage.setItem('theme', 'dark');
  }
}

function onCustomColorInput(color) {
  applyAccentColor(color);
  localStorage.setItem('accentColor', color);
}

function applyAccentColor(color) {
  document.documentElement.style.setProperty('--accent-color', color);
  const indicator = document.getElementById('custom-color-indicator');
  if (indicator) indicator.style.setProperty('background', color, 'important');
  const pickerInput = document.getElementById('custom-color-picker');
  if (pickerInput) pickerInput.value = color;
}

function changeAccentColor(color, element) {
  applyAccentColor(color);
  localStorage.setItem('accentColor', color);
}

function changeClockTextColor(color) {
  document.documentElement.style.setProperty('--clock-text-color', color);
  localStorage.setItem('clockTextColor', color);
  
  const indicator = document.getElementById('clock-color-indicator');
  if (indicator) indicator.style.setProperty('background', color, 'important');
  const pickerInput = document.getElementById('clock-color-picker');
  if (pickerInput) pickerInput.value = color;
}

function changeBgGradient(className) {
  applyBgGradient(className);
  localStorage.setItem('bgGradientClass', className);
}

function applyBgGradient(className) {
  document.body.classList.remove('bg-nitro-chroma', 'bg-nitro-sunset', 'bg-nitro-cosmic', 'bg-nitro-mint', 'bg-nitro-bubblegum');
  if (className !== 'default') document.body.classList.add(className);
}

function renderCalendar() {
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const monthYearLabel = document.getElementById("current-month-year");
  if (monthYearLabel) monthYearLabel.innerText = `${year}年 ${month + 1}月`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const body = document.getElementById("calendar-body");
  if (!body) return;
  body.innerHTML = "";

  let d = 1;
  const today = new Date();

  for (let i = 0; i < 6; i++) {
    let r = document.createElement("tr");
    let has = false;
    for (let j = 0; j < 7; j++) {
      let c = document.createElement("td");
      if (i === 0 && j < firstDay) {
        // 空白セル
      } else if (d > daysInMonth) {
        // 月末以降
      } else {
        has = true;
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        c.innerHTML = `<span class="date-number">${d}</span>`;
        
        if (localStorage.getItem(key)) {
          let dot = document.createElement("div");
          dot.style.cssText = "width:4px; height:4px; background:var(--accent-color); border-radius:50%; position:absolute; bottom:6px; left:50%; transform:translateX(-50%); z-index:3;";
          c.appendChild(dot);
        }

        if (j === 0) c.style.color = "#ff3b30";
        if (j === 6) c.style.color = "#007af5";
        if (new Date(year, month, d).toDateString() === today.toDateString()) c.classList.add("today");
        if (key === selectedDateKey) c.classList.add("selected");
        
        c.onclick = ((k) => () => selectDate(k))(key);
        d++;
      }
      r.appendChild(c);
    }
    if (has) body.appendChild(r);
  }
}

function prevMonth() { displayDate.setMonth(displayDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { displayDate.setMonth(displayDate.getMonth() + 1); renderCalendar(); }
function formatDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function menuAction(t) { 
  if(t == 'file') {
    openEditorForCreate();
  }
}

function renderFiles() {
  let grid = document.getElementById("file-grid-system");
  if (!grid) return;
  grid.innerHTML = "";
  
  const keys = Object.keys(memoryMemoBackup);
  
  if(keys.length === 0) {
    grid.innerHTML = `<div style="text-align:center; padding-top:40px; color:var(--sub-text); font-size:14px; font-weight:600;">ノートがありません</div>`;
    return;
  }
  
  keys.forEach(function(keyName) {
    let textContent = memoryMemoBackup[keyName] || "";
    
    let item = document.createElement("div");
    item.className = "file-item";
    item.onclick = function() { openEditorForEdit(keyName); };
    
    let infoBlock = document.createElement("div");
    infoBlock.className = "file-info-block";
    
    let iconDiv = document.createElement("div");
    iconDiv.className = "file-icon";
    iconDiv.innerHTML = `<svg class="system-icon-svg" style="width:28px; height:28px; fill:none; stroke:var(--accent-color); stroke-width:2;" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    
    let textGroup = document.createElement("div");
    textGroup.className = "file-text-group";
    textGroup.style.cssText = "display:inline-block; margin-left:8px; vertical-align:top; max-width:70%;";
    
    let nameDiv = document.createElement("div");
    nameDiv.className = "file-name";
    nameDiv.innerText = keyName;
    
    let previewDiv = document.createElement("div");
    previewDiv.className = "file-preview-text";
    previewDiv.style.cssText = "font-size:11px; opacity:0.6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
    previewDiv.innerText = textContent.trim() ? textContent : "内容なし";
    
    textGroup.appendChild(nameDiv);
    textGroup.appendChild(previewDiv);
    infoBlock.appendChild(iconDiv);
    infoBlock.appendChild(textGroup);
    
    let actionsGroup = document.createElement("div");
    actionsGroup.className = "file-actions-group";
    actionsGroup.style.cssText = "display:flex; gap:8px; align-items:center; margin-top:6px;";
    
    let shareBtn = document.createElement("div");
    shareBtn.className = "file-share-btn";
    shareBtn.style.cursor = "pointer";
    shareBtn.innerHTML = `<svg class="file-share-icon" style="width:16px; height:16px; fill:none; stroke:var(--sub-text); stroke-width:2;" viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"></polyline><line x1="10" y1="14" x2="21" y2="3"></line><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path></svg>`;
    shareBtn.onclick = function(e) { e.stopPropagation(); shareNativeFile(keyName); };
    
    let delBtn = document.createElement("button");
    delBtn.className = "file-delete-btn";
    delBtn.style.cssText = "background:transparent; border:none; color:#ff3b30; font-size:16px; font-weight:700; cursor:pointer;";
    delBtn.innerText = "×";
    delBtn.onclick = function(e) { e.stopPropagation(); deleteEntryConfirm(keyName); };
    
    actionsGroup.appendChild(shareBtn);
    actionsGroup.appendChild(delBtn);
    
    item.appendChild(infoBlock);
    item.appendChild(actionsGroup);
    grid.appendChild(item);
  });
}

function updateBreadcrumb() {
  let bc = document.getElementById("file-breadcrumb");
  if (bc) bc.innerHTML = `位置: <span onclick="navToRoot()">メモ</span>`;
}

function navToRoot() {
  updateBreadcrumb();
  renderFiles();
}

function deleteEntryConfirm(keyName) {
  if(confirm(`「${keyName}」を完全に削除しますか？`)) {
    delete memoryMemoBackup[keyName];
    saveMemoryMemosToStorage();
    renderFiles();
    
    if(currentDirectoryEntry && typeof currentDirectoryEntry.getFile === 'function') {
      currentDirectoryEntry.getFile(keyName + ".txt", { create: false }, function(fileEntry) {
        fileEntry.remove(function(){}, function(e){});
      }, function(e){});
    }
  }
}

let editingKeyName = null;
function openEditorForCreate() {
  editingKeyName = null;
  document.getElementById("editor-view-title").innerText = "新規ノート作成";
  document.getElementById("editor-filename").value = "";
  document.getElementById("editor-filename").disabled = false;
  document.getElementById("editor-content").value = "";
  document.getElementById("text-editor").style.display = "flex";
}

function openEditorForEdit(keyName) {
  editingKeyName = keyName;
  document.getElementById("editor-view-title").innerText = "詳細・編集";
  document.getElementById("editor-filename").value = keyName;
  document.getElementById("editor-filename").disabled = true;
  document.getElementById("editor-content").value = memoryMemoBackup[keyName] || "";
  document.getElementById("text-editor").style.display = "flex";
}

function closeEditor(save) {
  if(!save) {
    document.getElementById("text-editor").style.display = "none";
    return;
  }
  let filename = document.getElementById("editor-filename").value.trim();
  let content = document.getElementById("editor-content").value;
  if(!filename) { alert("タイトルを入力してください。"); return; }
  
  if(editingKeyName) {
    memoryMemoBackup[editingKeyName] = content;
  } else {
    memoryMemoBackup[filename] = content;
  }
  saveMemoryMemosToStorage();
  
  if(currentDirectoryEntry && typeof currentDirectoryEntry.getFile === 'function') {
    let nativeName = (editingKeyName ? editingKeyName : filename) + ".txt";
    currentDirectoryEntry.getFile(nativeName, { create: true }, function(fileEntry) {
      fileEntry.createWriter(function(writer) {
        let blob = new Blob([content], { type: 'text/plain' });
        writer.write(blob);
      });
    }, function(e){});
  }

  document.getElementById("text-editor").style.display = "none";
  renderFiles();
}

function handleFileImport(event) {
  let file = event.target.files[0];
  if(!file) return;
  let name = file.name.replace(".txt", "");
  let reader = new FileReader();
  reader.onload = function(e) {
    memoryMemoBackup[name] = e.target.result;
    saveMemoryMemosToStorage();
    renderFiles();
    alert("インポートが完了しました");
  };
  reader.readAsText(file);
}

function executeWebSearch() {
  let q = document.getElementById("web-search-query").value;
  if(!q || !q.trim()) return;
  
  let targetUrl = "";
  if (q.trim().startsWith('http://') || q.trim().startsWith('https://')) {
    targetUrl = q.trim();
  } else {
    targetUrl = "https://www.google.com/search?q=" + encodeURIComponent(q.trim());
  }
  
  let options = [
    "location=yes",
    "toolbar=yes",
    "toolbarposition=bottom",
    "closebuttoncaption=完了",
    "closebuttoncolor=#007aff",
    "navigationbuttoncolor=#007aff",
    "enableViewportScale=yes",
    "hidesecureurl=no",
    "presentationstyle=formsheet",
    "viewportfit=cover"
  ].join(",");
  
  if (window.cordova && cordova.InAppBrowser) {
    cordova.InAppBrowser.open(targetUrl, '_blank', options);
  } else {
    window.open(targetUrl, '_blank');
  }
}

function closeWebSearchTab() {}

function fetchAllEntriesForSearch() {
  currentEntriesList = [];
  Object.keys(memoryMemoBackup).forEach(key => {
    currentEntriesList.push({ name: key, isDirectory: false });
  });
}

function executeInAppSearch(query) {
  let out = document.getElementById("search-results-output");
  if (!out) return;
  out.innerHTML = "";
  if(!query || !query.trim()) return;
  let q = query.toLowerCase().trim();
  
  let filtered = currentEntriesList.filter(e => e.name.toLowerCase().includes(q));
  if(filtered.length === 0) {
    out.innerHTML = `<div style="font-size:13px; color:var(--sub-text); text-align:center; padding:20px;">一致するノートが見つかりません</div>`;
    return;
  }
  
  filtered.forEach(function(entry) {
    let item = document.createElement("div");
    item.className = "search-result-card"; // style.cssとクラス名を一致させました
    item.style.cssText = "padding:12px; margin-bottom:8px; cursor:pointer;";
    item.innerHTML = `<div style="font-weight:700; font-size:14px;">${entry.name}</div><div style="font-size:11px; color:var(--sub-text); margin-top:2px;">マイノート</div>`;
    item.onclick = function() {
      openEditorForEdit(entry.name);
    };
    out.appendChild(item);
  });
}

function checkSecurityLockOnInit() {
  const isLockEnabled = localStorage.getItem("app_lock_enabled") === "true";
  const hasPin = !!localStorage.getItem("app_lock_pin");
  const lockScreen = document.getElementById("lock-screen");
  if (!lockScreen) return;

  if (isLockEnabled && hasPin) {
    lockStatusMode = "auth";
    if (document.getElementById("lock-screen-title")) document.getElementById("lock-screen-title").innerText = "パスコードを入力";
    if (document.getElementById("bio-auth-btn")) {
      document.getElementById("bio-auth-btn").style.visibility = (localStorage.getItem("app_bio_enabled") === "true") ? "visible" : "hidden";
    }
    lockScreen.style.display = "flex";
    if(localStorage.getItem("app_bio_enabled") === "true") {
      setTimeout(triggerBiometricAuth, 400);
    }
  } else {
    lockScreen.style.display = "none";
  }
}

function syncSecurityUIElements() {
  const isLockEnabled = localStorage.getItem("app_lock_enabled") === "true";
  const lockToggle = document.getElementById("lock-toggle");
  if (lockToggle) lockToggle.checked = isLockEnabled;
  
  const bioRow = document.getElementById("bio-setting-row");
  const passRow = document.getElementById("change-pass-row");
  const bioToggle = document.getElementById("bio-toggle");
  
  if(isLockEnabled) {
    if(bioRow) { bioRow.style.opacity = "1"; bioRow.style.pointerEvents = "auto"; }
    if(passRow) { passRow.style.opacity = "1"; passRow.style.pointerEvents = "auto"; }
    if(bioToggle) bioToggle.checked = localStorage.getItem("app_bio_enabled") === "true";
  } else {
    if(bioRow) { bioRow.style.opacity = "0.5"; bioRow.style.pointerEvents = "none"; }
    if(passRow) { passRow.style.opacity = "0.5"; passRow.style.pointerEvents = "none"; }
    if(bioToggle) bioToggle.checked = false;
  }
}

function toggleLockSetting() {
  const lockToggle = document.getElementById("lock-toggle");
  const chk = lockToggle ? lockToggle.checked : false;
  if(chk) {
    lockStatusMode = "reg_1";
    currentInputPin = "";
    updateLockDots();
    if (document.getElementById("lock-screen-title")) document.getElementById("lock-screen-title").innerText = "新規の6桁パスコードを登録";
    if (document.getElementById("bio-auth-btn")) document.getElementById("bio-auth-btn").style.visibility = "hidden";
    if (document.getElementById("lock-screen")) document.getElementById("lock-screen").style.display = "flex";
  } else {
    localStorage.setItem("app_lock_enabled", "false");
    localStorage.removeItem("app_lock_pin");
    localStorage.setItem("app_bio_enabled", "false");
    syncSecurityUIElements();
  }
}

function toggleBioSetting() {
  const bioToggle = document.getElementById("bio-toggle");
  const chk = bioToggle ? bioToggle.checked : false;
  localStorage.setItem("app_bio_enabled", chk ? "true" : "false");
}

function changePasscodeClick() {
  lockStatusMode = "reg_1";
  currentInputPin = "";
  updateLockDots();
  if (document.getElementById("lock-screen-title")) document.getElementById("lock-screen-title").innerText = "新しい6桁パスコードを入力";
  if (document.getElementById("bio-auth-btn")) document.getElementById("bio-auth-btn").style.visibility = "hidden";
  if (document.getElementById("lock-screen")) document.getElementById("lock-screen").style.display = "flex";
}

function pressKey(num) {
  if(currentInputPin.length >= 6) return;
  currentInputPin += num;
  updateLockDots();
  
  if(currentInputPin.length === 6) {
    setTimeout(handlePinComplete, 200);
  }
}

function pressDeleteKey() {
  if(currentInputPin.length > 0) {
    currentInputPin = currentInputPin.slice(0, -1);
    updateLockDots();
  }
}

function updateLockDots() {
  for(let i=0; i<6; i++) {
    let dot = document.getElementById(`dot-${i}`);
    if(dot) {
      if(i < currentInputPin.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    }
  }
}

function handlePinComplete() {
  if(lockStatusMode === "auth") {
    const saved = localStorage.getItem("app_lock_pin");
    if(currentInputPin === saved) {
      if (document.getElementById("lock-screen")) document.getElementById("lock-screen").style.display = "none";
      currentInputPin = "";
      updateLockDots();
    } else {
      alert("パスコードが一致しません");
      currentInputPin = "";
      updateLockDots();
    }
  } else if(lockStatusMode === "reg_1") {
    tempRegisteredPin = currentInputPin;
    currentInputPin = "";
    updateLockDots();
    lockStatusMode = "reg_2";
    if (document.getElementById("lock-screen-title")) document.getElementById("lock-screen-title").innerText = "確認のためもう一度入力してください";
  } else if(lockStatusMode === "reg_2") {
    if(currentInputPin === tempRegisteredPin) {
      localStorage.setItem("app_lock_pin", currentInputPin);
      localStorage.setItem("app_lock_enabled", "true");
      if (document.getElementById("lock-screen")) document.getElementById("lock-screen").style.display = "none";
      currentInputPin = "";
      updateLockDots();
      syncSecurityUIElements();
      alert("パスコードを登録しました");
    } else {
      alert("入力されたコードが一致しません。最初からやり直してください。");
      lockStatusMode = "reg_1";
      currentInputPin = "";
      updateLockDots();
      if (document.getElementById("lock-screen-title")) document.getElementById("lock-screen-title").innerText = "新規の6桁パスコードを登録";
    }
  }
}

function triggerBiometricAuth() {
  if(window.fingerprint || (window.cordova && cordova.plugins && cordova.plugins.fingerprintAuth)) {
    let fp = window.fingerprint || cordova.plugins.fingerprintAuth;
    fp.isAvailable(function() {
      fp.show({ clientId: "LiquidGlassApp", clientSecret: "AppSecretSafe" }, function() {
        if (document.getElementById("lock-screen")) document.getElementById("lock-screen").style.display = "none";
        currentInputPin = "";
        updateLockDots();
      }, function() {});
    }, function() {});
  } else {
    // ブラウザ環境では生体認証画面をスキップ
    if (document.getElementById("lock-screen")) document.getElementById("lock-screen").style.display = "none";
    currentInputPin = "";
    updateLockDots();
  }
}
