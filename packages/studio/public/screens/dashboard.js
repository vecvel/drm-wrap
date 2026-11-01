(function () {
  function featureFieldDefs() {
    return [
      { key: "fullProtection", label: "Full App Protection", hint: "Protect the entire window" },
      { key: "selectiveProtection", label: "Selective Protection", hint: "Protect only data-drm elements" },
      {
        key: "detectScreenRecording",
        label: "Detect Screen Recording",
        hint: "Watch for OBS, QuickTime, and similar",
      },
      {
        key: "detectSnippingTools",
        label: "Detect Snipping Tools",
        hint: "Watch for Snipping Tool, ShareX, Greenshot, PrintScreen",
      },
      { key: "invisibleMode", label: "Invisible Mode", hint: "Hide the app during screen shares" },
      {
        key: "autoInvisibleMode",
        label: "Auto Invisible Mode",
        hint: "Automatically enable Invisible Mode when a meeting app is detected",
      },
      {
        key: "dynamicWatermark",
        label: "Dynamic Watermark",
        hint: "Overlay a semi-transparent identity + timestamp watermark",
      },
    ];
  }

  window.DRMStudio.screens.dashboard = function (container, ctx) {
    const project = ctx.state.project;
    if (!project || !project.config) {
      container.innerHTML = '<div class="empty-state">No project loaded. Go back and open or create one.</div>';
      return;
    }

    const targetDir = project.targetDir;
    const config = project.config;
    const running = { install: false, dev: false, build: false };

    const screen = document.createElement("div");
    screen.className = "screen wide";
    container.appendChild(screen);

    const nav = document.createElement("div");
    nav.className = "screen-nav";

    const backLink = document.createElement("button");
    backLink.type = "button";
    backLink.className = "back-link";
    backLink.id = "dashboard-back";
    backLink.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '  <line x1="19" y1="12" x2="5" y2="12"></line>' +
      '  <polyline points="12 19 5 12 12 5"></polyline>' +
      '</svg>' +
      '<span>All projects</span>';
    backLink.addEventListener("click", function () {
      ctx.goTo("home");
    });
    nav.appendChild(backLink);
    screen.appendChild(nav);

    const header = document.createElement("div");
    header.className = "screen-header";
    const heading = document.createElement("h1");
    heading.textContent = config.appName;
    const subtext = document.createElement("p");
    subtext.textContent = targetDir + "  ·  " + config.baseUrl;
    header.appendChild(heading);
    header.appendChild(subtext);
    screen.appendChild(header);

    const tabs = document.createElement("div");
    tabs.className = "tabs";
    const settingsTab = document.createElement("div");
    settingsTab.className = "tab";
    settingsTab.textContent = "Settings";
    const buildTab = document.createElement("div");
    buildTab.className = "tab active";
    buildTab.textContent = "Build & Run";
    tabs.appendChild(settingsTab);
    tabs.appendChild(buildTab);
    screen.appendChild(tabs);

    const settingsPane = document.createElement("div");
    settingsPane.style.display = "none";
    const buildPane = document.createElement("div");
    buildPane.style.display = "block";
    screen.appendChild(settingsPane);
    screen.appendChild(buildPane);

    function selectTab(name) {
      const showSettings = name === "settings";
      settingsTab.classList.toggle("active", showSettings);
      buildTab.classList.toggle("active", !showSettings);
      settingsPane.style.display = showSettings ? "block" : "none";
      buildPane.style.display = showSettings ? "none" : "block";
    }
    settingsTab.addEventListener("click", function () {
      selectTab("settings");
    });
    buildTab.addEventListener("click", function () {
      selectTab("build");
    });

    const settingsCard = document.createElement("div");
    settingsCard.className = "card";
    settingsPane.appendChild(settingsCard);

    const nameField = document.createElement("div");
    nameField.className = "field";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "App Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = config.appName;
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    settingsCard.appendChild(nameField);

    const urlField = document.createElement("div");
    urlField.className = "field";
    const urlLabel = document.createElement("label");
    urlLabel.textContent = "Base URL";
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.value = config.baseUrl;
    urlField.appendChild(urlLabel);
    urlField.appendChild(urlInput);
    settingsCard.appendChild(urlField);

    const logoField = document.createElement("div");
    logoField.className = "field";
    const logoLabel = document.createElement("label");
    logoLabel.textContent = "App Icon & Logo";
    logoField.appendChild(logoLabel);

    const logoRow = document.createElement("div");
    logoRow.className = "row";
    logoRow.style.alignItems = "center";
    logoRow.style.gap = "14px";

    const logoImg = document.createElement("img");
    logoImg.style.width = "44px";
    logoImg.style.height = "44px";
    logoImg.style.borderRadius = "8px";
    logoImg.style.border = "1px solid var(--border)";
    logoImg.style.background = "var(--bg)";
    logoImg.style.objectFit = "contain";
    logoImg.style.padding = "4px";

    const refreshLogo = async () => {
      try {
        const dataUrl = await ctx.bridge.project.loadLogoDataUrl(targetDir);
        if (dataUrl) {
          logoImg.src = dataUrl;
          logoImg.style.display = "block";
        } else {
          logoImg.style.display = "none";
        }
      } catch {
        logoImg.style.display = "none";
      }
    };
    refreshLogo();

    const changeLogoBtn = document.createElement("button");
    changeLogoBtn.className = "secondary";
    changeLogoBtn.type = "button";
    changeLogoBtn.textContent = "Change Icon…";
    changeLogoBtn.style.flex = "0 0 auto";
    changeLogoBtn.addEventListener("click", async () => {
      try {
        const chosen = await ctx.bridge.dialogs.chooseLogo();
        if (!chosen) return;
        changeLogoBtn.disabled = true;
        changeLogoBtn.textContent = "Updating…";
        await ctx.bridge.project.setLogo(targetDir, chosen);
        await refreshLogo();
        ctx.notify("App icon and logo updated successfully.", "success");
      } catch (err) {
        ctx.notify(err.message || String(err), "error");
      } finally {
        changeLogoBtn.disabled = false;
        changeLogoBtn.textContent = "Change Icon…";
      }
    });

    const logoHint = document.createElement("span");
    logoHint.className = "hint";
    logoHint.style.marginTop = "0";
    logoHint.style.flex = "1";
    logoHint.textContent = "Used for app window, dock icon, and built desktop installers (.icns / .png).";

    logoRow.appendChild(logoImg);
    logoRow.appendChild(changeLogoBtn);
    logoRow.appendChild(logoHint);
    logoField.appendChild(logoRow);
    settingsCard.appendChild(logoField);

    const checkboxList = document.createElement("div");
    checkboxList.className = "checkbox-list";
    const featureInputs = {};
    featureFieldDefs().forEach(function (feature) {
      const item = document.createElement("label");
      item.className = "checkbox-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!config.features[feature.key];
      featureInputs[feature.key] = input;

      const text = document.createElement("div");
      const labelDiv = document.createElement("div");
      labelDiv.className = "label";
      labelDiv.textContent = feature.label;
      const hintDiv = document.createElement("div");
      hintDiv.className = "hint";
      hintDiv.textContent = feature.hint;
      text.appendChild(labelDiv);
      text.appendChild(hintDiv);

      item.appendChild(input);
      item.appendChild(text);
      checkboxList.appendChild(item);
    });
    settingsCard.appendChild(checkboxList);

    const settingsActions = document.createElement("div");
    settingsActions.className = "actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "primary";
    saveBtn.textContent = "Save Changes";
    saveBtn.addEventListener("click", async function () {
      saveBtn.disabled = true;
      try {
        const features = {};
        Object.keys(featureInputs).forEach(function (key) {
          features[key] = featureInputs[key].checked;
        });
        const result = await ctx.bridge.project.saveConfig(targetDir, {
          appName: nameInput.value,
          baseUrl: urlInput.value,
          features: features,
        });
        ctx.state.project.config = result;
        ctx.notify("Saved.", "success");
        ctx.goTo("dashboard");
      } catch (error) {
        ctx.notify(error.message, "error");
      } finally {
        saveBtn.disabled = false;
      }
    });
    settingsActions.appendChild(saveBtn);
    settingsCard.appendChild(settingsActions);

    const buildCard = document.createElement("div");
    buildCard.className = "card";
    buildPane.appendChild(buildCard);

    function actionField(labelText, hintText, button) {
      const field = document.createElement("div");
      field.className = "field";
      const label = document.createElement("label");
      label.textContent = labelText;
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = hintText;
      const actions = document.createElement("div");
      actions.className = "actions";
      actions.style.marginTop = "12px";
      actions.appendChild(button);
      field.appendChild(label);
      field.appendChild(hint);
      field.appendChild(actions);
      return field;
    }

    const installBtn = document.createElement("button");
    installBtn.className = "secondary";
    installBtn.textContent = "Install Dependencies";
    buildCard.appendChild(
      actionField(
        "Install Dependencies",
        "Installs the required Electron runtime and build tools for this project via npm.",
        installBtn
      )
    );

    const previewBtn = document.createElement("button");
    previewBtn.className = "primary";
    previewBtn.textContent = "Preview App";
    buildCard.appendChild(
      actionField(
        "Preview App",
        "Launches the generated Electron app locally so you can click through it before building installers.",
        previewBtn
      )
    );

    const buildBtn = document.createElement("button");
    buildBtn.className = "primary";
    buildBtn.textContent = "Build Installers";
    buildCard.appendChild(
      actionField(
        "Build Installers",
        "Packages the generated app into distributable installers for Windows and Mac.",
        buildBtn
      )
    );

    const consoleHeader = document.createElement("div");
    consoleHeader.className = "console-header";

    const consoleTitle = document.createElement("span");
    consoleTitle.className = "console-title";
    consoleTitle.textContent = "Terminal Output";

    const consoleActions = document.createElement("div");
    consoleActions.className = "console-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "console-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.title = "Copy terminal output";
    copyBtn.addEventListener("click", async function () {
      const text = logConsole.innerText || "";
      if (!text.trim()) {
        ctx.notify("No terminal output to copy.", "error");
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        ctx.notify("Terminal output copied to clipboard.", "success");
      } catch {
        const temp = document.createElement("textarea");
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        ctx.notify("Terminal output copied to clipboard.", "success");
      }
    });

    const clearBtn = document.createElement("button");
    clearBtn.className = "console-btn";
    clearBtn.type = "button";
    clearBtn.textContent = "Clear";
    clearBtn.title = "Clear terminal output";
    clearBtn.addEventListener("click", function () {
      logConsole.innerHTML = "";
    });

    consoleActions.appendChild(copyBtn);
    consoleActions.appendChild(clearBtn);
    consoleHeader.appendChild(consoleTitle);
    consoleHeader.appendChild(consoleActions);

    buildPane.appendChild(consoleHeader);

    const logConsole = document.createElement("div");
    logConsole.className = "log-console";
    buildPane.appendChild(logConsole);

    const artifactsContainer = document.createElement("div");
    artifactsContainer.style.marginTop = "14px";
    buildPane.appendChild(artifactsContainer);

    function updateButtons() {
      const anyRunning = running.install || running.dev || running.build;

      installBtn.disabled = anyRunning;
      installBtn.innerHTML = running.install ? '<span class="spinner"></span>Installing…' : "Install Dependencies";

      buildBtn.disabled = anyRunning;
      buildBtn.innerHTML = running.build ? '<span class="spinner"></span>Building…' : "Build Installers";

      if (running.dev) {
        previewBtn.className = "danger";
        previewBtn.disabled = false;
        previewBtn.textContent = "Stop Preview";
      } else {
        previewBtn.className = "primary";
        previewBtn.disabled = anyRunning;
        previewBtn.textContent = "Preview App";
      }
    }

    function appendLogLine(prefixText, stream, text) {
      const lines = String(text).split(/\r?\n/);
      lines.forEach(function (line, index) {
        if (line === "" && index === lines.length - 1) {
          return;
        }
        const span = document.createElement("span");
        if (stream === "stderr") {
          span.className = "stderr";
        }
        span.textContent = prefixText + line + "\n";
        logConsole.appendChild(span);
      });
      logConsole.scrollTop = logConsole.scrollHeight;
    }

    function renderArtifacts(artifacts) {
      artifactsContainer.innerHTML = "";

      const tip = document.createElement("div");
      tip.style.fontSize = "12px";
      tip.style.color = "var(--text-muted)";
      tip.style.marginBottom = "10px";
      tip.style.padding = "10px 14px";
      tip.style.background = "var(--bg-card)";
      tip.style.border = "1px solid var(--border)";
      tip.style.borderRadius = "var(--radius)";
      tip.style.lineHeight = "1.5";
      tip.innerHTML =
        '<strong>macOS Security Tip:</strong> Local builds are automatically ad-hoc signed and unquarantined. If macOS Sequoia blocks an app extracted from a DMG, click <em>Unquarantine</em> or run the unpacked <code>.app</code> in <code>release/mac-universal/</code>.';
      artifactsContainer.appendChild(tip);

      artifacts.forEach(function (artifactPath) {
        const item = document.createElement("div");
        item.className = "list-item";

        const left = document.createElement("div");
        const name = document.createElement("div");
        name.textContent = artifactPath.split(/[\\/]/).pop();
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = artifactPath;
        left.appendChild(name);
        left.appendChild(meta);

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "8px";

        if (artifactPath.endsWith(".app")) {
          const openBtn = document.createElement("button");
          openBtn.className = "secondary";
          openBtn.textContent = "Open App";
          openBtn.addEventListener("click", async function () {
            try {
              await ctx.bridge.project.openInFileManager(artifactPath);
            } catch (error) {
              ctx.notify(error.message, "error");
            }
          });
          actions.appendChild(openBtn);
        }

        const unqBtn = document.createElement("button");
        unqBtn.className = "secondary";
        unqBtn.textContent = "Unquarantine";
        unqBtn.title = "Clear quarantine attribute and verify ad-hoc signature";
        unqBtn.addEventListener("click", async function () {
          try {
            const res = await ctx.bridge.project.unquarantine(artifactPath);
            if (res && res.success) {
              ctx.notify("Quarantine cleared & ad-hoc signature applied! Ready to launch.", "success");
            } else {
              ctx.notify("Could not unquarantine path.", "error");
            }
          } catch (error) {
            ctx.notify(error.message, "error");
          }
        });
        actions.appendChild(unqBtn);

        const revealBtn = document.createElement("button");
        revealBtn.className = "secondary";
        revealBtn.textContent = "Reveal";
        revealBtn.addEventListener("click", async function () {
          try {
            await ctx.bridge.project.openInFileManager(artifactPath);
          } catch (error) {
            ctx.notify(error.message, "error");
          }
        });
        actions.appendChild(revealBtn);

        item.appendChild(left);
        item.appendChild(actions);
        artifactsContainer.appendChild(item);
      });
    }

    installBtn.addEventListener("click", async function () {
      running.install = true;
      updateButtons();
      try {
        await ctx.bridge.project.install(targetDir);
      } catch (error) {
        running.install = false;
        updateButtons();
        ctx.notify(error.message, "error");
      }
    });

    previewBtn.addEventListener("click", async function () {
      if (running.dev) {
        previewBtn.disabled = true;
        previewBtn.innerHTML = '<span class="spinner"></span>Stopping…';
        try {
          const result = await ctx.bridge.project.stopDev();
          if (!result.stopped) {
            // No process was actually running to stop — no onProcessDone will
            // arrive to clear this, so reset the flag ourselves.
            running.dev = false;
            updateButtons();
          }
        } catch (error) {
          running.dev = false;
          ctx.notify(error.message, "error");
          updateButtons();
        }
        return;
      }

      running.dev = true;
      updateButtons();
      try {
        await ctx.bridge.project.dev(targetDir);
      } catch (error) {
        running.dev = false;
        updateButtons();
        ctx.notify(error.message, "error");
      }
    });

    buildBtn.addEventListener("click", async function () {
      running.build = true;
      updateButtons();
      try {
        await ctx.bridge.project.build(targetDir);
      } catch (error) {
        running.build = false;
        updateButtons();
        ctx.notify(error.message, "error");
      }
    });

    const unsubscribeLog = ctx.bridge.onLog(function (payload) {
      appendLogLine("[" + payload.task + "] ", payload.stream, payload.line);
    });

    const unsubscribeDone = ctx.bridge.onProcessDone(function (payload) {
      running[payload.task] = false;
      updateButtons();

      const summary = payload.success
        ? "✓ " + payload.task + " finished"
        : "✗ " +
          payload.task +
          " failed" +
          (payload.code != null ? " (exit code " + payload.code + ")" : "") +
          (payload.error ? ": " + payload.error : "");
      appendLogLine("", "stdout", summary);

      if (payload.task === "build" && payload.success && payload.artifacts) {
        renderArtifacts(payload.artifacts);
      }
    });

    updateButtons();

    return function cleanup() {
      unsubscribeLog();
      unsubscribeDone();
    };
  };
})();
