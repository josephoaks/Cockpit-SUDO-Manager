cockpit.locale();

(function () {
  "use strict";

  if (typeof cockpit === "undefined") {
    alert("Cockpit API not loaded");
    return;
  }

  const BACKEND = "/usr/share/cockpit/sudo-manager/backend/sudo-manager.py";
  const PYTHON  = "/usr/bin/python3";

  const $ = id => document.getElementById(id);

  let rules = [];
  let availableCommands = [];
  let ruleRowTemplate = null;

  /* ===================== TEMPLATE LOADER ===================== */

  async function loadTemplate(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`Failed to load template: ${path}`);
    return r.text();
  }

  /* ===================== COMMAND CATALOG ===================== */

  async function loadCommandCatalog() {
    availableCommands = [];

    const out = await cockpit.spawn(
      [PYTHON, BACKEND, "catalog"],
      { superuser: "require", err: "message" }
    );

    const catalog = JSON.parse(out);
    populateCommandSelect(catalog);

    Object.values(catalog).forEach(section => {
      Object.keys(section.command_aliases || {}).forEach(a => {
        if (!availableCommands.includes(a)) availableCommands.push(a);
      });
      (section.raw_commands || []).forEach(c => {
        if (!availableCommands.includes(c)) availableCommands.push(c);
      });
    });
  }

  function populateCommandSelect(catalog) {
    const select = $("commands");
    if (!select) return;

    select.textContent = "";

    Object.entries(catalog).forEach(([category, section]) => {
      const group = document.createElement("optgroup");
      group.label = category;

      Object.keys(section.command_aliases || {}).forEach(alias => {
        const o = document.createElement("option");
        o.value = alias;
        o.textContent = alias;
        group.appendChild(o);
      });

      (section.raw_commands || []).forEach(cmd => {
        const o = document.createElement("option");
        o.value = cmd;
        o.textContent = cmd;
        group.appendChild(o);
      });

      select.appendChild(group);
    });
  }

  /* ===================== LOAD RULES ===================== */

  function loadRules() {
    const table = document.querySelector(".sudo-rules-table");
    if (!table) return;

    table.querySelectorAll(".sudo-rule-body").forEach(tb => tb.remove());
    $("status").textContent = "Loading sudo rules…";

    cockpit.spawn(
      [PYTHON, BACKEND, "list"],
      { superuser: "require", err: "message" }
    ).then(out => {
      rules = JSON.parse(out) || [];
      rules.forEach(renderRow);
      $("status").textContent = "Loaded sudo rules";
    }).catch(err => {
      console.error("LIST FAILED:", err);
      $("status").textContent = "Failed to load sudo rules";
    });
  }

  /* ===================== RENDER ROW ===================== */

  async function renderRow(rule) {
    if (!ruleRowTemplate) {
      ruleRowTemplate = await loadTemplate("templates/rule-row.html");
    }

    const commandsText = rule.all
      ? "ALL"
      : rule.commands.join(", ");

    const html = ruleRowTemplate
      .replaceAll("{{user}}", rule.user)
      .replace("{{commands}}", commandsText)
      .replace("{{nopasswd}}", rule.nopasswd ? "Yes" : "No");

    const table = document.querySelector(".sudo-rules-table");
    if (!table) return;

    table.insertAdjacentHTML("beforeend", html);
  }

  /* ===================== MENU HANDLING ===================== */

  document.addEventListener("click", e => {
    const toggle = e.target.closest(".pf-v6-c-menu-toggle");
    const item   = e.target.closest(".pf-v6-c-menu__item");

    document.querySelectorAll(".pf-v6-c-menu__list")
      .forEach(m => m.hidden = true);

    if (toggle) {
      toggle.nextElementSibling.hidden = false;
      e.stopPropagation();
      return;
    }

    if (item) {
      const user = item.dataset.user;
      const rule = rules.find(r => r.user === user);

      if (item.dataset.action === "edit") openModal(rule);
      if (item.dataset.action === "delete") deleteRule(user);
    }
  });

  /* ===================== MODAL ===================== */

  function openModal(rule = null) {
    $("modal-backdrop").hidden = false;
    document.body.classList.add("pf-v6-c-backdrop__open");

    [...$("commands").options].forEach(o => o.selected = false);

    if (rule) {
      $("modal-title").textContent = `Edit sudo rule for ${rule.user}`;
      $("user").value = rule.user;
      $("runas").value = rule.runas;
      $("nopasswd").checked = rule.nopasswd;
      $("allow_all").checked = rule.all;

      if (!rule.all) {
        [...$("commands").options].forEach(o => {
          if (rule.commands.includes(o.value)) o.selected = true;
        });
      }
    } else {
      $("modal-title").textContent = "Add sudo rule";
      $("form").reset();
      $("runas").value = "root";
    }

    toggleCommands();
  }

  function closeModal() {
    $("modal-backdrop").hidden = true;
    document.body.classList.remove("pf-v6-c-backdrop__open");
  }

  function toggleCommands() {
    const disabled = $("allow_all").checked;
    $("commands").disabled = disabled;
    if (disabled) {
      [...$("commands").options].forEach(o => o.selected = false);
    }
  }

  /* ===================== APPLY ===================== */

  function applyRule() {
    const user = $("user").value.trim();
    if (!user) {
      alert("User is required");
      return;
    }

    const runas = $("runas").value || "root";
    const mode  = $("nopasswd").checked ? "nopasswd" : "passwd";
    const selected = [...$("commands").selectedOptions].map(o => o.value);

    if (!$("allow_all").checked && selected.length === 0) {
      alert("Select at least one command or choose Allow ALL");
      return;
    }

    const cmds = $("allow_all").checked ? "ALL" : selected.join(", ");

    cockpit.spawn(
      [PYTHON, BACKEND, "update", user, runas, mode, cmds],
      { superuser: "require", err: "message" }
    ).then(() => {
      closeModal();
      loadRules();
    }).catch(err => {
      console.error("SAVE FAILED:", err);
      alert(err.message || "Failed to save sudo rule");
    });
  }

  function deleteRule(user) {
    if (!confirm(`Delete sudo rule for ${user}?`)) return;

    cockpit.spawn(
      [PYTHON, BACKEND, "delete", user],
      { superuser: "require", err: "message" }
    ).then(loadRules)
     .catch(err => alert(err.message));
  }

  /* ===================== CUSTOM COMMANDS ===================== */

  function saveCustomCommand(cmd) {
    const path = "/usr/share/cockpit/sudo-manager/commands.local";
    const file = cockpit.file(path, { superuser: "require" });

    file.read()
      .catch(() => "")
      .then(content => {
        const lines = content.split("\n").filter(Boolean);

        if (lines.includes(cmd) || availableCommands.includes(cmd)) {
          selectCommandInUI(cmd);
          return null;
        }

        return file.replace(content + cmd + "\n");
      })
      .then(result => {
        if (result === null) return;

        availableCommands.push(cmd);
        addCommandToUI(cmd);
      })
      .catch(err => alert("Failed to save command: " + err.message));
  }

  function addCommandToUI(cmd) {
    const o = document.createElement("option");
    o.value = cmd;
    o.textContent = cmd;
    o.selected = true;
    $("commands").appendChild(o);
  }

  function selectCommandInUI(cmd) {
    [...$("commands").options].forEach(o => {
      if (o.value === cmd) o.selected = true;
    });
  }

  /* ===================== RENDER ===================== */

  async function render() {
    const root = $("sudo-manager-app");

    try {
      root.innerHTML = await loadTemplate("templates/main.html");

      $("add").onclick = () => openModal();
      $("apply").onclick = applyRule;
      $("cancel").onclick = closeModal;
      $("allow_all").onchange = toggleCommands;

      $("add-custom-command").onclick = () => {
        const input = $("custom-command");
        const cmd = input.value.trim();
        if (!cmd) return;

        if (!cmd.startsWith("/")) {
          alert("Command must be an absolute path");
          return;
        }

        if (/[;&|$`]|&&|\|\|/.test(cmd)) {
          alert("Unsafe characters in command");
          return;
        }

        saveCustomCommand(cmd);
        input.value = "";
      };

      await loadCommandCatalog();
      loadRules();

    } catch (err) {
      console.error(err);
      root.textContent = "Failed to load UI";
    }
  }

  render();
})();
