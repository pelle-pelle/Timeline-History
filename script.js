// --- 設定データ ---
const config = {
  pxPerYearBase: 4,
  rowHeight: 40,
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

// --- 状態管理 ---
let people = JSON.parse(localStorage.getItem("peopleData")) || [
  {
    name: "聖徳太子",
    birth: 574,
    death: 622,
    category: "政治",
    tagColor: "#e91e63",
    memo: "冠位十二階",
  },
  {
    name: "織田信長",
    birth: 1534,
    death: 1582,
    category: "武将・軍事",
    tagColor: "#ff9800",
    memo: "天下布武",
  },
];
let tagNames = JSON.parse(localStorage.getItem("tagNamesData")) || {};
let state = {
  editIndex: null,
  zoomScale: 1,
  searchQuery: "",
  categoryVisibility: {},
  tagVisibility: { none: true },
  selectedTagColor: "",
};

// ユーティリティ
const formatYear = (y, isDeath = false) =>
  isDeath && !y ? "現在" : y < 0 ? `BC ${Math.abs(y)}` : `${y}年`;
const getDeath = (p) => p.death || new Date().getFullYear();

// --- 描画ロジック ---
function renderTimeline() {
  const bars = document.getElementById("timeline-bars");
  const eras = document.getElementById("era-background");
  const axis = document.getElementById("timeline-axis");
  if (!bars) return;
  [bars, eras, axis].forEach((el) => (el.innerHTML = ""));

  const visiblePeople = people.filter(
    (p) =>
      state.categoryVisibility[p.category] &&
      state.tagVisibility[p.tagColor || "none"] &&
      p.name.toLowerCase().includes(state.searchQuery.toLowerCase()),
  );

  const curYear = new Date().getFullYear();
  const allY = people.flatMap((p) => [p.birth, getDeath(p)]);
  const minYear = Math.floor(Math.min(...allY, 500) / 100) * 100 - 100;
  const maxYear = Math.ceil(Math.max(...allY, curYear) / 100) * 100 + 100;
  const pxPerY = config.pxPerYearBase * state.zoomScale;
  const totalW = (maxYear - minYear) * pxPerY;

  [bars, eras].forEach((el) => (el.style.width = `${totalW}px`));

  // 目盛り
  const step = state.zoomScale < 0.6 ? 500 : state.zoomScale < 1.5 ? 100 : 50;
  for (let y = minYear; y <= maxYear; y += step) {
    const l = document.createElement("div");
    l.className = "year-label";
    l.style.left = `${(y - minYear) * pxPerY}px`;
    l.textContent = formatYear(y);
    axis.appendChild(l);
  }

  // 時代背景
  config.eras.forEach((e) => {
    if (e.end <= minYear || e.start >= maxYear) return;
    const div = document.createElement("div");
    div.className = "era-region";
    div.style.left = `${(Math.max(e.start, minYear) - minYear) * pxPerY}px`;
    div.style.width = `${(Math.min(e.end, maxYear) - Math.max(e.start, minYear)) * pxPerY}px`;
    div.style.backgroundColor = e.color;
    div.innerHTML = `<span>${e.name}</span>`;
    eras.appendChild(div);
  });

  // Today
  const tx = (curYear - minYear) * pxPerY;
  const tLine = document.createElement("div");
  tLine.className = "today-line";
  tLine.style.left = `${tx}px`;
  tLine.innerHTML = `<div class="today-label">今日 (${curYear})</div>`;
  eras.appendChild(tLine);

  // 人物バー
  const pos = [];
  const sorted = [...visiblePeople].sort((a, b) => a.birth - b.birth);
  sorted.forEach((p) => {
    const x = (p.birth - minYear) * pxPerY;
    const w = Math.max(120, (getDeath(p) - p.birth) * pxPerY);
    let row = 0;
    while (
      pos.some(
        (prev) =>
          prev.row === row &&
          !(x > prev.x + prev.w + 30 || x + w + 30 < prev.x),
      )
    )
      row++;
    pos.push({ p, x, w, row });

    const bar = document.createElement("div");
    bar.className = "person-bar";
    bar.style.cssText = `left:${x}px; width:${w}px; top:${row * config.rowHeight + 20}px; 
                         background-color:${config.categoryColors[p.category]}; 
                         border-color:${p.tagColor || "rgba(255,255,255,0.3)"};`;
    bar.textContent = `${p.name} (${formatYear(p.birth)}〜)`;
    bar.onclick = (e) => {
      e.stopPropagation();
      enterEditMode(p);
    };
    bar.onmouseover = (e) => showTooltip(e, p);
    bar.onmouseout = () =>
      (document.getElementById("tooltip").style.display = "none");
    bars.appendChild(bar);
  });
}

function showTooltip(e, p) {
  const tip = document.getElementById("tooltip");
  const tagName = tagNames[p.tagColor] || "タグ名未設定";
  tip.innerHTML = `<strong>${p.name}</strong> (${formatYear(p.birth)}〜${formatYear(p.death, true)})<br>
                   <span style="color:${p.tagColor || "#ccc"}">●</span> ${tagName}<br><hr>${p.memo || ""}`;
  tip.style.display = "block";
  tip.style.left = e.clientX + 15 + "px";
  tip.style.top = e.clientY + 15 + "px";
}

// --- UI制御 ---
function renderTagLegend() {
  const container = document.getElementById("tag-legend-filter");
  container.innerHTML = "";
  config.tagColors.forEach((c) => {
    const btn = document.createElement("div");
    btn.className = `tag-filter-btn ${state.tagVisibility[c] ? "" : "inactive"}`;
    btn.innerHTML = `<span class="dot" style="background-color:${c}"></span><span>${tagNames[c] || "未設定"}</span>`;
    btn.onclick = () => {
      state.tagVisibility[c] = !state.tagVisibility[c];
      renderTagLegend();
      renderTimeline();
    };
    container.appendChild(btn);
  });
  const none = document.createElement("div");
  none.className = `tag-filter-btn ${state.tagVisibility["none"] ? "" : "inactive"}`;
  none.innerHTML = `<span class="dot" style="background-color:#ccc"></span><span>なし</span>`;
  none.onclick = () => {
    state.tagVisibility["none"] = !state.tagVisibility["none"];
    renderTagLegend();
    renderTimeline();
  };
  container.appendChild(none);
}

function scrollToToday() {
  const curYear = new Date().getFullYear();
  const allY = people.flatMap((p) => [p.birth, getDeath(p)]);
  const minYear = Math.floor(Math.min(...allY, 500) / 100) * 100 - 100;
  const pxPerY = config.pxPerYearBase * state.zoomScale;
  const container = document.getElementById("timeline-container");
  container.scrollLeft =
    (curYear - minYear) * pxPerY - container.offsetWidth / 2;
}

function enterEditMode(p) {
  state.editIndex = people.indexOf(p);
  document.getElementById("person-name").value = p.name;
  document.getElementById("person-birth").value = p.birth;
  document.getElementById("person-death").value = p.death || "";
  document.getElementById("person-category").value = p.category;
  document.getElementById("person-memo").value = p.memo || "";
  state.selectedTagColor = p.tagColor || "";
  document
    .querySelectorAll(".tag-option")
    .forEach((el) =>
      el.classList.toggle("selected", el.dataset.color === p.tagColor),
    );
  document.getElementById("form-title").textContent = "📝 編集モード";
  document
    .querySelectorAll(".btn-secondary, .btn-danger, #edit-status")
    .forEach((el) => el.classList.remove("hidden"));
}

function exitEditMode() {
  state.editIndex = null;
  document.getElementById("add-person-form").reset();
  state.selectedTagColor = "";
  document
    .querySelectorAll(".tag-option")
    .forEach((el) => el.classList.remove("selected"));
  document.getElementById("form-title").textContent = "✏️ 人物を追加";
  document
    .querySelectorAll(".btn-secondary, .btn-danger, #edit-status")
    .forEach((el) => el.classList.add("hidden"));
}

// --- 初期化 ---
window.onload = () => {
  const catWrap = document.getElementById("category-buttons");
  const catSel = document.getElementById("person-category");
  Object.keys(config.categoryColors).forEach((c) => {
    state.categoryVisibility[c] = true;
    const b = document.createElement("button");
    b.className = "btn btn-secondary btn-sm";
    b.style.borderLeft = `5px solid ${config.categoryColors[c]}`;
    b.textContent = c;
    b.onclick = () => {
      state.categoryVisibility[c] = !state.categoryVisibility[c];
      b.style.opacity = state.categoryVisibility[c] ? "1" : "0.3";
      renderTimeline();
    };
    catWrap.appendChild(b);
    catSel.innerHTML += `<option value="${c}">${c}</option>`;
  });

  const tagWrap = document.getElementById("tag-color-selector");
  config.tagColors.forEach((c) => {
    state.tagVisibility[c] = true;
    const opt = document.createElement("div");
    opt.className = "tag-option";
    opt.style.backgroundColor = c;
    opt.dataset.color = c;
    opt.onclick = () => {
      document
        .querySelectorAll(".tag-option")
        .forEach((el) => el.classList.remove("selected"));
      opt.classList.add("selected");
      state.selectedTagColor = c;
    };
    tagWrap.appendChild(opt);
  });

  renderTagLegend();
  renderTimeline();
  setTimeout(scrollToToday, 300);

  // イベント登録
  document.getElementById("timeline-container").onscroll = (e) =>
    (document.getElementById("timeline-axis").scrollLeft = e.target.scrollLeft);
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
  document.getElementById("delete-button").onclick = () => {
    if (confirm("削除しますか？")) {
      people.splice(state.editIndex, 1);
      localStorage.setItem("peopleData", JSON.stringify(people));
      exitEditMode();
      renderTimeline();
    }
  };

  document.getElementById("add-person-form").onsubmit = (e) => {
    e.preventDefault();
    const d = {
      name: document.getElementById("person-name").value,
      birth: parseInt(document.getElementById("person-birth").value),
      death: parseInt(document.getElementById("person-death").value) || 0,
      category: document.getElementById("person-category").value,
      tagColor: state.selectedTagColor,
      memo: document.getElementById("person-memo").value,
    };
    if (state.editIndex !== null) people[state.editIndex] = d;
    else people.push(d);
    localStorage.setItem("peopleData", JSON.stringify(people));
    exitEditMode();
    renderTimeline();
  };

  // モーダル
  const modal = document.getElementById("tag-settings-modal");
  document.getElementById("open-tag-settings").onclick = () => {
    const cont = document.getElementById("tag-names-container");
    cont.innerHTML = "";
    config.tagColors.forEach((c) => {
      cont.innerHTML += `<div class="tag-setting-row">
        <div class="tag-color-sample" style="background-color:${c}"></div>
        <input type="text" id="tn-${c}" value="${tagNames[c] || ""}" placeholder="意味を入力...">
      </div>`;
    });
    modal.classList.remove("hidden");
  };
  document.getElementById("save-tag-settings").onclick = () => {
    config.tagColors.forEach(
      (c) => (tagNames[c] = document.getElementById(`tn-${c}`).value),
    );
    localStorage.setItem("tagNamesData", JSON.stringify(tagNames));
    modal.classList.add("hidden");
    renderTagLegend();
    renderTimeline();
  };
  document.getElementById("close-tag-settings").onclick = () =>
    modal.classList.add("hidden");
};
