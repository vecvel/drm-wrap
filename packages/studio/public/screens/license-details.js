window.DRMStudio.screens.licenseDetails = function (container, ctx) {
  const screen = document.createElement("div");
  screen.className = "screen";
  container.appendChild(screen);

  const nav = document.createElement("div");
  nav.className = "screen-nav";

  const backLink = document.createElement("button");
  backLink.type = "button";
  backLink.className = "back-link";
  backLink.id = "license-back";
  backLink.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '  <line x1="19" y1="12" x2="5" y2="12"></line>' +
    '  <polyline points="12 19 5 12 12 5"></polyline>' +
    '</svg>' +
    '<span>Back</span>';
  backLink.addEventListener("click", function () {
    ctx.goTo("home");
  });
  nav.appendChild(backLink);
  screen.appendChild(nav);

  const header = document.createElement("div");
  header.className = "screen-header";
  header.innerHTML = "<h1>License</h1><p>Your activation details, and options to switch or remove it.</p>";
  screen.appendChild(header);

  function detailRow(label, value) {
    const row = document.createElement("div");
    row.className = "list-item";
    row.style.marginBottom = "10px";

    const left = document.createElement("div");
    left.textContent = label;
    left.style.color = "var(--text-muted)";
    left.style.fontSize = "12px";
    left.style.fontWeight = "600";
    left.style.textTransform = "uppercase";
    left.style.letterSpacing = "0.04em";

    const right = document.createElement("div");
    right.textContent = value;
    right.style.fontSize = "13px";
    right.style.fontWeight = "600";
    right.style.textAlign = "right";

    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  function renderDetailsCard() {
    const license = ctx.state.license;
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "20px";

    if (!license || !license.valid) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No active license.";
      card.appendChild(empty);
      return card;
    }

    const payload = license.payload;
    const heading = document.createElement("h3");
    heading.style.margin = "0 0 14px";
    heading.style.fontSize = "15px";
    heading.textContent = "Current license";
    card.appendChild(heading);

    card.appendChild(detailRow("Customer", payload.customer));
    card.appendChild(detailRow("Email", payload.email));
    card.appendChild(detailRow("Tier", (payload.tier || "").toUpperCase()));
    card.appendChild(detailRow("Domain lock", payload.domain || "None (any domain)"));
    card.appendChild(detailRow("License ID", payload.licenseId));
    card.appendChild(detailRow("Issued", new Date(payload.issuedAt).toLocaleDateString()));
    card.appendChild(
      detailRow("Expires", payload.expiresAt ? new Date(payload.expiresAt).toLocaleDateString() : "Never")
    );

    return card;
  }

  screen.appendChild(renderDetailsCard());

  const reenterCard = document.createElement("div");
  reenterCard.className = "card";
  reenterCard.style.marginBottom = "20px";
  reenterCard.innerHTML =
    '<h3 style="margin: 0 0 6px; font-size: 15px;">Re-enter license key</h3>' +
    '<p style="margin: 0 0 16px; color: var(--text-muted); font-size: 13px; line-height: 1.6;">' +
    "Switching machines, or your key changed? Paste a new key below to replace the current activation." +
    "</p>" +
    '<div class="field">' +
    "<label>License key</label>" +
    '<textarea id="details-reenter-key" rows="3" placeholder="Paste your license key here" ' +
    'style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-strong); ' +
    "background: var(--bg-elevated); color: var(--text); font-size: 13px; " +
    'font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical;"></textarea>' +
    "</div>" +
    '<div class="actions"><button type="button" class="primary" id="details-reenter-btn">Activate New Key</button></div>';
  screen.appendChild(reenterCard);

  const reenterInput = reenterCard.querySelector("#details-reenter-key");
  const reenterBtn = reenterCard.querySelector("#details-reenter-btn");
  reenterBtn.addEventListener("click", async function () {
    const key = reenterInput.value.trim();
    if (!key) {
      ctx.notify("Enter a license key first.", "error");
      return;
    }

    reenterBtn.disabled = true;
    const originalLabel = reenterBtn.textContent;
    reenterBtn.innerHTML = '<span class="spinner"></span>Activating…';

    try {
      const result = await ctx.bridge.license.activate(key);
      if (result.valid) {
        ctx.state.license = result;
        ctx.notify("License updated.", "success");
        ctx.goTo("licenseDetails");
        return;
      }
      ctx.notify(result.reason, "error");
    } catch (error) {
      ctx.notify(error.message, "error");
    }

    reenterBtn.disabled = false;
    reenterBtn.textContent = originalLabel;
  });

  const dangerCard = document.createElement("div");
  dangerCard.className = "card";
  dangerCard.innerHTML =
    '<h3 style="margin: 0 0 6px; font-size: 15px;">Deactivate</h3>' +
    '<p style="margin: 0 0 16px; color: var(--text-muted); font-size: 13px; line-height: 1.6;">' +
    "Removes the license from this machine. You'll need to re-enter a key to create or build apps again." +
    "</p>" +
    '<div class="actions"><button type="button" class="danger" id="details-deactivate-btn">Deactivate License</button></div>';
  screen.appendChild(dangerCard);

  const deactivateBtn = dangerCard.querySelector("#details-deactivate-btn");
  deactivateBtn.addEventListener("click", async function () {
    deactivateBtn.disabled = true;
    try {
      const result = await ctx.bridge.license.deactivate();
      ctx.state.license = result;
      ctx.goTo("license");
    } catch (error) {
      ctx.notify(error.message, "error");
      deactivateBtn.disabled = false;
    }
  });
};
