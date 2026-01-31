/*
 * index.js
 * Core Orchestration
*/
"use strict";

cockpit.locale();

import { $, qsa } from "./js/dom.js";
import { loadTemplate } from "./js/templates.js";
import { loadCommandCatalog } from "./js/catalog.js";
import { showModal, hideModal, MODALS } from "./js/registry.js";
import { spawnBackend } from "./js/backend.js";
import { initMenus } from "./js/menu.js";
import { createModal } from "./js/modal_factory.js";

let rules = [];
let ruleRowTemplate = null;
let aliasMap = {};

/* ===================== LOAD RULES ===================== */

async function loadRules() {
  const table = document.querySelector(".sudo-rules-table");
  if (!table) return;

  table.querySelectorAll(".sudo-rule-body").forEach(tb => tb.remove());
  $("status").textContent = "Loading sudo rules…";

  try {
    const out = await spawnBackend(["list"]);
    rules = JSON.parse(out) || [];

    for (const rule of rules) {
      await renderRow(rule);
    }

    $("status").textContent = "Loaded sudo rules";
  } catch (err) {
    console.error(err);
    $("status").textContent = "Failed to load sudo rules";
  }
}

/* ===================== RENDER CMDS ==================== */

function renderCommands(cmds) {
  if (!cmds || cmds.length === 0) {
    return "ALL";
  }

  return cmds.map(cmd => {
    if (!aliasMap[cmd]) {
      return cmd;
    }

    const tooltip = aliasMap[cmd].join("\n");
    return `<span class="sudo-alias" title="${tooltip}">${cmd}</span>`;
  }).join(", ");
}


/* ===================== RENDER ROW ===================== */

async function renderRow(rule) {
  if (!ruleRowTemplate) {
    ruleRowTemplate = await loadTemplate("./templates/rule-row.html");
  }

  const html = ruleRowTemplate
    .replaceAll("{{user}}", rule.user)
    .replace("{{commands}}", "")
    .replace("{{nopasswd}}", rule.nopasswd ? "Yes" : "No");

  const table = document.querySelector(".sudo-rules-table");
  table.insertAdjacentHTML("beforeend", html);

  // CORRECT: grab the row we just inserted
  const row = table.lastElementChild;
  if (!row) return;

  const commandsCell = row.querySelector(".sudo-commands");
  if (!commandsCell) return;

  commandsCell.textContent = "";

  if (rule.all) {
    commandsCell.textContent = "ALL";
    return;
  }

  rule.commands.forEach((cmd, i) => {
    if (i > 0) {
      commandsCell.appendChild(document.createTextNode(", "));
    }

    if (aliasMap[cmd]) {
      const span = document.createElement("span");
      span.className = "sudo-alias";
      span.textContent = cmd;
      span.title = aliasMap[cmd].join("\n");
      commandsCell.appendChild(span);
    } else {
      commandsCell.appendChild(document.createTextNode(cmd));
    }
  });
}


/* ===================== MENU HANDLING ===================== */

document.addEventListener("click", e => {
  const item = e.target.closest(".pf-v6-c-menu__item");
  if (!item) return;

  const action = item.dataset.action;
  const user   = item.dataset.user;

  if (action === "add-user") {
    showModal("user", null, () => {
      hideModal("user");
      loadRules();
    });
    return;
  }

  if (action === "add-alias") {
    showModal("alias", null, () => {
      hideModal("alias");
      loadCommandCatalog();
    });
    return;
  }

  if (action === "add-group") {
    showModal("group", null, () => {
      hideModal("group");
      loadRules();
    });
    return;
  }

  if (action === "edit") {
    const rule = rules.find(r => r.user === user);
    if (rule) {
      showModal("user", rule, () => {
        hideModal("user");
        loadRules();
      });
    }
  }
});

/* ===================== MODAL BOOTSTRAP ===================== */
/*
 * This replaces static modal markup in main.html
 * Modals are created ONCE, safely, at init time.
 */

function initModals() {
  /* USER MODAL */
  createModal({
    id: "modal-backdrop",
    title: "",
    body: document
      .getElementById("user-form-template")
      .content.cloneNode(true),
    onSave: () => MODALS.user.apply(() => {
      hideModal("user");
      loadRules();
    }),
    onCancel: () => hideModal("user")
  });

  /* ALIAS MODAL */
  createModal({
    id: "alias-modal-backdrop",
    title: "Add Alias",
    body: document
      .getElementById("alias-form-template")
      .content.cloneNode(true),
    onSave: () => MODALS.alias.apply(() => {
      hideModal("alias");
      loadCommandCatalog();
    }),
    onCancel: () => hideModal("alias")
  });

  /* GROUP MODAL */
  createModal({
    id: "group-modal-backdrop",
    title: "Add Sudo Group",
    body: document
      .getElementById("group-form-template")
      .content.cloneNode(true),
    onSave: () => MODALS.group.apply(() => {
      hideModal("group");
      loadRules();
    }),
    onCancel: () => hideModal("group")
  });
}

/* ===================== INIT ===================== */

(async function render() {
  const root = $("sudo-manager-app");

  try {
    root.innerHTML = await loadTemplate("./templates/main.html");

    initMenus();
    initModals();   // <<< NEW (critical)

    const catalog = await loadCommandCatalog();

    aliasMap = {};
    Object.values(catalog).forEach(section => {
      Object.entries(section.command_aliases || {}).forEach(([alias, cmds]) => {
        aliasMap[alias] = cmds;
      });
    });

    await loadRules();

  } catch (err) {
    console.error(err);
    root.textContent = "Failed to load UI";
  }
})();
