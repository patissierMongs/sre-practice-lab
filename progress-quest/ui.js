// ── UI Controller ──────────────────────────────────────────

(() => {
  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);

  const screens = {
    create: $("screen-create"),
    game: $("screen-game"),
  };

  // Creation screen
  const nameInput = $("char-name");
  const btnRandomName = $("btn-random-name");
  const raceList = $("race-list");
  const classList = $("class-list");
  const statRolls = $("stat-rolls");
  const btnReroll = $("btn-reroll");
  const btnStart = $("btn-start");

  // Game screen
  const headerName = $("header-name");
  const headerInfo = $("header-info");
  const actionTitle = $("action-title");
  const actionBar = $("action-bar");
  const actionLabel = $("action-label");
  const expBar = $("exp-bar");
  const expLabel = $("exp-label");
  const questName = $("quest-name");
  const questBar = $("quest-bar");
  const questLabel = $("quest-label");
  const statsDisplay = $("stats-display");
  const equipDisplay = $("equipment-display");
  const invDisplay = $("inventory-display");
  const invCount = $("inventory-count");
  const spellsDisplay = $("spells-display");
  const combatLog = $("combat-log");

  // ── State ──
  let selectedRace = -1;
  let selectedClass = -1;
  let currentStats = null;
  const logEntries = [];
  const MAX_LOG = 50;

  // ── Character Creation ──
  function initCreation() {
    // Races
    DATA.races.forEach((race, i) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = race.name;
      btn.addEventListener("click", () => selectRace(i));
      raceList.appendChild(btn);
    });

    // Classes
    DATA.classes.forEach((cls, i) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = cls.name;
      btn.addEventListener("click", () => selectClass(i));
      classList.appendChild(btn);
    });

    // Initial roll
    rerollStats();

    // Events
    btnRandomName.addEventListener("click", randomName);
    btnReroll.addEventListener("click", rerollStats);
    btnStart.addEventListener("click", startGame);
    nameInput.addEventListener("input", checkReady);

    // Start with a random name
    randomName();
  }

  function randomName() {
    const first = DATA.firstNames[Math.floor(Math.random() * DATA.firstNames.length)];
    const last = DATA.lastNames[Math.floor(Math.random() * DATA.lastNames.length)];
    nameInput.value = `${first} ${last}`;
    checkReady();
  }

  function selectRace(idx) {
    selectedRace = idx;
    const btns = raceList.querySelectorAll(".option-btn");
    btns.forEach((b, i) => b.classList.toggle("selected", i === idx));
    checkReady();
  }

  function selectClass(idx) {
    selectedClass = idx;
    const btns = classList.querySelectorAll(".option-btn");
    btns.forEach((b, i) => b.classList.toggle("selected", i === idx));
    checkReady();
  }

  function rerollStats() {
    currentStats = Engine.rollStats();
    statRolls.innerHTML = "";
    DATA.statNames.forEach(name => {
      const cell = document.createElement("div");
      cell.className = "stat-cell";
      cell.innerHTML = `<div class="stat-name">${name}</div><div class="stat-val">${currentStats[name]}</div>`;
      statRolls.appendChild(cell);
    });
  }

  function checkReady() {
    btnStart.disabled = !(nameInput.value.trim() && selectedRace >= 0 && selectedClass >= 0);
  }

  // ── Start Game ──
  function startGame() {
    const char = Engine.createCharacter(
      nameInput.value.trim(),
      selectedRace,
      selectedClass,
      currentStats
    );

    screens.create.classList.remove("active");
    screens.game.classList.add("active");

    // Wire up callbacks
    Engine.onTick = renderGame;
    Engine.onLog = addLogEntry;
    Engine.onLevelUp = () => {}; // handled in log

    renderGame();
    Engine.start();
  }

  // ── Game Rendering ──
  function renderGame() {
    const char = Engine.getChar();
    const action = Engine.getAction();
    if (!char) return;

    // Header
    headerName.textContent = char.name;
    headerInfo.textContent = `Lv.${char.level} ${char.race} ${char.class} | HP: ${char.hp}/${char.maxHp} | MP: ${char.mp}/${char.maxMp} | Gold: ${char.gold} | Kills: ${char.kills}`;

    // Action bar
    const actionPct = Math.min((action.progress / action.duration) * 100, 100);
    actionTitle.textContent = action.label || "Idle";
    actionBar.style.width = actionPct + "%";
    actionLabel.textContent = Math.floor(actionPct) + "%";

    // EXP bar
    const expPct = (char.exp / char.expToLevel) * 100;
    expBar.style.width = expPct + "%";
    expLabel.textContent = `${char.exp} / ${char.expToLevel}`;

    // Quest
    questName.textContent = char.quest || "No quest";
    const qPct = char.questGoal > 0 ? (char.questProgress / char.questGoal) * 100 : 0;
    questBar.style.width = qPct + "%";
    questLabel.textContent = `${char.questProgress} / ${char.questGoal}`;

    // Stats
    renderStats(char);

    // Equipment
    renderEquipment(char);

    // Inventory
    renderInventory(char);

    // Spells
    renderSpells(char);
  }

  function renderStats(char) {
    let html = "";
    // Main stats
    DATA.statNames.forEach(s => {
      html += `<div class="stat-row"><span class="label">${s}</span><span class="value">${char.stats[s]}</span></div>`;
    });
    // Derived stats
    html += `<div class="stat-row"><span class="label">Level</span><span class="value">${char.level}</span></div>`;
    html += `<div class="stat-row"><span class="label">Quests</span><span class="value">${char.questsCompleted}</span></div>`;
    statsDisplay.innerHTML = html;
  }

  function renderEquipment(char) {
    let html = "";
    DATA.equipSlots.forEach(slot => {
      const item = char.equipment[slot];
      if (item) {
        html += `<div class="equip-row"><span class="slot">${slot}</span><span class="item">${item.name}</span></div>`;
      } else {
        html += `<div class="equip-row"><span class="slot">${slot}</span><span class="empty">-empty-</span></div>`;
      }
    });
    equipDisplay.innerHTML = html;
  }

  function renderInventory(char) {
    invCount.textContent = `${char.inventory.length}/20`;
    let html = "";
    char.inventory.forEach(item => {
      html += `<div class="inv-item"><span class="name">${item.name}</span><span class="gold">${item.value}g</span></div>`;
    });
    if (char.inventory.length === 0) {
      html = '<div style="color:var(--text-dim);font-size:0.8rem;font-style:italic;">Empty</div>';
    }
    invDisplay.innerHTML = html;
  }

  function renderSpells(char) {
    let html = "";
    char.spells.forEach(spell => {
      html += `<span class="spell-tag">${spell}</span>`;
    });
    spellsDisplay.innerHTML = html;
  }

  // ── Combat Log ──
  function addLogEntry(msg) {
    let cls = "log-entry";
    if (msg.includes("LEVEL UP")) cls += " level-up";
    else if (msg.includes("Quest Complete")) cls += " quest-complete";
    else if (msg.includes("Found:")) cls += " loot";

    logEntries.unshift({ msg, cls });
    if (logEntries.length > MAX_LOG) logEntries.pop();

    let html = "";
    logEntries.forEach(e => {
      html += `<div class="${e.cls}">${e.msg}</div>`;
    });
    combatLog.innerHTML = html;
  }

  // ── Init ──
  initCreation();
})();
