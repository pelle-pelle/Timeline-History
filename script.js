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
    { name: "飛鳥", start: 592, end: 710, color: "rgba(200,200,200,0.2)" },
    { name: "奈良", start: 710, end: 794, color: "rgba(150,150,150,0.1)" },
    { name: "平安", start: 794, end: 1185, color: "rgba(255,182,193,0.1)" },
    { name: "鎌倉", start: 1185, end: 1333, color: "rgba(173,216,230,0.1)" },
    { name: "室町", start: 1333, end: 1573, color: "rgba(152,251,152,0.1)" },
    { name: "江戸", start: 1603, end: 1868, color: "rgba(244,221,129,0.1)" },
    {
      name: "明治以降",
      start: 1868,
      end: 2050,
      color: "rgba(135,206,235,0.1)",
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
// 4. 年表の描画エンジン
// ==========================================
function renderTimeline() {
  const barsContainer = document.getElementById("timeline-bars");
  const axisContainer = document.getElementById("timeline-axis");
  const eraContainer = document.getElementById("era-background");

  if (!barsContainer) return;

  // 画面を一度空にする
  barsContainer.innerHTML = "";
  axisContainer.innerHTML = "";
  eraContainer.innerHTML = "";

  // 表示すべき人だけを絞り込む（検索・カテゴリ・タグ）
  const visiblePeople = people.filter((p) => {
    const matchSearch = p.name
      .toLowerCase()
      .includes(state.searchQuery.toLowerCase());
    const matchCat = state.categoryVisibility[p.category];
    const matchTag = p.tagColor
      ? state.tagVisibility[p.tagColor]
      : state.tagVisibility["none"];
    return matchSearch && matchCat && matchTag;
  });

  // 年表の幅を計算
  const curYear = new Date().getFullYear();
  const allYears = people.flatMap((p) => [p.birth, p.death || curYear]);
  const minYear = Math.floor(Math.min(...allYears, 500) / 100) * 100 - 100;
  const maxYear = Math.ceil(Math.max(...allYears, curYear) / 100) * 100 + 100;
  const pxPerYear = config.pxPerYearBase * state.zoomScale;
  const totalWidth = (maxYear - minYear) * pxPerYear;

  barsContainer.style.width = `${totalWidth}px`;
  eraContainer.style.width = `${totalWidth}px`;

  // 時代背景を描く
  config.eras.forEach((era) => {
    const x = (era.start - minYear) * pxPerYear;
    const w = (era.end - era.start) * pxPerYear;
    const div = document.createElement("div");
    div.className = "era-region";
    div.style.left = `${x}px`;
    div.style.width = `${w}px`;
    div.style.backgroundColor = era.color;
    div.innerHTML = `<span>${era.name}</span>`;
    eraContainer.appendChild(div);
  });

  // 目盛りを描く
  for (let y = minYear; y <= maxYear; y += 100) {
    const label = document.createElement("div");
    label.className = "year-label";
    label.style.left = `${(y - minYear) * pxPerYear}px`;
    label.textContent = y < 0 ? `BC${Math.abs(y)}` : `${y}年`;
    axisContainer.appendChild(label);
  }

  // 今日の赤いラインを描く
  const todayX = (curYear - minYear) * pxPerYear;
  const todayLine = document.createElement("div");
  todayLine.style.cssText = `position:absolute; left:${todayX}px; top:0; bottom:0; width:2px; background:red; z-index:5;`;
  eraContainer.appendChild(todayLine);

  // 人物のバーを描く（重ならないように計算）
  const rows = [];
  visiblePeople
    .sort((a, b) => a.birth - b.birth)
    .forEach((p) => {
      const startX = (p.birth - minYear) * pxPerYear;
      const endYear = p.death || curYear;
      const width = Math.max(100, (endYear - p.birth) * pxPerYear);

      // 空いている行を探す
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

      // クリックしたら編集モード（IDを渡す）
      bar.onclick = () => enterEditMode(p);
      bar.onmouseover = (e) => showTooltip(e, p);
      bar.onmouseout = () =>
        (document.getElementById("tooltip").style.display = "none");

      barsContainer.appendChild(bar);
    });
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

// 現代の位置にスクロールする
function scrollToToday() {
  const curYear = new Date().getFullYear();
  const allYears = people.flatMap((p) => [p.birth, p.death || curYear]);
  const minYear = Math.floor(Math.min(...allYears, 500) / 100) * 100 - 100;
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
  document.getElementById("export-btn").onclick = () => {
    const blob = new Blob([JSON.stringify({ people, tagNames })], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "history_data.json";
    a.click();
  };
  document.getElementById("import-trigger").onclick = () =>
    document.getElementById("import-file").click();
  document.getElementById("import-file").onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = JSON.parse(ev.target.result);
      people = data.people;
      tagNames = data.tagNames;
      saveToStorage();
      location.reload();
    };
    reader.readAsText(e.target.files[0]);
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
