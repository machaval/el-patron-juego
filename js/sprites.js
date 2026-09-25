import { BUGS, CONNECTORS } from "./levels.js";

function makeCanvas(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  draw(context, w, h);
  return canvas;
}

function disc(context, x, y, radius, color) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function oval(context, x, y, rx, ry, color) {
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  context.fill();
}

function pxBox(context, x, y, w, h, color) {
  context.fillStyle = color;
  context.fillRect(x, y, w, h);
}

function drawSidekick(context, kick, fire) {
  oval(context, 22, 26, 11, 14, "#143848");
  oval(context, 22, 24, 7, 6, "#00a1e0");
  disc(context, 22, 24, 2.4, "#0c2c3c");
  disc(context, 22, 13, 7, "#2a1c12");
  disc(context, 22, 14.5, 6.2, "#e8b898");
  oval(context, 22, 10.5, 6.4, 2.8, "#3a2818");
  disc(context, 20, 14.2, 1, "#1a1410");
  disc(context, 25, 14.2, 1, "#1a1410");
  oval(context, 8, 28, 5, 2.2, "#0a2430");
  oval(context, 8 + kick, 29, 6, 2.2, "#00a1e0");
  oval(context, 10, 36, 5, 2.2, "#0a2430");
  oval(context, 10 - kick, 37, 6, 2.2, "#00a1e0");
  oval(context, 34, 26, 3, 2, "#e8b898");
  if (fire) {
    pxBox(context, 32, 22, 18, 7, "#3a3a3a");
    pxBox(context, 48, 23, 8, 5, "#6a6a6a");
    pxBox(context, 54, 24, 8, 3, "#c04020");
  } else {
    pxBox(context, 32, 23, 14, 6, "#3a3a3a");
    pxBox(context, 44, 24, 6, 4, "#6a6a6a");
  }
}

function drawShark(context, frame) {
  const wag = frame ? 10 : -10;
  context.fillStyle = "#5a6e7c";
  context.beginPath();
  context.moveTo(18, 28);
  context.quadraticCurveTo(48, 4, 108, 24);
  context.quadraticCurveTo(48, 46, 18, 30);
  context.closePath();
  context.fill();
  context.fillStyle = "#7a90a0";
  context.beginPath();
  context.moveTo(28, 24);
  context.quadraticCurveTo(56, 10, 100, 22);
  context.quadraticCurveTo(56, 28, 28, 26);
  context.closePath();
  context.fill();
  context.fillStyle = "#3a4c58";
  context.beginPath();
  context.moveTo(58, 12);
  context.lineTo(72, -2);
  context.lineTo(74, 16);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(18, 26);
  context.lineTo(0, 16 + wag * 0.3);
  context.lineTo(6, 28);
  context.lineTo(0, 38 - wag * 0.3);
  context.lineTo(18, 30);
  context.closePath();
  context.fill();
  context.fillStyle = "#4a6070";
  context.beginPath();
  context.moveTo(70, 34);
  context.lineTo(92, 46);
  context.lineTo(62, 36);
  context.closePath();
  context.fill();
  context.fillStyle = "#d8e4ea";
  context.beginPath();
  context.moveTo(30, 30);
  context.quadraticCurveTo(60, 36, 96, 26);
  context.quadraticCurveTo(60, 32, 30, 30);
  context.fill();
  context.strokeStyle = "#2a343c";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(88, 28);
  context.quadraticCurveTo(104, 26, 112, 24);
  context.stroke();
  context.fillStyle = "#e8eef2";
  context.beginPath();
  context.moveTo(100, 24);
  context.lineTo(114, 20);
  context.lineTo(114, 28);
  context.closePath();
  context.fill();
  disc(context, 96, 20, 3.2, "#111");
  disc(context, 97, 19, 1.1, "#fff");
  context.strokeStyle = "#c8d0d4";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(104, 26);
  context.lineTo(112, 23);
  context.moveTo(104, 27);
  context.lineTo(112, 28);
  context.stroke();
  context.strokeStyle = "rgba(20,30,36,0.45)";
  context.beginPath();
  context.moveTo(40, 32);
  context.quadraticCurveTo(62, 36, 84, 30);
  context.stroke();
}

export function createSprites() {
  const sprites = { hero: { ready: false }, side: {} };
  const makeHeroImages = () => {
    const names = ["idle", "swim", "swim_2", "swim_3", "shout", "dive", "hurt", "thumbs", "ray"];
    let remaining = names.length;
    const settled = new Set();
    function settle(name) {
      if (settled.has(name)) return;
      settled.add(name);
      remaining--;
      if (remaining === 0) {
        sprites.hero.ready = Boolean(sprites.hero.swim);
        if (!sprites.hero.ready) console.warn("Hero swim sprite failed to load; using the fallback shape.");
      }
    }
    names.forEach((name) => {
      const image = new Image();
      image.onload = () => { sprites.hero[name] = image; settle(name); };
      image.onerror = () => {
        console.warn("Could not load optional hero sprite: assets/" + name + ".png");
        settle(name);
      };
      image.src = "assets/" + name + ".png";
    });
  };
  makeHeroImages();

  sprites.side.idle = makeCanvas(64, 46, (g) => drawSidekick(g, 0, false));
  sprites.side.kickA = makeCanvas(64, 46, (g) => drawSidekick(g, 4, false));
  sprites.side.kickB = makeCanvas(64, 46, (g) => drawSidekick(g, -4, false));
  sprites.side.fire = makeCanvas(70, 46, (g) => drawSidekick(g, 2, true));

  function sapCannon(g) {
    pxBox(g, 18, 8, 28, 48, "#0d6b4a");
    pxBox(g, 22, 12, 20, 40, "#085c3e");
    disc(g, 32, 32, 10, "#f2a900");
    g.fillStyle = "#fff";
    g.font = "bold 11px sans-serif";
    g.fillText("SAP", 21, 36);
    pxBox(g, 4, 26, 16, 10, "#333");
    pxBox(g, 0, 28, 8, 6, "#666");
  }
  sprites.cannonL = makeCanvas(50, 64, sapCannon);
  sprites.cannonR = makeCanvas(50, 64, (g) => {
    g.translate(50, 0);
    g.scale(-1, 1);
    sapCannon(g);
  });
  sprites.bolt = makeCanvas(18, 8, (g) => {
    pxBox(g, 0, 2, 18, 4, "#f2a900");
    pxBox(g, 12, 0, 6, 8, "#ffe08a");
  });
  sprites.shark = [makeCanvas(118, 50, (g) => drawShark(g, 0)), makeCanvas(118, 50, (g) => drawShark(g, 1))];
  sprites.rocket = makeCanvas(22, 10, (g) => {
    pxBox(g, 6, 2, 14, 6, "#c04020");
    pxBox(g, 0, 3, 8, 4, "#888");
    pxBox(g, 18, 1, 4, 8, "#f0d060");
  });
  sprites.bugs = BUGS.map((bug) => makeCanvas(44, 36, (g) => {
    oval(g, 22, 20, 16, 12, bug.color);
    oval(g, 22, 18, 13, 9, "#1a1014");
    disc(g, 16, 16, 3, "#fff");
    disc(g, 28, 16, 3, "#fff");
    disc(g, 16, 16, 1.4, "#111");
    disc(g, 28, 16, 1.4, "#111");
    g.strokeStyle = bug.color;
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(8, 22 + i * 3); g.lineTo(2, 18 + i * 4); g.stroke();
      g.beginPath(); g.moveTo(36, 22 + i * 3); g.lineTo(42, 18 + i * 4); g.stroke();
    }
    g.fillStyle = "#fff";
    g.font = "bold 8px sans-serif";
    g.fillText(bug.short, 12, 28);
  }));
  sprites.connectors = CONNECTORS.map((connector) => makeCanvas(36, 36, (g) => {
    disc(g, 18, 18, 16, "#0a2430");
    disc(g, 18, 18, 14, connector.bg);
    disc(g, 13, 13, 4, "rgba(255,255,255,0.35)");
    g.fillStyle = "#fff";
    g.font = "bold 8px sans-serif";
    const width = g.measureText(connector.name).width;
    g.fillText(connector.name, 18 - width / 2, 21);
  }));
  sprites.flag = makeCanvas(40, 48, (g) => {
    pxBox(g, 6, 4, 4, 44, "#ddd");
    g.fillStyle = "#0d6b4a";
    g.beginPath(); g.moveTo(10, 6); g.lineTo(38, 16); g.lineTo(10, 26); g.fill();
    g.fillStyle = "#f2a900";
    g.font = "bold 8px sans-serif";
    g.fillText("SAP", 12, 18);
  });
  sprites.bubble = makeCanvas(8, 8, (g) => {
    disc(g, 4, 4, 3, "rgba(180,230,255,0.5)");
    disc(g, 3, 3, 1, "#fff");
  });
  return sprites;
}
