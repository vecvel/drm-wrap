(function () {
  if (window.__DRM_LAYER_INSTALLED__) return;
  window.__DRM_LAYER_INSTALLED__ = true;

  var api = window.__DRM_WRAP__;
  if (!api) return;

  var BLANK_CLASS = "__drm_blanked__";
  var STYLE_ID = "__drm_layer_style__";
  var PROTECTED_SELECTOR = "[data-drm], .drm-protect";

  var protectedElements = new Set();
  var highOverlays = new WeakMap();
  var globalOverlay = null;

  var lastWatermarkText = document.title + " • " + new Date().toISOString();
  var lastWatermarkOpacity = 0.12;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "." + BLANK_CLASS + "{background:#000 !important;}\n" +
      "." + BLANK_CLASS + " > *{visibility:hidden !important;}\n" +
      "[data-drm-forced-watermark],[data-drm-watermark-overlay]{will-change:opacity;}\n" +
      "[data-drm-status-pill]{box-sizing:border-box;}";
    (document.head || document.documentElement).appendChild(style);
  }

  function computeLevel(el) {
    var attr = el.getAttribute("data-drm");
    if (attr === "full" || attr === "section" || attr === "high") return attr;
    if (el.classList && el.classList.contains("drm-protect")) return "section";
    return null;
  }

  function forcedHighOpacity() {
    return Math.max(lastWatermarkOpacity, 0.1);
  }

  function tileOverlay(container, text, approxArea) {
    container.textContent = "";
    var density = 12000;
    var count = Math.round(approxArea / density);
    if (count < 16) count = 16;
    if (count > 300) count = 300;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var span = document.createElement("span");
      span.textContent = text;
      span.style.cssText =
        "display:inline-block;margin:18px 26px;white-space:nowrap;" +
        'font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
        "color:#0a0a0a;user-select:none;";
      frag.appendChild(span);
    }
    container.appendChild(frag);
  }

  function makeTiledOverlayDom() {
    var root = document.createElement("div");
    var inner = document.createElement("div");
    inner.style.cssText =
      "position:absolute;top:-50%;left:-50%;width:200%;height:200%;" +
      "display:flex;flex-wrap:wrap;align-content:flex-start;justify-content:flex-start;" +
      "transform:rotate(-30deg);transform-origin:center center;";
    root.appendChild(inner);
    return { root: root, inner: inner, lastText: null };
  }

  function ensureGlobalOverlay() {
    if (globalOverlay) return globalOverlay;
    globalOverlay = makeTiledOverlayDom();
    globalOverlay.root.setAttribute("data-drm-watermark-overlay", "");
    globalOverlay.root.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden;";
    (document.body || document.documentElement).appendChild(globalOverlay.root);
    return globalOverlay;
  }

  function updateGlobalOverlay(text, opacity) {
    var ov = ensureGlobalOverlay();
    ov.root.style.opacity = String(opacity);
    if (ov.lastText !== text) {
      var area = window.innerWidth * 2 * (window.innerHeight * 2);
      tileOverlay(ov.inner, text, area);
      ov.lastText = text;
    }
  }

  function removeGlobalOverlay() {
    if (globalOverlay) {
      globalOverlay.root.remove();
      globalOverlay = null;
    }
  }

  function ensureHighOverlay(el) {
    var record = highOverlays.get(el);
    if (record) return record;
    var computedPosition = window.getComputedStyle(el).position;
    if (computedPosition === "static") {
      el.style.position = "relative";
    }
    record = makeTiledOverlayDom();
    record.root.setAttribute("data-drm-forced-watermark", "");
    record.root.style.cssText =
      "position:absolute;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden;";
    el.appendChild(record.root);
    highOverlays.set(el, record);
    return record;
  }

  function refreshHighOverlay(el, text, opacity) {
    var record = ensureHighOverlay(el);
    record.root.style.opacity = String(opacity);
    if (record.lastText !== text) {
      var rect = el.getBoundingClientRect();
      var area = rect.width * 2 * (rect.height * 2);
      tileOverlay(record.inner, text, area);
      record.lastText = text;
    }
  }

  function removeHighOverlay(el) {
    var record = highOverlays.get(el);
    if (record) {
      record.root.remove();
      highOverlays.delete(el);
    }
  }

  function refreshElement(el) {
    var level = computeLevel(el);
    if (level) {
      el.setAttribute("data-drm-level", level);
      protectedElements.add(el);
      if (level === "high") {
        refreshHighOverlay(el, lastWatermarkText, forcedHighOpacity());
      } else {
        removeHighOverlay(el);
      }
    } else if (protectedElements.has(el)) {
      protectedElements.delete(el);
      el.removeAttribute("data-drm-level");
      el.classList.remove(BLANK_CLASS);
      removeHighOverlay(el);
    }
  }

  function scanAll() {
    var nodes = document.querySelectorAll(PROTECTED_SELECTOR);
    var seen = new Set();
    for (var i = 0; i < nodes.length; i++) {
      seen.add(nodes[i]);
      refreshElement(nodes[i]);
    }
    protectedElements.forEach(function (el) {
      if (!seen.has(el)) {
        protectedElements.delete(el);
        removeHighOverlay(el);
      }
    });
  }

  var observer = new MutationObserver(function (mutations) {
    var needsScan = false;
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      if (mutation.type === "attributes") {
        refreshElement(mutation.target);
      } else if (mutation.type === "childList") {
        needsScan = true;
      }
    }
    if (needsScan) scanAll();
  });

  function startObserving() {
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-drm", "class"],
    });
  }

  function applyToMatching(level, apply) {
    var lvl = level || "all";
    protectedElements.forEach(function (el) {
      var elLevel = el.getAttribute("data-drm-level");
      if (lvl === "all" || elLevel === lvl || elLevel === "high") {
        if (apply) {
          el.classList.add(BLANK_CLASS);
        } else {
          el.classList.remove(BLANK_CLASS);
        }
      }
    });
  }

  function handleWatermarkUpdate(payload) {
    if (!payload) return;
    if (typeof payload.text === "string" && payload.text.length > 0) {
      lastWatermarkText = payload.text;
    }
    if (typeof payload.opacity === "number" && !isNaN(payload.opacity)) {
      lastWatermarkOpacity = payload.opacity;
    }
    if (payload.enabled) {
      updateGlobalOverlay(lastWatermarkText, lastWatermarkOpacity);
    } else {
      removeGlobalOverlay();
    }
    protectedElements.forEach(function (el) {
      if (el.getAttribute("data-drm-level") === "high") {
        refreshHighOverlay(el, lastWatermarkText, forcedHighOpacity());
      }
    });
  }

  var pill = null;
  var pillState = { detection: null, detectionTimer: null, invisible: null };

  function ensurePill() {
    if (!pill) {
      pill = document.createElement("div");
      pill.setAttribute("data-drm-status-pill", "");
      pill.style.cssText =
        "position:fixed;right:12px;bottom:12px;z-index:2147483647;" +
        "display:none;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;" +
        "background:rgba(15,23,42,0.88);color:#e2e8f0;" +
        'font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
        "box-shadow:0 2px 8px rgba(0,0,0,0.35);pointer-events:none;" +
        "transition:opacity 150ms ease;opacity:0;";
    }
    (document.body || document.documentElement).appendChild(pill);
    return pill;
  }

  function renderPill() {
    var el = ensurePill();
    var text = pillState.detection || pillState.invisible || "";
    if (text) {
      el.textContent = text;
      el.style.display = "flex";
      el.style.opacity = "1";
    } else {
      el.style.opacity = "0";
      el.style.display = "none";
    }
  }

  function showDetection(evt) {
    var label = evt && evt.type === "cleared" ? "Clear: " : "Detected: ";
    var detail = (evt && (evt.processName || evt.windowTitle || evt.category)) || "activity";
    pillState.detection = label + detail;
    renderPill();
    if (pillState.detectionTimer) clearTimeout(pillState.detectionTimer);
    pillState.detectionTimer = setTimeout(function () {
      pillState.detection = null;
      pillState.detectionTimer = null;
      renderPill();
    }, 4000);
  }

  function showInvisible(state) {
    pillState.invisible = state && state.active ? "Invisible mode active" : null;
    renderPill();
  }

  injectStyles();

  var start = function () {
    scanAll();
    startObserving();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  api.onBlank(function (signal) {
    applyToMatching(signal && signal.level, true);
  });
  api.onUnblank(function (signal) {
    applyToMatching(signal && signal.level, false);
  });
  api.onWatermarkUpdate(handleWatermarkUpdate);
  api.onDetectionEvent(showDetection);
  api.onInvisibleState(showInvisible);
})();
