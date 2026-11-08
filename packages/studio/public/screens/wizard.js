window.DRMStudio.screens.wizard = function (container, ctx) {
  const FEATURES = [
    {
      key: "fullProtection",
      label: "Full App Protection",
      hint: "Protect the entire window from capture and recording",
      checked: true,
    },
    {
      key: "selectiveProtection",
      label: "Selective Protection",
      hint: "Protect specific DOM elements marked with data-drm",
      checked: true,
    },
    {
      key: "detectScreenRecording",
      label: "Detect Screen Recording",
      hint: "Monitor and block OBS, QuickTime, Camtasia, and similar recorders",
      checked: true,
    },
    {
      key: "detectSnippingTools",
      label: "Detect Snipping Tools",
      hint: "Block Snipping Tool, ShareX, Greenshot, and PrintScreen captures",
      checked: true,
    },
    {
      key: "invisibleMode",
      label: "Invisible Mode",
      hint: "Hide window during screen shares, video calls, and presentation mode",
      checked: true,
    },
    {
      key: "dynamicWatermark",
      label: "Dynamic Watermark",
      hint: "Overlay tamper-resistant user identity, email, and timestamp",
      checked: true,
    },
    {
      key: "autoInvisibleMode",
      label: "Auto Invisible Mode",
      hint: "Automatically engage Invisible Mode when meeting software starts",
      checked: false,
    },
  ];

  const state = {
    logoPath: undefined,
    logoPreviewUrl: undefined,
    targetDir: undefined,
  };

  function basename(value) {
    if (!value) return "";
    const parts = value.split(/[\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : value;
  }

  const screen = document.createElement("div");
  screen.className = "screen wide";

  screen.innerHTML =
    '<div class="wizard-nav">' +
    '  <button type="button" class="back-link" id="wizard-back">' +
    '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '      <line x1="19" y1="12" x2="5" y2="12"></line>' +
    '      <polyline points="12 19 5 12 12 5"></polyline>' +
    "    </svg>" +
    "    <span>Back</span>" +
    "  </button>" +
    "</div>" +
    '<div class="screen-header">' +
    "  <h1>Create a new app</h1>" +
    "  <p>Wrap any website or web application into a DRM-protected native desktop app.</p>" +
    "</div>" +
    '<div class="wizard-cards-stack">' +
    '  <div class="card">' +
    '    <div class="section-title" style="margin-bottom: 16px;">App Details</div>' +
    '    <div class="form-grid-2">' +
    '      <div class="field" style="margin-bottom: 0;">' +
    "        <label>App Name</label>" +
    '        <input type="text" id="wizard-app-name" placeholder="My Secure Portal" value="My Secure Portal" />' +
    '        <div class="hint">Application window title and executable brand name.</div>' +
    "      </div>" +
    '      <div class="field" style="margin-bottom: 0;">' +
    "        <label>Website URL to Wrap</label>" +
    '        <input type="url" id="wizard-base-url" placeholder="https://example.com" />' +
    '        <div class="hint">The live website or web portal to load securely inside the app.</div>' +
    "      </div>" +
    "    </div>" +
    "  </div>" +
    '  <div class="card">' +
    '    <div class="section-title" style="margin-bottom: 16px;">Branding & Output</div>' +
    '    <div class="form-grid-2">' +
    '      <div class="field" style="margin-bottom: 0;">' +
    "        <label>App Icon (Optional)</label>" +
    '        <div class="logo-uploader-card" id="wizard-logo-drop">' +
    '          <div class="logo-thumb" id="wizard-logo-thumb">' +
    '            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
    '              <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>' +
    '              <circle cx="8.5" cy="8.5" r="1.5"></circle>' +
    '              <polyline points="21 15 16 10 5 21"></polyline>' +
    "            </svg>" +
    "          </div>" +
    '          <div class="logo-text">' +
    '            <div class="logo-title" id="wizard-logo-name">Choose icon…</div>' +
    '            <div class="logo-hint">Drop PNG/JPG or <span class="link">browse</span></div>' +
    "          </div>" +
    '          <button type="button" class="btn-clear-logo" id="wizard-clear-logo" style="display: none;">Remove</button>' +
    "        </div>" +
    '        <input type="file" id="wizard-logo-file-input" accept="image/png,image/jpeg,image/jpg" style="display: none;" />' +
    '        <div class="hint">Used for window icon and generated installer packages.</div>' +
    "      </div>" +
    '      <div class="field" style="margin-bottom: 0;">' +
    "        <label>Destination Folder</label>" +
    '        <div class="folder-picker-card" id="wizard-folder-drop">' +
    '          <div class="folder-thumb">' +
    '            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>' +
    "            </svg>" +
    "          </div>" +
    '          <div class="folder-text">' +
    '            <div class="folder-title" id="wizard-folder-display">No folder selected</div>' +
    '            <div class="folder-hint" id="wizard-folder-hint">Drop folder or <span class="link">browse</span></div>' +
    "          </div>" +
    '          <button type="button" class="btn-browse-folder" id="wizard-choose-folder">Browse…</button>' +
    "        </div>" +
    '        <div class="hint">Where the project source and build configurations will be saved.</div>' +
    "      </div>" +
    "    </div>" +
    "  </div>" +
    '  <div class="card">' +
    '    <div class="section-header-row">' +
    '      <div class="section-title">DRM Security Controls</div>' +
    '      <div class="presets-group">' +
    '        <button type="button" class="preset-btn active" data-preset="recommended">Recommended</button>' +
    '        <button type="button" class="preset-btn" data-preset="max">Max Security</button>' +
    '        <button type="button" class="preset-btn" data-preset="minimal">Minimal</button>' +
    "      </div>" +
    "    </div>" +
    '    <div class="features-grid" id="wizard-features">' +
    FEATURES.map(function (feature) {
      return (
        '<label class="feature-toggle-card' +
        (feature.checked ? " checked" : "") +
        '">' +
        '  <div class="feature-meta">' +
        '    <div class="feature-label">' +
        feature.label +
        "</div>" +
        '    <div class="feature-desc">' +
        feature.hint +
        "</div>" +
        "  </div>" +
        '  <div class="switch">' +
        '    <input type="checkbox" data-feature="' +
        feature.key +
        '"' +
        (feature.checked ? " checked" : "") +
        " />" +
        '    <span class="switch-slider"></span>' +
        "  </div>" +
        "</label>"
      );
    }).join("") +
    "    </div>" +
    "  </div>" +
    '  <div class="wizard-footer">' +
    '    <button type="button" class="secondary" id="wizard-cancel">Cancel</button>' +
    '    <button type="button" class="primary btn-create-app" id="wizard-submit">' +
    '      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
    "      </svg>" +
    "      <span>Create Desktop App</span>" +
    "    </button>" +
    "  </div>" +
    "</div>";

  container.appendChild(screen);

  const backLink = screen.querySelector("#wizard-back");
  const cancelBtn = screen.querySelector("#wizard-cancel");
  const appNameInput = screen.querySelector("#wizard-app-name");
  const baseUrlInput = screen.querySelector("#wizard-base-url");

  const logoDrop = screen.querySelector("#wizard-logo-drop");
  const logoThumb = screen.querySelector("#wizard-logo-thumb");
  const logoNameEl = screen.querySelector("#wizard-logo-name");
  const clearLogoBtn = screen.querySelector("#wizard-clear-logo");
  const logoFileInput = screen.querySelector("#wizard-logo-file-input");

  const folderDrop = screen.querySelector("#wizard-folder-drop");
  const folderDisplay = screen.querySelector("#wizard-folder-display");
  const folderHint = screen.querySelector("#wizard-folder-hint");
  const chooseFolderBtn = screen.querySelector("#wizard-choose-folder");

  const featureInputs = Array.prototype.slice.call(screen.querySelectorAll("[data-feature]"));
  const presetBtns = Array.prototype.slice.call(screen.querySelectorAll(".preset-btn"));

  const submitBtn = screen.querySelector("#wizard-submit");

  function goBack() {
    ctx.goTo("home");
  }
  backLink.addEventListener("click", goBack);
  cancelBtn.addEventListener("click", goBack);

  baseUrlInput.addEventListener("blur", function () {
    let val = baseUrlInput.value.trim();
    if (val && !/^https?:\/\//i.test(val)) {
      val = "https://" + val;
      baseUrlInput.value = val;
    }
    if (val && (appNameInput.value.trim() === "My Secure Portal" || !appNameInput.value.trim())) {
      try {
        const hostname = new URL(val).hostname.replace(/^www\./i, "");
        const parts = hostname.split(".");
        if (parts.length > 0 && parts[0]) {
          const suggested = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + " App";
          appNameInput.value = suggested;
        }
      } catch (_) {}
    }
  });

  function setLogo(filePath, previewUrl) {
    state.logoPath = filePath;
    state.logoPreviewUrl = previewUrl || (filePath ? (filePath.startsWith("file://") ? filePath : "file://" + filePath) : undefined);

    if (state.logoPath || state.logoPreviewUrl) {
      logoNameEl.textContent = basename(state.logoPath || "icon.png");
      clearLogoBtn.style.display = "";
      logoThumb.innerHTML = '<img src="' + (state.logoPreviewUrl || state.logoPath) + '" alt="App Icon" />';
    } else {
      logoNameEl.textContent = "Choose icon…";
      clearLogoBtn.style.display = "none";
      logoThumb.innerHTML =
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>' +
        '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
        '<polyline points="21 15 16 10 5 21"></polyline>' +
        "</svg>";
    }
  }

  async function chooseLogo() {
    try {
      const filePath = await ctx.bridge.dialogs.chooseLogo();
      if (filePath) {
        setLogo(filePath);
      }
    } catch (error) {
      ctx.notify(error.message, "error");
    }
  }

  logoDrop.addEventListener("click", function (e) {
    if (e.target === clearLogoBtn || clearLogoBtn.contains(e.target)) return;
    if (window.__DRM_STUDIO__) {
      chooseLogo();
    } else {
      logoFileInput.click();
    }
  });

  logoFileInput.addEventListener("change", function () {
    if (logoFileInput.files && logoFileInput.files.length > 0) {
      const file = logoFileInput.files[0];
      const previewUrl = URL.createObjectURL(file);
      setLogo(file.path || file.name, previewUrl);
    }
  });

  clearLogoBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    state.logoPath = undefined;
    state.logoPreviewUrl = undefined;
    logoFileInput.value = "";
    setLogo(undefined);
  });

  logoDrop.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.stopPropagation();
    logoDrop.classList.add("dragover");
  });
  logoDrop.addEventListener("dragleave", function (e) {
    e.preventDefault();
    e.stopPropagation();
    logoDrop.classList.remove("dragover");
  });
  logoDrop.addEventListener("drop", function (e) {
    e.preventDefault();
    e.stopPropagation();
    logoDrop.classList.remove("dragover");
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (/image\//i.test(file.type) || /\.(png|jpe?g|svg|ico)$/i.test(file.name)) {
        const previewUrl = URL.createObjectURL(file);
        setLogo(file.path || file.name, previewUrl);
      } else {
        ctx.notify("Please drop a valid image file (.png, .jpg).", "error");
      }
    }
  });

  function updateFolderDisplay() {
    if (state.targetDir) {
      folderDisplay.textContent = state.targetDir;
      folderDisplay.title = state.targetDir;
      folderDisplay.classList.add("has-path");
      folderHint.innerHTML = 'Click card or <span class="link">browse</span> to change destination';
    } else {
      folderDisplay.textContent = "No folder selected";
      folderDisplay.removeAttribute("title");
      folderDisplay.classList.remove("has-path");
      folderHint.innerHTML = 'Drop folder or <span class="link">browse</span>';
    }
  }

  async function chooseFolder() {
    try {
      const dirPath = await ctx.bridge.dialogs.chooseDirectory();
      if (dirPath) {
        state.targetDir = dirPath;
        updateFolderDisplay();
      }
    } catch (error) {
      ctx.notify(error.message, "error");
    }
  }

  folderDrop.addEventListener("click", function (e) {
    if (e.target === chooseFolderBtn || chooseFolderBtn.contains(e.target)) return;
    chooseFolder();
  });
  chooseFolderBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    chooseFolder();
  });

  folderDrop.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.stopPropagation();
    folderDrop.classList.add("dragover");
  });
  folderDrop.addEventListener("dragleave", function (e) {
    e.preventDefault();
    e.stopPropagation();
    folderDrop.classList.remove("dragover");
  });
  folderDrop.addEventListener("drop", function (e) {
    e.preventDefault();
    e.stopPropagation();
    folderDrop.classList.remove("dragover");
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const dirPath = file.path || file.name;
      if (dirPath) {
        state.targetDir = dirPath;
        updateFolderDisplay();
        ctx.notify("Destination set to: " + dirPath, "success");
      }
    }
  });

  featureInputs.forEach(function (input) {
    input.addEventListener("change", function () {
      const card = input.closest(".feature-toggle-card");
      if (card) {
        if (input.checked) {
          card.classList.add("checked");
        } else {
          card.classList.remove("checked");
        }
      }
      updateActivePresetPill();
    });
  });

  function applyPreset(presetName) {
    const config = {
      recommended: {
        fullProtection: true,
        selectiveProtection: true,
        detectScreenRecording: true,
        detectSnippingTools: true,
        invisibleMode: true,
        dynamicWatermark: true,
        autoInvisibleMode: false,
      },
      max: {
        fullProtection: true,
        selectiveProtection: true,
        detectScreenRecording: true,
        detectSnippingTools: true,
        invisibleMode: true,
        dynamicWatermark: true,
        autoInvisibleMode: true,
      },
      minimal: {
        fullProtection: true,
        selectiveProtection: false,
        detectScreenRecording: false,
        detectSnippingTools: false,
        invisibleMode: false,
        dynamicWatermark: false,
        autoInvisibleMode: false,
      },
    }[presetName];

    if (!config) return;

    featureInputs.forEach(function (input) {
      const key = input.dataset.feature;
      input.checked = !!config[key];
      const card = input.closest(".feature-toggle-card");
      if (card) {
        if (input.checked) card.classList.add("checked");
        else card.classList.remove("checked");
      }
    });

    presetBtns.forEach(function (btn) {
      if (btn.dataset.preset === presetName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function updateActivePresetPill() {
    presetBtns.forEach(function (btn) {
      btn.classList.remove("active");
    });
  }

  presetBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyPreset(btn.dataset.preset);
    });
  });

  submitBtn.addEventListener("click", async function () {
    const appName = appNameInput.value.trim() || "My Secure Portal";
    let baseUrl = baseUrlInput.value.trim();

    if (!baseUrl) {
      ctx.notify("Please enter a website URL to wrap.", "error");
      baseUrlInput.focus();
      return;
    }

    if (!/^https?:\/\//i.test(baseUrl)) {
      baseUrl = "https://" + baseUrl;
      baseUrlInput.value = baseUrl;
    }

    try {
      new URL(baseUrl);
    } catch (error) {
      ctx.notify("Enter a valid URL (e.g. https://portal.example.com)", "error");
      baseUrlInput.focus();
      return;
    }

    if (!state.targetDir) {
      ctx.notify("Choose a destination folder to create the app.", "error");
      chooseFolder();
      return;
    }

    const features = {};
    featureInputs.forEach(function (input) {
      features[input.dataset.feature] = input.checked;
    });
    features.watermarkOpacity = 0.12;

    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span><span>Creating Desktop App…</span>';

    try {
      const result = await ctx.bridge.project.scaffold({
        targetDir: state.targetDir,
        appName: appName,
        baseUrl: baseUrl,
        logoPath: state.logoPath,
        features: features,
      });

      ctx.state.project = { targetDir: result.targetDir, config: result.config };
      ctx.notify('"' + result.config.appName + '" created successfully!', "success");
      if (result.logoError) {
        ctx.notify(result.logoError, "error");
      }
      ctx.goTo("dashboard");
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
      ctx.notify(error.message, "error");
    }
  });
};
