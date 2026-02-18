// ==========================================
// 1. 基本設定（色の定義や時代データ）
// ==========================================
const config = {
  pxPerYearBase: 4, // 1年を何ピクセルにするか
  rowHeight: 40, // 1行の高さ
  categoryColors: {
    政治: "#1E88E5",
    "武将・軍事": "#43A047",
    "改革・維新": "#FB8C00",
    "文化・文学・宗教": "#8E24AA",
    "経済・産業・技術": "#E53935",
    天皇: "#D4AF37",
    その他: "#757575",
  },
  tagColors: [
    "#e91e63",
    "#9c27b0",
    "#673ab7",
    "#3f51b5",
    "#2196f3",
    "#00bcd4",
    "#009688",
    "#4caf50",
    "#ffeb3b",
    "#ffc107",
    "#ff9800",
    "#795548",
  ],
  eras: [
    { name: "飛鳥", start: 592, end: 710, color: "rgba(233, 236, 239, 0.4)" },
    { name: "奈良", start: 710, end: 794, color: "rgba(216, 191, 216, 0.3)" },
    { name: "平安", start: 794, end: 1185, color: "rgba(255, 182, 193, 0.25)" },
    {
      name: "鎌倉",
      start: 1185,
      end: 1333,
      color: "rgba(173, 216, 230, 0.25)",
    },
    {
      name: "室町",
      start: 1333,
      end: 1573,
      color: "rgba(152, 251, 152, 0.25)",
    },
    {
      name: "安土桃山",
      start: 1573,
      end: 1603,
      color: "rgba(255, 215, 0, 0.2)",
    },
    { name: "江戸", start: 1603, end: 1868, color: "rgba(244, 221, 129, 0.3)" },
    {
      name: "明治",
      start: 1868,
      end: 1912,
      color: "rgba(135, 206, 235, 0.25)",
    },
    { name: "大正", start: 1912, end: 1926, color: "rgba(255, 250, 205, 0.4)" },
    {
      name: "昭和",
      start: 1926,
      end: 1989,
      color: "rgba(220, 220, 220, 0.35)",
    },
    { name: "平成", start: 1989, end: 2019, color: "rgba(224, 255, 255, 0.3)" },
    {
      name: "令和",
      start: 2019,
      end: 2050,
      color: "rgba(255, 228, 225, 0.35)",
    },
  ],
};

// ==========================================
// 2. データの読み込みと状態管理
// ==========================================
// ブラウザに保存されている人物データを取得（なければ空）
let people = JSON.parse(localStorage.getItem("peopleData")) || [];
// タグの名前設定を取得
let tagNames = JSON.parse(localStorage.getItem("tagNamesData")) || {};

// アプリの現在の状態（編集中かどうか、ズーム倍率など）
let state = {
  editingId: null, // 編集中の人の「ID」を保存する場所（重要！）
  zoomScale: 1,
  searchQuery: "",
  categoryVisibility: {},
  tagVisibility: { none: true },
  selectedTagColor: "",
};

// ==========================================
// 3. ID（背番号）を管理する仕組み
// ==========================================

// 【重要】既存のデータにIDがない場合、自動で割り振る関数
function ensureIds() {
  let changed = false;
  // 現在のデータの中で一番大きいIDを探す
  let maxId = people.reduce((max, p) => Math.max(max, p.id || 0), 0);

  people.forEach((p) => {
    if (!p.id) {
      // もしIDを持っていなければ
      maxId++;
      p.id = maxId; // 新しい番号を振る
      changed = true;
    }
  });

  if (changed) {
    saveToStorage(); // 変更があったら保存
  }
}

// データを保存する共通の処理
function saveToStorage() {
  localStorage.setItem("peopleData", JSON.stringify(people));
  localStorage.setItem("tagNamesData", JSON.stringify(tagNames));
}

// ==========================================
// ==========================================
// 4. 年表の描画エンジン (修正版)
// ==========================================
function renderTimeline() {
  const axisContainer = document.getElementById("timeline-axis");
  const barsContainer = document.getElementById("timeline-bars");
  const eraContainer = document.getElementById("era-background");

  if (!axisContainer || !barsContainer || !eraContainer) return;

  axisContainer.innerHTML = "";
  barsContainer.innerHTML = "";
  eraContainer.innerHTML = "";

  const curYear = new Date().getFullYear();

  // 1. 全データの期間を抽出（時代設定の端っこも計算に入れる）
  const personYears = people.flatMap((p) => [p.birth, p.death || curYear]);
  const eraYears = config.eras.flatMap((e) => [e.start, e.end]);
  const allYears = [...personYears, ...eraYears];

  // 2. 年表の端っこを計算（データがない場合は500年〜現在）
  const minVal = allYears.length > 0 ? Math.min(...allYears) : 500;
  const maxVal = allYears.length > 0 ? Math.max(...allYears) : curYear;

  // 表示範囲を決定（過去に50年、未来に30年のバッファ）
  const minYear = Math.floor(minVal / 50) * 50 - 50;
  const maxYear = Math.ceil(maxVal / 10) * 10 + 30;

  const pxPerYear = config.pxPerYearBase * state.zoomScale;
  const totalWidth = (maxYear - minYear) * pxPerYear;

  // ★重要：コンテナの幅を固定し、はみ出しをカットする
  [axisContainer, barsContainer, eraContainer].forEach((el) => {
    el.style.width = `${totalWidth}px`;
    el.style.minWidth = `${totalWidth}px`;
    el.style.overflow = "hidden"; // これが「無限スクロール」を防ぐ鍵
  });

  // 3. 時代背景を描く
  config.eras.forEach((era) => {
    // 年表の範囲外の時代は描画しない（または範囲内に収める）
    const start = Math.max(minYear, era.start);
    const end = Math.min(maxYear, era.end);
    if (start >= end) return;

    const x = (start - minYear) * pxPerYear;
    const w = (end - start) * pxPerYear;

    const div = document.createElement("div");
    div.className = "era-region";
    div.style.left = `${x}px`;
    div.style.width = `${w}px`;
    div.style.backgroundColor = era.color;
    div.innerHTML = `<span>${era.name}</span>`;
    eraContainer.appendChild(div);
  });

  // 4. 目盛り（年）を描く
  for (let y = minYear; y <= maxYear; y += 100) {
    const label = document.createElement("div");
    label.className = "year-label";
    label.style.left = `${(y - minYear) * pxPerYear}px`;
    label.textContent = y < 0 ? `BC${Math.abs(y)}` : `${y}年`;
    axisContainer.appendChild(label);
  }

  // 5. 今日の赤いライン
  const todayX = (curYear - minYear) * pxPerYear;
  const todayLine = document.createElement("div");
  todayLine.style.cssText = `position:absolute; left:${todayX}px; top:0; bottom:0; width:2px; background:red; z-index:5; opacity:0.6;`;
  eraContainer.appendChild(todayLine);

  // 6. 人物バーを描く
  // 人物バーを描く前の filter 部分を修正
  const visiblePeople = people.filter((p) => {
    const matchSearch = p.name
      .toLowerCase()
      .includes(state.searchQuery.toLowerCase());
    // カテゴリが未定義の場合は true にする（念のため）
    const matchCat = state.categoryVisibility[p.category] !== false;
    const matchTag = p.tagColor
      ? state.tagVisibility[p.tagColor]
      : state.tagVisibility["none"];
    return matchSearch && matchCat && matchTag;
  });

  const rows = [];
  visiblePeople
    .sort((a, b) => a.birth - b.birth)
    .forEach((p) => {
      const startX = (p.birth - minYear) * pxPerYear;
      const endYear = p.death || curYear;
      // バーの物理的な幅
      const width = Math.max(100, (endYear - p.birth) * pxPerYear);

      let rowIndex = 0;
      while (rows[rowIndex] > startX) {
        rowIndex++;
      }
      rows[rowIndex] = startX + width + 20;

      const bar = document.createElement("div");
      bar.className = "person-bar";
      bar.style.left = `${startX}px`;
      bar.style.width = `${width}px`;
      bar.style.top = `${rowIndex * config.rowHeight + 20}px`;
      bar.style.backgroundColor = config.categoryColors[p.category];
      bar.style.borderColor = p.tagColor || "rgba(255,255,255,0.4)";
      bar.textContent = `${p.name} (${p.birth}〜)`;

      bar.onclick = () => enterEditMode(p);
      bar.onmouseover = (e) => showTooltip(e, p);
      bar.onmouseout = () =>
        (document.getElementById("tooltip").style.display = "none");
      barsContainer.appendChild(bar);
    });

  // 使用された行数 (rows.length) に基づいて、コンテナの高さを自動調整する
  const finalHeight = rows.length * config.rowHeight + 60;
  barsContainer.style.height = `${finalHeight}px`;
  eraContainer.style.height = `${finalHeight}px`; // 背景も合わせる
}

// ==========================================
// 5. フォーム操作（追加・編集・削除）
// ==========================================

// 編集モードに切り替える（背番号IDを記憶させる）
function enterEditMode(person) {
  state.editingId = person.id; // どのIDの人を編集しているかセット

  document.getElementById("person-name").value = person.name;
  document.getElementById("person-birth").value = person.birth;
  document.getElementById("person-death").value = person.death || "";
  document.getElementById("person-category").value = person.category;
  document.getElementById("person-memo").value = person.memo || "";

  // タグ選択の見た目を更新
  state.selectedTagColor = person.tagColor || "";
  document.querySelectorAll(".tag-option").forEach((opt) => {
    opt.classList.toggle("selected", opt.dataset.color === person.tagColor);
  });

  // UIを編集用に変える
  document.getElementById("form-title").textContent = "📝 人物データを編集";
  document.getElementById("edit-status").classList.remove("hidden");
  document.getElementById("cancel-button").classList.remove("hidden");
  document.getElementById("delete-button").classList.remove("hidden");

  // 入力欄へスクロール
  document
    .querySelector(".form-section")
    .scrollIntoView({ behavior: "smooth" });
}

// 編集モードを終了する
function exitEditMode() {
  state.editingId = null;
  document.getElementById("add-person-form").reset();
  state.selectedTagColor = "";
  document
    .querySelectorAll(".tag-option")
    .forEach((opt) => opt.classList.remove("selected"));

  document.getElementById("form-title").textContent = "✏️ 人物を追加";
  document.getElementById("edit-status").classList.add("hidden");
  document.getElementById("cancel-button").classList.add("hidden");
  document.getElementById("delete-button").classList.add("hidden");
}

// フォームが送信された時（保存）
document.getElementById("add-person-form").onsubmit = function (e) {
  e.preventDefault();

  const newPersonData = {
    name: document.getElementById("person-name").value,
    birth: parseInt(document.getElementById("person-birth").value),
    death: parseInt(document.getElementById("person-death").value) || 0,
    category: document.getElementById("person-category").value,
    tagColor: state.selectedTagColor,
    memo: document.getElementById("person-memo").value,
  };

  if (state.editingId !== null) {
    // 【編集の場合】IDが一致する人を探して更新
    const idx = people.findIndex((p) => p.id === state.editingId);
    if (idx !== -1) {
      newPersonData.id = state.editingId; // IDは変えない
      people[idx] = newPersonData;
    }
  } else {
    // 【新規の場合】新しいIDを発行して追加
    const maxId = people.reduce((max, p) => Math.max(max, p.id || 0), 0);
    newPersonData.id = maxId + 1;
    people.push(newPersonData);
  }

  saveToStorage();
  exitEditMode();
  renderTimeline();
};

// 削除ボタンが押された時
document.getElementById("delete-button").onclick = function () {
  if (confirm("本当にこの人物データを削除しますか？")) {
    // IDが一致しない人だけを残す（＝一致する人を消す）
    people = people.filter((p) => p.id !== state.editingId);
    saveToStorage();
    exitEditMode();
    renderTimeline();
  }
};

// ==========================================
// 6. その他の便利機能
// ==========================================

function scrollToToday() {
  const curYear = new Date().getFullYear();
  // renderTimelineと同じ計算で minYear を出す
  const personYears = people.flatMap((p) => [p.birth, p.death || curYear]);
  const eraYears = config.eras.flatMap((e) => [e.start, e.end]);
  const allYears = [...personYears, ...eraYears];
  const minVal = allYears.length > 0 ? Math.min(...allYears) : 500;
  const minYear = Math.floor(minVal / 50) * 50 - 50;

  const pxPerYear = config.pxPerYearBase * state.zoomScale;
  const container = document.getElementById("timeline-container");

  const todayX = (curYear - minYear) * pxPerYear;
  container.scrollLeft = todayX - container.offsetWidth / 2;
}

// ツールチップ表示
function showTooltip(e, p) {
  const tip = document.getElementById("tooltip");
  const tagName = tagNames[p.tagColor] || "設定なし";
  tip.innerHTML = `<strong>${p.name}</strong> (${p.birth}〜${p.death || "存命"})<br>
                   <small>タグ: ${tagName}</small><hr>${p.memo || ""}`;
  tip.style.display = "block";
  tip.style.left = e.clientX + 10 + "px";
  tip.style.top = e.clientY + 10 + "px";
}

// 初期化処理（アプリ起動時に一回だけ動く）
window.onload = function () {
  ensureIds(); // まずIDを整備する

  // カテゴリボタンの生成
  const catContainer = document.getElementById("category-buttons");
  const catSelect = document.getElementById("person-category");
  Object.keys(config.categoryColors).forEach((cat) => {
    state.categoryVisibility[cat] = true;
    const btn = document.createElement("button");
    btn.className = "btn btn-secondary btn-sm";
    btn.textContent = cat;
    btn.style.borderLeft = `4px solid ${config.categoryColors[cat]}`;
    btn.onclick = () => {
      state.categoryVisibility[cat] = !state.categoryVisibility[cat];
      btn.style.opacity = state.categoryVisibility[cat] ? "1" : "0.3";
      renderTimeline();
    };
    catContainer.appendChild(btn);
    catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
  });

  // タグ選択肢（12色）の生成
  const tagSelector = document.getElementById("tag-color-selector");
  config.tagColors.forEach((color) => {
    state.tagVisibility[color] = true;
    const opt = document.createElement("div");
    opt.className = "tag-option";
    opt.style.backgroundColor = color;
    opt.dataset.color = color;
    opt.onclick = () => {
      document
        .querySelectorAll(".tag-option")
        .forEach((el) => el.classList.remove("selected"));
      opt.classList.add("selected");
      state.selectedTagColor = color;
    };
    tagSelector.appendChild(opt);
  });

  // 初回描画
  renderTimeline();
  renderTagLegend();
  setTimeout(scrollToToday, 500);

  // イベント登録
  // 下の「人物窓」をスクロールしたら、上の「年窓」の表示位置を合わせる
  const timelineWindow = document.getElementById("timeline-container");
  const axisWindow = document.getElementById("axis-window");

  timelineWindow.onscroll = function (e) {
    // 下のスクロール量（scrollLeft）を上の窓にもコピーする
    axisWindow.scrollLeft = e.target.scrollLeft;
  };

  document.getElementById("zoom-slider").oninput = (e) => {
    state.zoomScale = parseFloat(e.target.value);
    document.getElementById("zoom-value").textContent =
      state.zoomScale.toFixed(1) + "×";
    renderTimeline();
  };
  document.getElementById("search-input").oninput = (e) => {
    state.searchQuery = e.target.value;
    renderTimeline();
  };
  document.getElementById("jump-today").onclick = scrollToToday;
  document.getElementById("cancel-button").onclick = exitEditMode;

  // バックアップ機能
  // --- バックアップ機能（保存ボタンの強化版） ---
  document.getElementById("export-btn").onclick = async () => {
    // 保存する中身を作成
    const dataObject = {
      people: people,
      tagNames: tagNames,
    };
    const jsonString = JSON.stringify(dataObject, null, 2);

    // 1. 最新の「保存ダイアログ」が使えるブラウザ（Chrome/Edgeなど）の場合
    if ("showSaveFilePicker" in window) {
      try {
        // 保存ダイアログを表示
        const handle = await window.showSaveFilePicker({
          suggestedName: `history_backup_${new Date().toISOString().split("T")[0]}.json`,
          types: [
            {
              description: "JSONファイル",
              accept: { "application/json": [".json"] },
            },
          ],
        });

        // 選ばれた場所に書き込み
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        alert("保存が完了しました！");
      } catch (err) {
        // ユーザーがキャンセルした場合は何もしない
        console.log("保存がキャンセルされました");
      }
    }
    // 2. ダイアログ機能が使えない古いブラウザやスマホの場合
    else {
      const fileName = prompt(
        "保存するファイル名を入力してください",
        `history_backup_${new Date().toISOString().split("T")[0]}.json`,
      );

      if (fileName) {
        const blob = new Blob([jsonString], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName.endsWith(".json") ? fileName : fileName + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
      }
    }
  };

  // タグ設定モーダルの制御
  document.getElementById("open-tag-settings").onclick = () => {
    const cont = document.getElementById("tag-names-container");
    cont.innerHTML = "";
    config.tagColors.forEach((color) => {
      cont.innerHTML += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
        <div style="width:20px; height:20px; border-radius:50%; background:${color}"></div>
        <input type="text" id="tag-name-${color.replace("#", "")}" value="${tagNames[color] || ""}" style="flex:1">
      </div>`;
    });
    document.getElementById("tag-settings-modal").classList.remove("hidden");
  };
  document.getElementById("save-tag-settings").onclick = () => {
    config.tagColors.forEach((color) => {
      tagNames[color] = document.getElementById(
        `tag-name-${color.replace("#", "")}`,
      ).value;
    });
    saveToStorage();
    document.getElementById("tag-settings-modal").classList.add("hidden");
    renderTagLegend();
    renderTimeline();
  };
  document.getElementById("close-tag-settings").onclick = () =>
    document.getElementById("tag-settings-modal").classList.add("hidden");
};

// 絞り込み用のタグ凡例を表示
function renderTagLegend() {
  const container = document.getElementById("tag-legend-filter");
  container.innerHTML = "";
  config.tagColors.forEach((color) => {
    const btn = document.createElement("div");
    btn.className = `tag-filter-btn ${state.tagVisibility[color] ? "" : "inactive"}`;
    btn.innerHTML = `<span class="dot" style="background:${color}"></span><span>${tagNames[color] || "未設定"}</span>`;
    btn.onclick = () => {
      state.tagVisibility[color] = !state.tagVisibility[color];
      renderTagLegend();
      renderTimeline();
    };
    container.appendChild(btn);
  });
}
