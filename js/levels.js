export const BUGS = [
  { name: "NPE", color: "#c04050", short: "NPE" },
  { name: "StackOverflow", color: "#c47828", short: "SO" },
  { name: "Classloader", color: "#7a4bb8", short: "CL" }
];

export const CONNECTORS = [
  { name: "HTTP", bg: "#00a1e0" },
  { name: "DB", bg: "#2d8a4e" },
  { name: "SFDC", bg: "#00a1e0" },
  { name: "JMS", bg: "#c45c26" },
  { name: "FTP", bg: "#7a4bb8" },
  { name: "S3", bg: "#c47828" },
  { name: "SAP", bg: "#0d6b4a" },
  { name: "DW", bg: "#00a1e0" }
];

export const LEVELS = [
  {
    name: "SAP TERRITORY", sub: "El Patrón alone. Dodge cannons and sharks.",
    sky: ["#08362c", "#0a4a3a", "#041814"], accent: "#f2a900",
    length: 4200, speed: 3.15, gravity: 0.28, flap: -5.6,
    cannons: true, fire: false, sharks: 4, bugs: false, connectors: 0, squad: 0, killN: 0, shouts: 0
  },
  {
    name: "ANYPOINT STUDIO", sub: "Hit every ball. Miss = damage. T kills a shark.",
    sky: ["#102030", "#1a3850", "#081018"], accent: "#00a1e0",
    length: 4600, speed: 3.35, gravity: 0.3, flap: -5.7,
    cannons: false, fire: false, sharks: 5, bugs: false, connectors: 6, squad: 1, killN: 1, shouts: 3
  },
  {
    name: "DATAWEAVE CHASM", sub: "Squad of 2. Trabajeen clears 6.",
    sky: ["#061828", "#123050", "#081018"], accent: "#c4b070",
    length: 5000, speed: 3.5, gravity: 0.32, flap: -5.8,
    cannons: true, fire: true, sharks: 3, bugs: true, connectors: 7, squad: 2, killN: 6, shouts: 9
  },
  {
    name: "API PLATFORM", sub: "Squad of 3. Route and survive.",
    sky: ["#102838", "#1a4860", "#0a1820"], accent: "#7fd7ff",
    length: 5200, speed: 3.65, gravity: 0.33, flap: -5.9,
    cannons: true, fire: true, bugs: true, connectors: 8, squad: 3, killN: 9, shouts: 6
  },
  {
    name: "MULE 4 ABYSS", sub: "High pressure. Squad of 4.",
    sky: ["#020810", "#061828", "#010408"], accent: "#204060",
    length: 5400, speed: 3.8, gravity: 0.36, flap: -6.1,
    cannons: true, fire: true, bugs: true, connectors: 8, squad: 4, killN: 12, shouts: 6
  },
  {
    name: "IPO CONTROL PLANE", sub: "Full squad. Cash the vault.",
    sky: ["#101018", "#2a1840", "#080810"], accent: "#d4a017",
    length: 5600, speed: 3.9, gravity: 0.34, flap: -6.0,
    cannons: true, fire: true, bugs: true, connectors: 8, squad: 5, killN: 15, shouts: 6
  }
];

export function createRunSeed() {
  try {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] || 1;
  } catch {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
  }
}

export function createSeededRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function levelSeed(runSeed, level) {
  return (runSeed ^ Math.imul(level + 1, 0x9e3779b9)) >>> 0;
}
