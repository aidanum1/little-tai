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
        el("p", { class: "section-sub" }, e.game.animations.length ? `Clips: ${e.game.animations.join(", ")}` : "Rigged skeleton"),
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

function openViewer(e, game = false) {
  const src = game ? e.game?.animated || e.game?.rigged : e.glb;
  if (!src) return;
  mv.src = src;
  mv.alt = `${e.name} — 3D collectible figure`;
  mv.setAttribute("camera-orbit", "15deg 78deg 105%");
  mv.autoRotate = !game;
  $("#viewer-number").textContent = e.secret ? "SECRET EDITION" : `No. ${e.number}`;
  $("#viewer-title").textContent = e.name;
  $("#viewer-mood").textContent = e.mood.join(" · ");
  $("#viewer-feeling").textContent = `“${e.feeling}”`;
  $("#viewer-rarity").textContent = e.rarity;
  const dl = $("#viewer-downloads");
  dl.replaceChildren(
    e.glb ? el("a", { class: "btn btn-gold", href: e.glb, download: "" }, "Download GLB") : null,
    e.fbx ? el("a", { class: "btn btn-ghost", href: e.fbx, download: "" }, "Quad FBX") : null,
    el("button", { class: "btn btn-ghost", type: "button", onclick: () => mv.activateAR?.() }, "View in AR"),
  );
  animBar.replaceChildren();
  animBar.hidden = true;
  if (game) {
    mv.addEventListener(
      "load",
      () => {
        const names = mv.availableAnimations ?? [];
        if (!names.length) return;
        animBar.hidden = false;
        const pick = (name) => {
          mv.animationName = name;
          mv.play({ repetitions: Infinity });
          animBar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.name === name)));
        };
        for (const name of names) animBar.append(el("button", { type: "button", "data-name": name, onclick: () => pick(name) }, name.replace(/^.*[|:]/, "")));
        pick(names[0]);
      },
      { once: true },
    );
  } else {
    mv.pause?.();
  }
  dialog.showModal();
}

dialog.addEventListener("click", (ev) => {
  if (ev.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  mv.pause?.();
});
