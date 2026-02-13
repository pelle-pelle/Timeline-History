// --- 設定とデータ ---
const config = {
  pxPerYearBase: 4,
  rowHeight: 42,
  barMinWidth: 150,
  categoryColors: {
    政治: "#1E88E5",
    "武将・軍事": "#43A047",
    "改革・維新": "#FB8C00",
    "文化・文学・宗教": "#8E24AA",
    "経済・産業・技術": "#E53935",
    天皇: "#D4AF37",
    その他: "#757575",
  },
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

let people = JSON.parse(localStorage.getItem("peopleData")) || [
  {
    name: "神武天皇",
    birth: -711,
    death: -585,
    category: "天皇",
    memo: "初代天皇",
  },
  {
    name: "織田信長",
    birth: 1534,
    death: 1582,
    category: "武将・軍事",
    memo: "本能寺の変",
  },
];

let state = {
  editIndex: null,
  zoomScale: 1,
  searchQuery: "",
  categoryVisibility: {},
};

// --- ユーティリティ ---
const formatYear = (year, isDeath = false) => {
  if (isDeath && (!year || year === 0)) return "現在";
  return year < 0 ? `BC ${Math.abs(year)}` : `${year}年`;
};

const getEffectiveDeath = (p) =>
  p.death === 0 || !p.death ? new Date().getFullYear() : p.death;

// --- 描画ロジック ---
function renderTimeline() {
  const barsContainer = document.getElementById("timeline-bars");
  const eraLayer = document.getElementById("era-background");
  const axisContainer = document.getElementById("timeline-axis");
  if (!barsContainer) return;

  [barsContainer, eraLayer, axisContainer].forEach((el) => (el.innerHTML = ""));

  const visiblePeople = people.filter(
    (p) =>
      state.categoryVisibility[p.category] &&
      p.name.toLowerCase().includes(state.searchQuery.toLowerCase()),
  );

  const currentYear = new Date().getFullYear();
  const allYears = people.flatMap((p) => [p.birth, getEffectiveDeath(p)]);
  const minYear = Math.floor(Math.min(...allYears) / 100) * 100 - 100;
  const maxYear = Math.ceil(Math.max(...allYears) / 100) * 100 + 100;
  const pxPerYear = config.pxPerYearBase * state.zoomScale;
  const totalWidth = (maxYear - minYear) * pxPerYear;

  [barsContainer, eraLayer].forEach(
    (el) => (el.style.width = `${totalWidth}px`),
  );

  // 1. 軸と背景
  renderAxis(axisContainer, minYear, maxYear, pxPerYear);
  renderEras(eraLayer, minYear, maxYear, pxPerYear);
  renderTodayLine(eraLayer, minYear, maxYear, pxPerYear, currentYear);

  // 2. 人物
  const positions = calculatePositions(visiblePeople, minYear, pxPerYear);
  positions.forEach((pos) => renderPersonBar(barsContainer, pos, pxPerYear));
}

function renderAxis(container, minYear, maxYear, pxPerYear) {
  const step = state.zoomScale < 0.5 ? 500 : state.zoomScale < 1.5 ? 100 : 50;
  for (let y = minYear; y <= maxYear; y += step) {
    const label = document.createElement("div");
    label.className = "year-label";
    label.style.left = `${(y - minYear) * pxPerYear}px`;
    label.textContent = formatYear(y);
    container.appendChild(label);
  }
}

function renderEras(container, minYear, maxYear, pxPerYear) {
  config.eras.forEach((era) => {
    if (era.end <= minYear || era.start >= maxYear) return;
    const start = Math.max(era.start, minYear);
    const end = Math.min(era.end, maxYear);
    const div = document.createElement("div");
    div.className = "era-region";
    div.style.left = `${(start - minYear) * pxPerYear}px`;
    div.style.width = `${(end - start) * pxPerYear}px`;
    div.style.backgroundColor = era.color;
    div.innerHTML = `<span>${era.name}</span>`;
    container.appendChild(div);
  });
}

function renderTodayLine(container, minYear, maxYear, pxPerYear, currentYear) {
  if (currentYear < minYear || currentYear > maxYear) return;
  const x = (currentYear - minYear) * pxPerYear;
  const line = document.createElement("div");
  line.className = "today-line";
  line.style.left = `${x}px`;
  line.innerHTML = `<div class="today-label">今日 (${currentYear})</div>`;
  container.appendChild(line);
}

function calculatePositions(visiblePeople, minYear, pxPerYear) {
  const positions = [];
  const sorted = [...visiblePeople].sort((a, b) => a.birth - b.birth);
  sorted.forEach((person) => {
    const startX = (person.birth - minYear) * pxPerYear;
    const width = Math.max(
      config.barMinWidth,
      (getEffectiveDeath(person) - person.birth) * pxPerYear,
    );
    let row = 0;
    while (
      positions.some(
        (p) =>
          p.row === row &&
          !(startX > p.startX + p.width + 40 || startX + width + 40 < p.startX),
      )
    ) {
      row++;
    }
    positions.push({ person, startX, width, row });
  });
  return positions;
}

function renderPersonBar(container, pos, pxPerYear) {
  const p = pos.person;
  const bar = document.createElement("div");
  bar.className = "person-bar";
  bar.style.cssText = `left:${pos.startX}px; width:${pos.width}px; top:${pos.row * config.rowHeight + 20}px; background-color:${config.categoryColors[p.category]}`;
  bar.textContent = `${p.name} (${formatYear(p.birth)} 〜 ${formatYear(p.death, true)})`;

  bar.onclick = (e) => {
    e.stopPropagation();
    enterEditMode(p);
  };
  bar.onmouseover = (e) => showTooltip(e, p);
  bar.onmouseout = hideTooltip;
  container.appendChild(bar);
}

// --- イベント/UI制御 ---
function showTooltip(e, p) {
  const tip = document.getElementById("tooltip");
  tip.innerHTML = `<strong>${p.name}</strong> (${formatYear(p.birth)}〜${formatYear(p.death, true)})<br>${p.memo || ""}`;
  tip.style.display = "block";
  tip.style.left = e.clientX + 15 + "px";
  tip.style.top = e.clientY + 15 + "px";
}
const hideTooltip = () =>
  (document.getElementById("tooltip").style.display = "none");

function enterEditMode(person) {
  state.editIndex = people.indexOf(person);
  ["name", "birth", "death", "category", "memo"].forEach((key) => {
    document.getElementById(`person-${key}`).value =
      person[key] || (key === "death" ? 0 : "");
  });
  document.getElementById("form-title").textContent = "📝 人物を編集";
  document
    .querySelectorAll(".btn-secondary, .btn-danger, #edit-status")
    .forEach((el) => el.classList.remove("hidden"));
}

function exitEditMode() {
  state.editIndex = null;
  document.getElementById("add-person-form").reset();
  document.getElementById("form-title").textContent = "✏️ 人物を追加";
  document
    .querySelectorAll(".btn-secondary, .btn-danger, #edit-status")
    .forEach((el) => el.classList.add("hidden"));
}

// --- 初期化 ---
window.onload = () => {
  // カテゴリ初期化
  const catContainer = document.getElementById("category-buttons");
  const catSelect = document.getElementById("person-category");
  Object.keys(config.categoryColors).forEach((cat) => {
    state.categoryVisibility[cat] = true;
    const btn = document.createElement("button");
    btn.className = "cat-btn active";
    btn.style.backgroundColor = config.categoryColors[cat];
    btn.textContent = cat;
    btn.onclick = () => {
      state.categoryVisibility[cat] = !state.categoryVisibility[cat];
      btn.style.opacity = state.categoryVisibility[cat] ? "1" : "0.3";
      renderTimeline();
    };
    catContainer.appendChild(btn);
    catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
  });

  renderTimeline();

  // スクロール同期
  const container = document.getElementById("timeline-container");
  const axis = document.getElementById("timeline-axis");
  container.onscroll = () => (axis.scrollLeft = container.scrollLeft);

  // 各種イベント
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
    const data = {
      name: document.getElementById("person-name").value,
      birth: parseInt(document.getElementById("person-birth").value),
      death: parseInt(document.getElementById("person-death").value) || 0,
      category: document.getElementById("person-category").value,
      memo: document.getElementById("person-memo").value,
    };
    if (state.editIndex !== null) people[state.editIndex] = data;
    else people.push(data);
    localStorage.setItem("peopleData", JSON.stringify(people));
    exitEditMode();
    renderTimeline();
  };
};
