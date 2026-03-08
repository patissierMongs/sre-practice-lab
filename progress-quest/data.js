// ── Game Data ──────────────────────────────────────────────

const DATA = {
  races: [
    { name: "Human",      bonuses: { STR: 1, INT: 1, WIS: 1, DEX: 1, CON: 1, CHA: 1 } },
    { name: "Elf",        bonuses: { STR: -1, INT: 2, WIS: 2, DEX: 2, CON: -2, CHA: 1 } },
    { name: "Dwarf",      bonuses: { STR: 2, INT: -1, WIS: 1, DEX: -1, CON: 3, CHA: -1 } },
    { name: "Halfling",   bonuses: { STR: -2, INT: 0, WIS: 1, DEX: 3, CON: 0, CHA: 2 } },
    { name: "Orc",        bonuses: { STR: 4, INT: -2, WIS: -1, DEX: 0, CON: 3, CHA: -2 } },
    { name: "Gnome",      bonuses: { STR: -2, INT: 3, WIS: 1, DEX: 1, CON: -1, CHA: 1 } },
    { name: "Half-Troll", bonuses: { STR: 5, INT: -4, WIS: -2, DEX: -1, CON: 4, CHA: -4 } },
    { name: "Drow",       bonuses: { STR: 0, INT: 2, WIS: 0, DEX: 2, CON: -1, CHA: 2 } },
  ],

  classes: [
    { name: "Warrior",     hpMul: 1.3, mpMul: 0.3, skills: ["Power Strike", "Shield Bash"] },
    { name: "Mage",        hpMul: 0.6, mpMul: 1.5, skills: ["Fireball", "Ice Shard"] },
    { name: "Rogue",       hpMul: 0.9, mpMul: 0.5, skills: ["Backstab", "Poison Blade"] },
    { name: "Cleric",      hpMul: 1.0, mpMul: 1.2, skills: ["Holy Light", "Smite"] },
    { name: "Ranger",      hpMul: 1.0, mpMul: 0.7, skills: ["Arrow Rain", "Trap"] },
    { name: "Paladin",     hpMul: 1.2, mpMul: 0.8, skills: ["Divine Strike", "Lay on Hands"] },
    { name: "Necromancer", hpMul: 0.7, mpMul: 1.4, skills: ["Raise Dead", "Soul Drain"] },
    { name: "Bard",        hpMul: 0.8, mpMul: 1.0, skills: ["Inspire", "Lullaby"] },
  ],

  statNames: ["STR", "INT", "WIS", "DEX", "CON", "CHA"],

  equipSlots: [
    "Weapon", "Shield", "Helm", "Chest", "Legs", "Boots", "Gloves", "Ring", "Amulet"
  ],

  monsters: [
    // tier 0 (lvl 1-5)
    { name: "Rat", tier: 0 },
    { name: "Slime", tier: 0 },
    { name: "Kobold", tier: 0 },
    { name: "Bat Swarm", tier: 0 },
    // tier 1 (lvl 6-10)
    { name: "Goblin", tier: 1 },
    { name: "Skeleton", tier: 1 },
    { name: "Giant Spider", tier: 1 },
    { name: "Zombie", tier: 1 },
    // tier 2 (lvl 11-20)
    { name: "Orc Warrior", tier: 2 },
    { name: "Dark Mage", tier: 2 },
    { name: "Harpy", tier: 2 },
    { name: "Ogre", tier: 2 },
    // tier 3 (lvl 21-35)
    { name: "Troll", tier: 3 },
    { name: "Wyvern", tier: 3 },
    { name: "Lich", tier: 3 },
    { name: "Minotaur", tier: 3 },
    // tier 4 (lvl 36+)
    { name: "Dragon", tier: 4 },
    { name: "Demon Lord", tier: 4 },
    { name: "Ancient Wyrm", tier: 4 },
    { name: "Balrog", tier: 4 },
  ],

  lootPrefixes: [
    "", "Rusty", "Worn", "Fine", "Superior", "Enchanted", "Legendary", "Divine", "Mythic"
  ],

  lootTypes: [
    "Sword", "Axe", "Mace", "Staff", "Dagger", "Bow",
    "Shield", "Helm", "Chainmail", "Plate Armor", "Leather Armor",
    "Boots", "Gauntlets", "Ring", "Amulet", "Cloak", "Potion", "Scroll"
  ],

  questPrefixes: [
    "Seek", "Destroy", "Deliver", "Protect", "Retrieve", "Purify", "Avenge", "Infiltrate"
  ],

  questTargets: [
    "the Lost Shrine", "the Dark Forest", "the Dragon's Lair",
    "the Forgotten Tomb", "the Cursed Village", "the Shadow Realm",
    "the Crystal Cavern", "the Goblin Fortress", "the Sunken Temple",
    "the Demon Gate", "the Frozen Peaks", "the Enchanted Tower"
  ],

  firstNames: [
    "Aldric", "Brynn", "Cedric", "Daria", "Elric", "Freya",
    "Gareth", "Helena", "Ivar", "Jaina", "Kael", "Luna",
    "Magnus", "Nyx", "Orin", "Petra", "Quinn", "Rowan",
    "Seren", "Theron", "Ulric", "Vala", "Wren", "Xander"
  ],

  lastNames: [
    "Ironforge", "Shadowmend", "Stormborn", "Brightblade", "Darkhollow",
    "Frostweaver", "Goldleaf", "Hawkwind", "Moonfire", "Nightshade",
    "Oakenshield", "Ravencrest", "Silverthorn", "Thunderhelm", "Wyrmslayer"
  ],

  spells: [
    "Magic Missile", "Cure Light Wounds", "Flame Tongue", "Frost Nova",
    "Lightning Bolt", "Shield of Faith", "Shadow Step", "Bless",
    "Earthquake", "Haste", "Invisibility", "Polymorph",
    "Resurrection", "Meteor Storm", "Time Stop", "Wish"
  ]
};
