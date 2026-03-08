// ── Game Engine ────────────────────────────────────────────

const Engine = (() => {
  // ── Helpers ──
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[rand(0, arr.length - 1)];

  // ── Character state ──
  let char = null;   // current character
  let running = false;
  let tickTimer = null;

  // ── Action state ──
  let action = { type: "idle", progress: 0, duration: 0, label: "" };

  // ── Callbacks (set by UI) ──
  let onTick = null;
  let onLog = null;
  let onLevelUp = null;

  // ── Stat rolling ──
  function rollStats() {
    const stats = {};
    DATA.statNames.forEach(s => {
      // 3d6 roll
      stats[s] = rand(1, 6) + rand(1, 6) + rand(1, 6);
    });
    return stats;
  }

  // ── Character creation ──
  function createCharacter(name, raceIdx, classIdx, baseStats) {
    const race = DATA.races[raceIdx];
    const cls = DATA.classes[classIdx];

    const stats = {};
    DATA.statNames.forEach(s => {
      stats[s] = baseStats[s] + (race.bonuses[s] || 0);
    });

    const maxHp = Math.floor((10 + stats.CON) * cls.hpMul);
    const maxMp = Math.floor((5 + stats.INT) * cls.mpMul);

    char = {
      name,
      race: race.name,
      class: cls.name,
      level: 1,
      exp: 0,
      expToLevel: 100,
      stats,
      maxHp,
      hp: maxHp,
      maxMp,
      mp: maxMp,
      gold: 0,
      equipment: {},
      inventory: [],
      spells: [...cls.skills],
      kills: 0,
      quest: null,
      questProgress: 0,
      questGoal: 0,
      questsCompleted: 0,
    };

    // Initialize empty equipment slots
    DATA.equipSlots.forEach(slot => {
      char.equipment[slot] = null;
    });

    // Generate first quest
    generateQuest();

    return char;
  }

  // ── Experience & Leveling ──
  function addExp(amount) {
    char.exp += amount;
    while (char.exp >= char.expToLevel) {
      char.exp -= char.expToLevel;
      char.level++;
      char.expToLevel = Math.floor(char.expToLevel * 1.15 + 50);

      // Stat gains
      const statUp = pick(DATA.statNames);
      char.stats[statUp] += 1;

      // HP/MP recalc
      const cls = DATA.classes.find(c => c.name === char.class);
      char.maxHp = Math.floor((10 + char.stats.CON + char.level * 2) * cls.hpMul);
      char.maxMp = Math.floor((5 + char.stats.INT + char.level) * cls.mpMul);
      char.hp = char.maxHp;
      char.mp = char.maxMp;

      // Learn spell occasionally
      if (char.level % 3 === 0 && char.spells.length < 12) {
        const available = DATA.spells.filter(s => !char.spells.includes(s));
        if (available.length > 0) {
          const newSpell = pick(available);
          char.spells.push(newSpell);
          log(`Learned new spell: ${newSpell}!`);
        }
      }

      if (onLevelUp) onLevelUp(char.level, statUp);
      log(`LEVEL UP! Now level ${char.level}. ${statUp} increased!`);
    }
  }

  // ── Monster tier for current level ──
  function getMonsterTier() {
    if (char.level <= 5) return 0;
    if (char.level <= 10) return 1;
    if (char.level <= 20) return 2;
    if (char.level <= 35) return 3;
    return 4;
  }

  // ── Loot generation ──
  function generateLoot(monsterTier) {
    // 40% chance to get loot
    if (Math.random() > 0.4) return null;

    const prefixIdx = Math.min(monsterTier + rand(0, 2), DATA.lootPrefixes.length - 1);
    const prefix = DATA.lootPrefixes[prefixIdx];
    const type = pick(DATA.lootTypes);
    const name = prefix ? `${prefix} ${type}` : type;
    const value = rand(1, 5) * (monsterTier + 1) * 10;

    return { name, value, tier: monsterTier };
  }

  // ── Quest generation ──
  function generateQuest() {
    const verb = pick(DATA.questPrefixes);
    const target = pick(DATA.questTargets);
    char.quest = `${verb} ${target}`;
    char.questProgress = 0;
    char.questGoal = rand(3, 6 + char.level);
  }

  // ── Logging ──
  function log(msg) {
    if (onLog) onLog(msg);
  }

  // ── Combat action ──
  function startCombat() {
    const tier = getMonsterTier();
    const monstersOfTier = DATA.monsters.filter(m => m.tier <= tier);
    const monster = pick(monstersOfTier);

    const baseDuration = Math.max(1500 - char.level * 20, 400);
    const duration = baseDuration + rand(-200, 400);

    action = {
      type: "combat",
      progress: 0,
      duration,
      label: `Fighting ${monster.name}...`,
      monster: monster.name,
      monsterTier: tier,
    };
  }

  function completeCombat() {
    const tier = action.monsterTier;
    const monsterName = action.monster;

    // Exp based on tier
    const expGain = rand(5, 15) * (tier + 1) + char.level;
    addExp(expGain);
    char.kills++;
    char.gold += rand(1, 5) * (tier + 1);

    log(`Defeated ${monsterName}! +${expGain} XP`);

    // Quest progress
    char.questProgress++;
    if (char.questProgress >= char.questGoal) {
      const questGold = rand(20, 50) * (char.level);
      char.gold += questGold;
      char.questsCompleted++;
      const questExp = rand(30, 60) * (char.level);
      addExp(questExp);
      log(`Quest Complete: "${char.quest}"! +${questGold} gold, +${questExp} XP`);
      generateQuest();
    }

    // Loot
    const loot = generateLoot(tier);
    if (loot) {
      log(`Found: ${loot.name} (${loot.value}g)`);

      // Try to equip if it's an equipment type
      const slotMap = {
        "Sword": "Weapon", "Axe": "Weapon", "Mace": "Weapon",
        "Staff": "Weapon", "Dagger": "Weapon", "Bow": "Weapon",
        "Shield": "Shield", "Helm": "Helm",
        "Chainmail": "Chest", "Plate Armor": "Chest", "Leather Armor": "Chest",
        "Boots": "Boots", "Gauntlets": "Gloves",
        "Ring": "Ring", "Amulet": "Amulet", "Cloak": "Chest",
      };

      const baseType = DATA.lootTypes.find(t => loot.name.endsWith(t));
      const slot = slotMap[baseType];

      if (slot) {
        const current = char.equipment[slot];
        if (!current || current.value < loot.value) {
          if (current) {
            char.inventory.push(current);
          }
          char.equipment[slot] = loot;
          log(`Equipped ${loot.name} in ${slot} slot`);
        } else {
          char.inventory.push(loot);
        }
      } else {
        char.inventory.push(loot);
      }

      // Cap inventory size - sell cheapest items
      while (char.inventory.length > 20) {
        char.inventory.sort((a, b) => a.value - b.value);
        const sold = char.inventory.shift();
        char.gold += Math.floor(sold.value / 2);
        log(`Sold ${sold.name} for ${Math.floor(sold.value / 2)}g`);
      }
    }
  }

  // ── Resting action ──
  function startRest() {
    action = {
      type: "rest",
      progress: 0,
      duration: rand(800, 1200),
      label: "Resting...",
    };
  }

  function completeRest() {
    char.hp = char.maxHp;
    char.mp = char.maxMp;
  }

  // ── Main tick (called every frame) ──
  const TICK_INTERVAL = 50; // ms

  function tick() {
    if (!running || !char) return;

    action.progress += TICK_INTERVAL;

    if (action.progress >= action.duration) {
      // Complete current action
      if (action.type === "combat") {
        completeCombat();
      } else if (action.type === "rest") {
        completeRest();
      }

      // Decide next action
      // Occasionally rest (10% chance)
      if (Math.random() < 0.1) {
        startRest();
      } else {
        startCombat();
      }
    }

    if (onTick) onTick();
  }

  // ── Public API ──
  return {
    rollStats,
    createCharacter,

    start() {
      running = true;
      startCombat();
      tickTimer = setInterval(tick, TICK_INTERVAL);
    },

    stop() {
      running = false;
      if (tickTimer) clearInterval(tickTimer);
    },

    getChar() { return char; },
    getAction() { return action; },

    set onTick(fn) { onTick = fn; },
    set onLog(fn) { onLog = fn; },
    set onLevelUp(fn) { onLevelUp = fn; },
  };
})();
