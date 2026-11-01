(function () {
  function renderLicenseScreen(container, ctx) {
    const wrap = document.createElement("div");
    wrap.className = "center-screen";

    const pane = document.createElement("div");
    pane.className = "activation-pane";

    const heading = document.createElement("h1");
    heading.textContent = "Activate DRMWrap";

    const intro = document.createElement("p");
    intro.className = "activation-intro";
    intro.textContent = "Drop your license file or paste your key to activate DRMWrap.";

    // Drag and Drop Zone
    const dropZone = document.createElement("div");
    dropZone.className = "drop-zone";
    dropZone.id = "license-drop-zone";
    dropZone.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>' +
      "</svg>" +
      '<div class="drop-zone-title">Drop license file here</div>' +
      '<div class="drop-zone-hint">or <span class="drop-zone-browse">browse file</span> (.lic, .key, .txt, .json)</div>';

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".lic,.key,.json,.txt,text/*";
    fileInput.style.display = "none";
    dropZone.appendChild(fileInput);

    dropZone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        try {
          const text = await file.text();
          await processKey(text, file.name);
        } catch (err) {
          ctx.notify("Error reading file: " + err.message, "error");
        }
      }
    });

    const divider = document.createElement("div");
    divider.className = "activation-divider";
    divider.innerHTML = "<span>or paste key</span>";

    const field = document.createElement("div");
    field.className = "field";
    field.style.textAlign = "left";

    const label = document.createElement("label");
    label.textContent = "License key";

    const textarea = document.createElement("textarea");
    textarea.rows = 3;
    textarea.placeholder = "Paste your license key here";
    textarea.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    textarea.style.resize = "vertical";

    field.appendChild(label);
    field.appendChild(textarea);

    const actions = document.createElement("div");
    actions.className = "actions";

    const activateButton = document.createElement("button");
    activateButton.className = "primary";
    activateButton.style.width = "100%";
    activateButton.style.padding = "12px 18px";
    activateButton.textContent = "Activate DRMWrap";
    actions.appendChild(activateButton);

    const footer = document.createElement("p");
    footer.className = "activation-footer";
    footer.textContent = "Don't have a key? Contact whoever sent you DRMWrap.";

    async function doActivate() {
      const key = textarea.value.trim();
      if (!key) {
        ctx.notify("Enter or drop a license key first.", "error");
        return;
      }

      activateButton.disabled = true;
      const originalLabel = activateButton.textContent;
      activateButton.textContent = "";
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      activateButton.appendChild(spinner);
      activateButton.appendChild(document.createTextNode(" Activating…"));

      try {
        const result = await ctx.bridge.license.activate(key);
        if (result.valid) {
          ctx.state.license = result;
          ctx.notify("License activated successfully.", "success");
          ctx.goTo("home");
          return;
        }
        ctx.notify(result.reason || "Invalid license key", "error");
      } catch (error) {
        ctx.notify(error.message, "error");
      }

      activateButton.disabled = false;
      activateButton.textContent = originalLabel;
    }

    async function processKey(rawText, filename) {
      let key = (rawText || "").trim();
      try {
        const parsed = JSON.parse(key);
        if (parsed && typeof parsed === "object") {
          key = (parsed.token || parsed.key || parsed.licenseKey || parsed.license || key).trim();
        }
      } catch (_) {}

      textarea.value = key;

      if (filename) {
        const titleEl = dropZone.querySelector(".drop-zone-title");
        const hintEl = dropZone.querySelector(".drop-zone-hint");
        if (titleEl) titleEl.textContent = "Loaded: " + filename;
        if (hintEl) hintEl.innerHTML = '<span class="drop-zone-browse">Click to choose another file</span>';
      }

      if (key) {
        await doActivate();
      }
    }

    activateButton.addEventListener("click", doActivate);

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        doActivate();
      }
    });

    function setDrag(active) {
      if (active) {
        dropZone.classList.add("dragover");
      } else {
        dropZone.classList.remove("dragover");
      }
    }

    function onDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      setDrag(true);
    }

    function onDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!wrap.contains(e.relatedTarget)) {
        setDrag(false);
      }
    }

    async function onDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      setDrag(false);

      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        try {
          const file = files[0];
          const text = await file.text();
          await processKey(text, file.name);
        } catch (err) {
          ctx.notify("Could not read dropped file: " + err.message, "error");
        }
      } else {
        const text = e.dataTransfer && (e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text"));
        if (text) {
          await processKey(text);
        }
      }
    }

    dropZone.addEventListener("dragover", onDragOver);
    dropZone.addEventListener("dragleave", (e) => {
      if (!dropZone.contains(e.relatedTarget)) setDrag(false);
    });
    dropZone.addEventListener("drop", onDrop);

    wrap.addEventListener("dragover", onDragOver);
    wrap.addEventListener("dragleave", onDragLeave);
    wrap.addEventListener("drop", onDrop);

    function preventDefault(e) {
      e.preventDefault();
    }
    window.addEventListener("dragover", preventDefault, false);
    window.addEventListener("drop", preventDefault, false);

    pane.appendChild(heading);
    pane.appendChild(intro);
    pane.appendChild(dropZone);
    pane.appendChild(divider);
    pane.appendChild(field);
    pane.appendChild(actions);
    pane.appendChild(footer);
    wrap.appendChild(pane);
    container.appendChild(wrap);

    return function cleanup() {
      window.removeEventListener("dragover", preventDefault, false);
      window.removeEventListener("drop", preventDefault, false);
    };
  }

  function renderHomeScreen(container, ctx) {
    const screen = document.createElement("div");
    screen.className = "home-container";

    const payload = (ctx.state.license && ctx.state.license.payload) || {};
    const customer = payload.customer || "Operator";
    const tier = (payload.tier || "Standard").toUpperCase();
    const domain = payload.domain;

    // Header & Meta row
    const header = document.createElement("div");
    header.className = "home-header";
    header.innerHTML =
      '<div class="home-title-row">' +
      '  <div class="home-greeting-group">' +
      '    <h1>Welcome back, ' + customer + '</h1>' +
      '    <p>Convert any web application or portal into a hardened, DRM-protected desktop app.</p>' +
      '  </div>' +
      '  <button type="button" class="btn-meta-action" id="home-license-details">' +
      '    <span>License Details</span>' +
      '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '      <polyline points="9 18 15 12 9 6"></polyline>' +
      '    </svg>' +
      '  </button>' +
      '</div>' +
      '<div class="home-meta-bar">' +
      '  <div class="home-meta-left">' +
      '    <span class="meta-chip"><strong>' + tier + ' EDITION</strong></span>' +
      '    <span class="meta-chip">' +
      '      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
      '        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' +
      '      </svg>' +
      '      <span>' + (domain ? "Locked to " + domain : "Global Domain License") + '</span>' +
      '    </span>' +
      '  </div>' +
      '  <div class="home-meta-right">' +
      '    <span class="meta-chip" style="font-size: 11px; opacity: 0.65;">DRMWrap Studio v1.0.0</span>' +
      '  </div>' +
      '</div>';

    // Action cards grid
    const cardsGrid = document.createElement("div");
    cardsGrid.className = "home-cards-grid";

    // Card 1: Create New App
    const createCard = document.createElement("div");
    createCard.className = "home-action-card";
    createCard.innerHTML =
      '<div class="home-card-icon-box">' +
      '  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '    <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>' +
      '    <line x1="12" y1="8" x2="12" y2="16"></line>' +
      '    <line x1="8" y1="12" x2="16" y2="12"></line>' +
      '  </svg>' +
      '</div>' +
      '<div class="home-card-title">Create New App</div>' +
      '<div class="home-card-desc">Wrap a website or portal URL into a hardened, standalone desktop package with custom branding and DRM protections.</div>' +
      '<div class="home-card-tags">' +
      '  <span class="home-card-tag">Widevine DRM</span>' +
      '  <span class="home-card-tag">Screen Stealth</span>' +
      '  <span class="home-card-tag">DevTools Guard</span>' +
      '  <span class="home-card-tag">Watermarking</span>' +
      '</div>' +
      '<div class="home-card-footer">' +
      '  <button type="button" class="primary home-card-btn" id="home-create-btn">' +
      '    <span>Start App Wizard</span>' +
      '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
      '  </button>' +
      '</div>';

    // Card 2: Open Existing Project
    const openCard = document.createElement("div");
    openCard.className = "home-action-card";
    openCard.innerHTML =
      '<div class="home-card-icon-box">' +
      '  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>' +
      '  </svg>' +
      '</div>' +
      '<div class="home-card-title">Open Existing Project</div>' +
      '<div class="home-card-desc">Resume working on a previously created drm-wrap desktop project to reconfigure DRM policies, test, or generate new installers.</div>' +
      '<div class="home-card-tags">' +
      '  <span class="home-card-tag">Config Editor</span>' +
      '  <span class="home-card-tag">Live Testing</span>' +
      '  <span class="home-card-tag">Multi-Platform</span>' +
      '  <span class="home-card-tag">Distributables</span>' +
      '</div>' +
      '<div class="home-card-footer">' +
      '  <button type="button" class="secondary home-card-btn" id="home-open-btn">' +
      '    <span>Browse Project Folder…</span>' +
      '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
      '  </button>' +
      '</div>';

    cardsGrid.appendChild(createCard);
    cardsGrid.appendChild(openCard);

    // Quick Project Drop Strip
    const dropStrip = document.createElement("div");
    dropStrip.className = "home-drop-strip";
    dropStrip.id = "home-drop-strip";
    dropStrip.innerHTML =
      '<div class="drop-strip-left">' +
      '  <div class="drop-strip-icon">' +
      '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>' +
      '    </svg>' +
      '  </div>' +
      '  <div class="drop-strip-text">' +
      '    <div class="drop-strip-title">Quick Project Loader</div>' +
      '    <div class="drop-strip-hint">Drop any existing project folder here or <span class="link">browse from disk</span> to load immediately</div>' +
      '  </div>' +
      '</div>' +
      '<button type="button" class="secondary btn-strip-browse" id="home-strip-browse">Select Folder</button>';

    screen.appendChild(header);
    screen.appendChild(cardsGrid);
    screen.appendChild(dropStrip);
    container.appendChild(screen);

    // Event handlers
    const licenseDetailsBtn = header.querySelector("#home-license-details");
    if (licenseDetailsBtn) {
      licenseDetailsBtn.addEventListener("click", () => ctx.goTo("licenseDetails"));
    }

    createCard.addEventListener("click", () => ctx.goTo("wizard"));

    async function handleOpenProject(selectedDir) {
      let targetDir = selectedDir;
      if (!targetDir) {
        try {
          targetDir = await ctx.bridge.dialogs.chooseExistingProject();
        } catch (error) {
          ctx.notify(error.message, "error");
          return;
        }
      }
      if (!targetDir) return;

      try {
        const config = await ctx.bridge.project.loadConfig(targetDir);
        ctx.state.project = { targetDir, config };
        ctx.notify("Loaded project: " + (config.appName || "DRMWrap App"), "success");
        ctx.goTo("dashboard");
      } catch (error) {
        ctx.notify("Not a drm-wrap project: " + error.message, "error");
      }
    }

    openCard.addEventListener("click", () => handleOpenProject());

    const stripBrowseBtn = dropStrip.querySelector("#home-strip-browse");
    if (stripBrowseBtn) {
      stripBrowseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleOpenProject();
      });
    }

    dropStrip.addEventListener("click", (e) => {
      if (e.target === stripBrowseBtn || stripBrowseBtn.contains(e.target)) return;
      handleOpenProject();
    });

    // Drag-and-drop on dropStrip and screen
    function onDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      dropStrip.classList.add("dragover");
    }
    function onDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!dropStrip.contains(e.relatedTarget)) {
        dropStrip.classList.remove("dragover");
      }
    }
    async function onDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      dropStrip.classList.remove("dragover");
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        const dirPath = file.path || file.name;
        if (dirPath) {
          await handleOpenProject(dirPath);
        }
      }
    }

    dropStrip.addEventListener("dragover", onDragOver);
    dropStrip.addEventListener("dragleave", onDragLeave);
    dropStrip.addEventListener("drop", onDrop);

    screen.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropStrip.classList.add("dragover");
    });
    screen.addEventListener("dragleave", (e) => {
      e.preventDefault();
      if (!screen.contains(e.relatedTarget)) {
        dropStrip.classList.remove("dragover");
      }
    });
    screen.addEventListener("drop", onDrop);

  }

  window.DRMStudio.screens.license = renderLicenseScreen;
  window.DRMStudio.screens.home = renderHomeScreen;
})();
