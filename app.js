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

// アクティブなiframeの読込進捗アニメーション（Safari風擬似バー）
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

// 現在選択されているアクティブなiframeを取得
function getActiveBrowserIframe() {
  const iframes = document.getElementById("browser-iframes-target").getElementsByTagName("iframe");
  for (let i = 0; i < iframes.length; i++) {
    if (iframes[i].style.display !== "none") {
      return iframes[i];
    }
  }
  return iframes[0] || null;
}

// 履歴ボタンの状態更新
function updateBrowserNavButtons() {
  const activeIframe = getActiveBrowserIframe();
  const backBtn = document.getElementById("browser-back-btn");
  const forwardBtn = document.getElementById("browser-forward-btn");
  
  if (!activeIframe || !backBtn || !forwardBtn) return;
  
  backBtn.classList.add("active");
  forwardBtn.classList.add("active");
}

// 前のページに戻る
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

// 後のページに進む
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
      document.getElementById("browser-current-url").innerText = currentUrl;
    } catch(e) {}
  });
}

function onBrowserTabChanged() {
  updateBrowserNavButtons();
}

document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
  if (window.cordova && cordova.plugins && cordova.plugins.notification) {
    cordova.plugins.notification.local.hasPermission(function (granted) {
      if (!granted) {
        cordova.plugins.notification.local.requestPermission(function(res) {
          console.log("Notification permission requested: " + res);
        });
      }
    });
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
  if (document.getElementById('files-page').classList.contains('active')) renderFiles();
}

function saveMemoryMemosToStorage() {
  localStorage.setItem("app_notes_backup_object", JSON.stringify(memoryMemoBackup));
  fetchAllEntriesForSearch();
}

window.onload = function() {
  if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'dark'); 
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    document.getElementById('theme-toggle').checked = true;
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

  syncSecurityUIElements();
  initHome();
  updateBatteryStatus(); // 起動時にバッテリー状況を反映
  renderCalendar();
  setInterval(updateClock, 1000);
};

function updateClockFont(fontClass) {
  currentClockFont = fontClass;
  localStorage.setItem('clockFontClass', fontClass);
  applyClockStyle();
}

function updateClockSize(sizeClass) {
  // 互換性維持
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
    const isNotifyEnabled = document.getElementById("notify-toggle").checked;
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
  document.getElementById("notify-toggle").checked = localStorage.getItem(key + "_notify_active") === "true";
}

function saveMemo() {
  const val = document.getElementById("memo-input").value;
  const timeStr = document.getElementById("notify-time").value;
  const isNotifyActive = document.getElementById("notify-toggle").checked;
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
    document.getElementById("today-memo-display").innerText = val.trim() === "" ? "メモはありません。" : val;
  }
  renderCalendar();
  scheduleNativeNotification(selectedDateKey, val, timeStr);
  alert("予定と通知設定を保存しました。");
}

// 🔋 バッテリー情報を取得してUIを更新する関数
function updateBatteryStatus() {
  if (navigator.getBattery) {
    navigator.getBattery().then(function(battery) {
      function updateAllBatteryInfo() {
        const level = Math.floor(battery.level * 100);
        
        // %テキストとプログレスバーの更新
        const levelText = document.getElementById("battery-level-text");
        const progressBar = document.getElementById("battery-progress-bar");
        const statusText = document.getElementById("battery-status-text");
        
        if (levelText) levelText.innerText = level + "%";
        if (progressBar) progressBar.style.width = level + "%";
        
        // 充電状態（Charging）の検知とテキスト変更
        if (statusText) {
          statusText.innerText = battery.charging ? "バッテリー (充電中)" : "バッテリー";
        }
      }

      // 初回実行とイベントリスナーの登録
      updateAllBatteryInfo();
      battery.addEventListener('levelchange', updateAllBatteryInfo);
      battery.addEventListener('chargingchange', updateAllBatteryInfo);
    });
  } else {
    // APIが非対応環境の場合のフォールバック
    const statusText = document.getElementById("battery-status-text");
    if (statusText) statusText.innerText = "バッテリー情報非対応";
  }
}

function initHome() {
  const today = new Date();
  document.getElementById("home-date-label").innerText = today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const todayKey = formatDateKey(today);
  document.getElementById("today-memo-display").innerText = localStorage.getItem(todayKey) || "メモはありません。";
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
  document.getElementById(pageId).classList.add('active');
  
  if (pageId === 'home-page') { 
    document.getElementById('tab-home').classList.add('active'); 
    initHome(); 
    updateBatteryStatus(); // ホーム移動時にもバッテリー状況を更新
  }
  if (pageId === 'calendar-page') { document.getElementById('tab-calendar').classList.add('active'); renderCalendar(); }
  if (pageId === 'search-page') document.getElementById('tab-search').classList.add('active');
  if (pageId === 'files-page') { document.getElementById('tab-files').classList.add('active'); renderFiles(); }
  if (pageId === 'settings-page') { document.getElementById('tab-settings').classList.add('active'); initDynamicClockSettings(); }
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
  document.getElementById("current-month-year").innerText = `${year}年 ${month + 1}月`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const body = document.getElementById("calendar-body");
  body.innerHTML = "";

  let d = 1;
  const today = new Date();

  for (let i = 0; i < 6; i++) {
    let r = document.createElement("tr");
    let has = false;
    for (let j = 0; j < 7; j++) {
      let c = document.createElement("td");
      if (i === 0 && j < firstDay) {
      } else if (d > daysInMonth) {
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
  if(t=='file') {
    openEditorForCreate();
  }
}

function renderFiles() {
  let grid = document.getElementById("file-grid-system");
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
    iconDiv.innerHTML = `<svg class="system-icon-svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    
    let textGroup = document.createElement("div");
    textGroup.className = "file-text-group";
    
    let nameDiv = document.createElement("div");
    nameDiv.className = "file-name";
    nameDiv.innerText = keyName;
    
    let previewDiv = document.createElement("div");
    previewDiv.className = "file-preview-text";
    previewDiv.innerText = textContent.trim() ? textContent : "内容なし";
    
    textGroup.appendChild(nameDiv);
    textGroup.appendChild(previewDiv);
    infoBlock.appendChild(iconDiv);
    infoBlock.appendChild(textGroup);
    
    let actionsGroup = document.createElement("div");
    actionsGroup.className = "file-actions-group";
    
    let shareBtn = document.createElement("div");
    shareBtn.className = "file-share-btn";
    shareBtn.innerHTML = `<svg class="file-share-icon" viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"></polyline><line x1="10" y1="14" x2="21" y2="3"></line><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path></svg>`;
    shareBtn.onclick = function(e) { e.stopPropagation(); shareNativeFile(keyName); };
    
    let delBtn = document.createElement("button");
    delBtn.className = "file-delete-btn";
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
  bc.innerHTML = `位置: <span onclick="navToRoot()">メモ</span>`;
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
    
    if(currentDirectoryEntry) {
      currentDirectoryEntry.getFile(keyName + ".txt", { create: false }, function(fileEntry) {
        fileEntry.remove(function(){}, function(e){});
      });
    }
  }
}

let editingKeyName = null;
function openEditorForCreate() {
  editingKeyName = null;
  document.getElementById("editor-view-title").innerText = "新規メモ作成";
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
  
  if(currentDirectoryEntry) {
    let nativeName = (editingKeyName ? editingKeyName : filename) + ".txt";
    currentDirectoryEntry.getFile(nativeName, { create: true }, function(fileEntry) {
      fileEntry.createWriter(function(writer) {
        let blob = new Blob([content], { type: 'text/plain' });
        writer.write(blob);
      });
    });
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

let browserTabs = []; 
let activeTabId = null;

function executeWebSearch() {
  let q = document.getElementById("web-search-query").value;
  if(!q || !q.trim()) return;
  
  let targetUrl = "";
  if (q.trim().startsWith('http://') || q.trim().startsWith('https://')) {
    targetUrl = q.trim();
  } else {
    targetUrl = "https://www.google.com/search?q=" + encodeURIComponent(q.trim());
  }
  
  // 🧭 iOSの本家Safari (SafariViewController) に極限まで近づけるための最強オプション
  let options = [
    "location=yes",                 // 💡 本家同様、上部に現在のドメイン名（URL）をセーフエリアを考慮して表示
    "toolbar=yes",                  // ツールバーを有効化
    "toolbarposition=bottom",       // 💡 本家Safariと同じく、画面下部に「戻る・進む・共有・完了」を配置
    "closebuttoncaption=完了",      // 💡 ボタン文字をiOS標準の「完了」に変更
    "closebuttoncolor=#007aff",     // 💡 iOS純正のシステムブルー色に統一
    "navigationbuttoncolor=#007aff",// 💡 矢印ボタン（戻る・進む）もiOS純正ブルーに統一
    "enableViewportScale=yes",      // ピンチイン・ピンチアウトでの拡大縮小を本家同様に許可
    "hidesecureurl=no",             // 安全な通信（https）の鍵マークを本家同様に表示
    "presentationstyle=formsheet",  // 💡 下からふわっと浮き上がるiOS標準のシートアニメーションで開く
    "viewportfit=cover"             // iPhoneの底面ホームインジケーターの隙間に追従させる
  ].join(",");
  
  if (window.cordova && cordova.InAppBrowser) {
    cordova.InAppBrowser.open(targetUrl, '_blank', options);
  } else {
    window.open(targetUrl, '_blank');
  }
}

// 互換性維持のための空関数（エラー防止用）
function closeWebSearchTab() {}

function fetchAllEntriesForSearch() {
  currentEntriesList = [];
  Object.keys(memoryMemoBackup).forEach(key => {
    currentEntriesList.push({ name: key, isDirectory: false });
  });
}

function executeInAppSearch(query) {
  let out = document.getElementById("search-results-output");
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
    item.className = "search-result-item";
    item.innerHTML = `<div class="search-result-title">${entry.name}</div><div style="font-size:11px; color:var(--sub-text); margin-top:2px;">マイノート</div>`;
    item.onclick = function() {
      openEditorForEdit(entry.name);
    };
    out.appendChild(item);
  });
}

function checkSecurityLockOnInit() {
  const isLockEnabled = localStorage.getItem("app_lock_enabled") === "true";
  const hasPin = !!localStorage.getItem("app_lock_pin");
  if (isLockEnabled && hasPin) {
    lockStatusMode = "auth";
    document.getElementById("lock-screen-title").innerText = "パスコードを入力";
    document.getElementById("bio-auth-btn").style.visibility = (localStorage.getItem("app_bio_enabled") === "true") ? "visible" : "hidden";
    document.getElementById("lock-screen").style.display = "flex";
    if(localStorage.getItem("app_bio_enabled") === "true") {
      setTimeout(triggerBiometricAuth, 400);
    }
  } else {
    document.getElementById("lock-screen").style.display = "none";
  }
}

function syncSecurityUIElements() {
  const isLockEnabled = localStorage.getItem("app_lock_enabled") === "true";
  document.getElementById("lock-toggle").checked = isLockEnabled;
  
  const bioRow = document.getElementById("bio-setting-row");
  const passRow = document.getElementById("change-pass-row");
  
  if(isLockEnabled) {
    if(bioRow) { bioRow.style.opacity = "1"; bioRow.style.pointerEvents = "auto"; }
    if(passRow) { passRow.style.opacity = "1"; passRow.style.pointerEvents = "auto"; }
    document.getElementById("bio-toggle").checked = localStorage.getItem("app_bio_enabled") === "true";
  } else {
    if(bioRow) { bioRow.style.opacity = "0.5"; bioRow.style.pointerEvents = "none"; }
    if(passRow) { passRow.style.opacity = "0.5"; passRow.style.pointerEvents = "none"; }
    document.getElementById("bio-toggle").checked = false;
  }
  
  if(window.device) {
    // Cordovaの準備が完了したタイミングで実行するイベントリスナー
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log("Cordova Ready! デバイス情報を取得します。");
    
    // 実機（Cordova環境）であれば、window.device から正しい情報が取得できます
    if (window.device) {
        document.getElementById('dev-model').innerText = window.device.model || '不明なモデル';
        document.getElementById('dev-platform').innerText = window.device.platform || '不明なOS';
        document.getElementById('dev-version').innerText = window.device.version || '不明なバージョン';
        document.getElementById('dev-cordova').innerText = window.device.cordova || 'N/A';
        document.getElementById('dev-uuid').innerText = window.device.uuid || '取得失敗';
    } else {
        // 万が一ブラウザプレビュー環境などでプラグインが読めない場合のフォールバック
        document.getElementById('dev-model').innerText = 'PCブラウザ環境';
        document.getElementById('dev-platform').innerText = navigator.platform;
        document.getElementById('dev-version').innerText = '1.0.0';
        document.getElementById('dev-cordova').innerText = 'N/A';
        document.getElementById('dev-uuid').innerText = 'Browser-Mock-ID';
    }
}
  }
}

function toggleLockSetting() {
  const chk = document.getElementById("lock-toggle").checked;
  if(chk) {
    lockStatusMode = "reg_1";
    currentInputPin = "";
    updateLockDots();
    document.getElementById("lock-screen-title").innerText = "新規の6桁パスコードを登録";
    document.getElementById("bio-auth-btn").style.visibility = "hidden";
    document.getElementById("lock-screen").style.display = "flex";
  } else {
    localStorage.setItem("app_lock_enabled", "false");
    localStorage.removeItem("app_lock_pin");
    localStorage.setItem("app_bio_enabled", "false");
    syncSecurityUIElements();
  }
}

function toggleBioSetting() {
  const chk = document.getElementById("bio-toggle").checked;
  localStorage.setItem("app_bio_enabled", chk ? "true" : "false");
}

function changePasscodeClick() {
  lockStatusMode = "reg_1";
  currentInputPin = "";
  updateLockDots();
  document.getElementById("lock-screen-title").innerText = "新しい6桁パスコードを入力";
  document.getElementById("bio-auth-btn").style.visibility = "hidden";
  document.getElementById("lock-screen").style.display = "flex";
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
      document.getElementById("lock-screen").style.display = "none";
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
    document.getElementById("lock-screen-title").innerText = "確認のためもう一度入力してください";
  } else if(lockStatusMode === "reg_2") {
    if(currentInputPin === tempRegisteredPin) {
      localStorage.setItem("app_lock_pin", currentInputPin);
      localStorage.setItem("app_lock_enabled", "true");
      document.getElementById("lock-screen").style.display = "none";
      currentInputPin = "";
      updateLockDots();
      syncSecurityUIElements();
      alert("パスコードを登録しました");
    } else {
      alert("入力されたコードが一致しません。最初からやり直してください。");
      lockStatusMode = "reg_1";
      currentInputPin = "";
      updateLockDots();
      document.getElementById("lock-screen-title").innerText = "新規の6桁パスコードを登録";
    }
  }
}

function triggerBiometricAuth() {
  if(window.fingerprint || (window.cordova && cordova.plugins && cordova.plugins.fingerprintAuth)) {
    let fp = window.fingerprint || cordova.plugins.fingerprintAuth;
    fp.isAvailable(function() {
      fp.show({ clientId: "LiquidGlassApp", clientSecret: "AppSecretSafe" }, function() {
        document.getElementById("lock-screen").style.display = "none";
        currentInputPin = "";
        updateLockDots();
      }, function() {
      });
    }, function() {
    });
  } else {
    document.getElementById("lock-screen").style.display = "none";
    currentInputPin = "";
    updateLockDots();
  }
}