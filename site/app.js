// little TAI — The Feelings Collection · showcase page
// Renders everything from data.json (written by `npm run build:site`), so only assets that exist are shown.

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c);
  return node;
};

/** "greet_01" → "greet", "heart_pose" → "heart pose" */
const clipLabel = (name) => name.replace(/^.*[|:]/, "").replace(/_0\d$/, "").replace(/_/g, " ");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const data = await fetch("data.json", { cache: "no-cache" }).then((r) => r.json());
const editions = data.editions;

// ---- hero film ----------------------------------------------------------------------------------
const hero = $("#hero-video");
if (data.film?.portrait) {
  hero.src = data.film.portrait;
  if (data.film.poster) hero.poster = data.film.poster;
  if (!reducedMotion) hero.play().catch(() => {});
  else hero.controls = true;
} else {
  hero.closest(".hero-film").hidden = true;
}
const soundBtn = $("#sound-toggle");
soundBtn.addEventListener("click", () => {
  const on = hero.muted;
  hero.muted = !on;
  if (on) {
    hero.currentTime = 0;
    hero.play().catch(() => {});
  }
  soundBtn.setAttribute("aria-pressed", String(on));
  soundBtn.textContent = on ? "Sound off" : "Sound on";
});

// ---- "after hours" short --------------------------------------------------------------------------
if (data.short?.video) {
  const v = $("#short-video");
  v.src = data.short.video;
  if (data.short.poster) v.poster = data.short.poster;
  $("#short").hidden = false;
}

// ---- collection grid ----------------------------------------------------------------------------
const grid = $("#card-grid");
for (const e of editions) {
  if (!e.card) continue;
  const card = el(
    "button",
    {
      class: `card${e.secret ? " is-sealed" : ""}`,
      type: "button",
      "aria-label": e.secret ? "Secret edition — tap to reveal" : `${e.label} — open 3D viewer`,
      onclick: () => {
        if (card.classList.contains("is-sealed")) {
          card.classList.remove("is-sealed");
          card.setAttribute("aria-label", `${e.label} — open 3D viewer`);
          label.textContent = e.name;
          return;
        }
        openViewer(e);
      },
    },
    el(
      "div",
      { class: "card-inner" },
      el("div", { class: "card-face" }, el("img", { src: e.card, alt: `${e.name} collectible card`, loading: "lazy", width: 900, height: 1260 })),
      e.secret ? el("div", { class: "card-face card-back" }, el("div", {}, el("strong", {}, "???"), el("span", {}, "TAP TO REVEAL"))) : null,
    ),
  );
  const label = el("span", { class: "card-label" }, e.secret ? "??? — Secret" : e.name);
  grid.append(el("div", { class: "card-wrap" }, card, label, el("small", {}, e.rarity)));
}

// ---- packaging ----------------------------------------------------------------------------------
const boxRow = $("#box-row");
for (const e of editions) {
  if (!e.box) continue;
  boxRow.append(el("figure", {}, el("img", { src: e.box, alt: `${e.secret ? "Secret edition" : e.name} blind box`, loading: "lazy" }), el("figcaption", {}, e.secret ? "??? · MIDNIGHT" : `${e.number} · ${e.tagline}`)));
}
if (!boxRow.children.length) $("#packaging").hidden = true;

// ---- reveal clips -------------------------------------------------------------------------------
const clipRow = $("#clip-row");
for (const e of editions) {
  if (!e.clip) continue;
  const v = el("video", { src: e.clip, muted: true, loop: true, playsinline: true, preload: "none", controls: true, "aria-label": `${e.label} reveal clip` });
  v.muted = true;
  clipRow.append(v);
}
if (!clipRow.children.length) $("#reveals").hidden = true;
// play clips only while visible
if ("IntersectionObserver" in window && !reducedMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) en.target.play().catch(() => {});
        else en.target.pause();
      }
    },
    { threshold: 0.6 },
  );
  clipRow.querySelectorAll("video").forEach((v) => io.observe(v));
}

// ---- widescreen film + lineup -------------------------------------------------------------------
const wide = $("#wide-video");
if (data.film?.landscape) {
  wide.src = data.film.landscape;
  if (data.film.posterLandscape) wide.poster = data.film.posterLandscape;
} else wide.closest(".film-wide").hidden = true;
if (data.lineup) {
  $("#lineup").append(el("img", { src: data.lineup, alt: "The five little TAI figures lined up, the Midnight Star in the centre", loading: "lazy" }), el("figcaption", {}, "The Feelings Collection — four little feelings and the Midnight Star."));
}
if (!data.film?.landscape && !data.lineup) $("#film").hidden = true;

// ---- game-ready ---------------------------------------------------------------------------------
const gameEditions = editions.filter((e) => e.game?.animated || e.game?.rigged);
if (gameEditions.length) {
  $("#game").hidden = false;
  const panel = $("#game-panel");
  for (const e of gameEditions) {
    panel.append(
      el(
        "div",
        { class: "game-item" },
        el("h3", {}, e.name),
        el("p", { class: "section-sub" }, e.game.animations.length ? `Clips: ${e.game.animations.map(clipLabel).join(", ")}` : "Rigged skeleton"),
        el(
          "div",
          { class: "viewer-downloads" },
          el("button", { class: "btn btn-ghost", type: "button", onclick: () => openViewer(e, true) }, "Play"),
          e.game.animated ? el("a", { class: "btn btn-gold", href: e.game.animated, download: "" }, "Animated GLB") : null,
          e.game.rigged ? el("a", { class: "btn btn-ghost", href: e.game.rigged, download: "" }, "Rigged GLB") : null,
        ),
      ),
    );
  }
}

// ---- 3D viewer ----------------------------------------------------------------------------------
const dialog = $("#viewer");
const mv = $("#model");
const animBar = $("#anim-bar");

const arBox = $("#viewer-ar");
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

/** Link that reopens this figure's viewer, e.g. on a phone: ?figure=<id>[&game=1]. */
const figureLink = (e, game) => {
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("figure", e.id);
  if (game) u.searchParams.set("game", "1");
  return u.toString();
};

/**
 * AR needs a phone: iOS opens Quick Look with the pre-built USDZ, Android opens Scene Viewer (then WebXR).
 * On a computer the button hands off with a QR code instead of doing nothing.
 */
function arControls(e, game) {
  arBox.replaceChildren();
  if (mv.canActivateAR) {
    arBox.append(el("button", { class: "btn btn-ghost", type: "button", onclick: () => mv.activateAR() }, "View in your room (AR)"));
    return;
  }
  if (coarsePointer || typeof qrcode !== "function") {
    arBox.append(el("p", { class: "ar-note" }, "AR isn't available in this browser. On iPhone open the page in Safari; on Android use Chrome with Google Play Services for AR."));
    return;
  }
  const qr = qrcode(0, "M");
  qr.addData(figureLink(e, game));
  qr.make();
  const panel = el("div", { class: "ar-qr", id: "ar-qr", hidden: true });
  panel.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: `QR code: open ${e.name} on your phone` });
  panel.append(el("p", {}, `Scan with your phone's camera, then tap “View in your room” to place ${e.name} on your desk or floor.`));
  const toggle = el(
    "button",
    {
      class: "btn btn-ghost",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": "ar-qr",
      onclick: () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
      },
    },
    "View in AR on your phone",
  );
  arBox.append(toggle, panel);
}

mv.addEventListener("ar-status", (ev) => {
  if (ev.detail.status === "failed") arBox.replaceChildren(el("p", { class: "ar-note" }, "AR couldn't start on this device. Your phone may not support ARCore / ARKit."));
});

function openViewer(e, game = false) {
  // the viewer and AR load the light copy (2048 px textures); downloads stay full resolution
  const src = game ? e.game?.view || e.game?.animated || e.game?.rigged : e.view || e.glb;
  if (!src) return;
  const sameModel = mv.src === src && mv.loaded;
  mv.src = src;
  const usdz = game ? e.game?.usdz : e.usdz;
  if (usdz) mv.setAttribute("ios-src", usdz);
  else mv.removeAttribute("ios-src");
  mv.alt = `${e.name} — 3D collectible figure`;
  // clips such as the dance travel: frame wider than the turntable view
  mv.setAttribute("camera-orbit", game ? "15deg 78deg 150%" : "15deg 78deg 105%");
  mv.autoRotate = !game;
  $("#viewer-number").textContent = e.secret ? "SECRET EDITION" : `No. ${e.number}`;
  $("#viewer-title").textContent = e.name;
  $("#viewer-mood").textContent = e.mood.join(" · ");
  $("#viewer-feeling").textContent = `“${e.feeling}”`;
  $("#viewer-rarity").textContent = e.rarity;
  const dl = $("#viewer-downloads");
  dl.replaceChildren(
    ...[
      game && e.game?.animated ? el("a", { class: "btn btn-gold", href: e.game.animated, download: "" }, "Animated GLB") : null,
      !game && e.glb ? el("a", { class: "btn btn-gold", href: e.glb, download: "" }, "Download GLB") : null,
      !game && e.fbx ? el("a", { class: "btn btn-ghost", href: e.fbx, download: "" }, "Quad FBX") : null,
    ].filter(Boolean),
  );
  arBox.replaceChildren();
  animBar.replaceChildren();
  animBar.hidden = true;
  const onReady = () => {
    arControls(e, game);
    if (!game) return;
    mv.jumpCameraToGoal?.();
    const names = mv.availableAnimations ?? [];
    if (!names.length) return;
    animBar.hidden = false;
    const pick = (name) => {
      mv.animationName = name;
      mv.play({ repetitions: Infinity });
      animBar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.name === name)));
    };
    for (const name of names) animBar.append(el("button", { type: "button", "data-name": name, onclick: () => pick(name) }, clipLabel(name)));
    pick(names.includes("idle") ? "idle" : names[0]);
  };
  if (sameModel) requestAnimationFrame(onReady);
  else mv.addEventListener("load", onReady, { once: true });
  if (!game) mv.pause?.();
  dialog.showModal();
}

dialog.addEventListener("click", (ev) => {
  if (ev.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  mv.pause?.();
});

// ---- deep link: ?figure=<id>[&game=1] opens that figure (the AR QR code points here) ---------------
{
  const params = new URLSearchParams(location.search);
  const linked = editions.find((e) => e.id === params.get("figure"));
  if (linked) openViewer(linked, params.get("game") === "1" && Boolean(linked.game));
}
