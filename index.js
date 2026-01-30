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

  /* ===================== COMMAND CATALOG ===================== */

  function loadCommandCatalog() {
    availableCommands = [];

    return cockpit.spawn(
      [
        "sh", "-c",
        "cat /usr/share/cockpit/sudo-manager/sudo-commands.d/* " +
        "/etc/cockpit/sudo-manager/commands.local 2>/dev/null || true"
      ],
      { superuser: "require" }
    ).then(out => {
      out.split("\n").forEach(c => {
        c = c.trim();
        if (c && !availableCommands.includes(c)) {
          availableCommands.push(c);
        }
      });
    });
  }

  /* ===================== LOAD RULES ===================== */

  function loadRules() {
    $("rules").textContent = "";
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

  /* ===================== TABLE ROW ===================== */

  function renderRow(rule) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${rule.user}</td>
      <td>${rule.all ? "ALL" : rule.commands.join(", ")}</td>
      <td>${rule.nopasswd ? "Yes" : "No"}</td>
      <td class="pf-v6-c-table__action">
        <div class="pf-v6-c-menu pf-m-align-right">
          <button class="pf-v6-c-menu-toggle pf-m-plain"
                  data-user="${rule.user}"
                  style="padding:0.25rem">
            <svg width="1em" height="1em" viewBox="0 0 320 512"
                 fill="currentColor">
              <path d="M40 256a40 40 0 1 0 80 0
                       40 40 0 1 0-80 0zm80-120
                       a40 40 0 1 0-80 0
                       40 40 0 1 0 80 0zm0 240
                       a40 40 0 1 0-80 0
                       40 40 0 1 0 80 0z"/>
            </svg>
          </button>
          <ul class="pf-v6-c-menu__list" hidden>
            <li><button class="pf-v6-c-menu__item" data-action="edit" data-user="${rule.user}">Edit</button></li>
            <li><button class="pf-v6-c-menu__item" data-action="delete" data-user="${rule.user}">Delete</button></li>
          </ul>
        </div>
      </td>
    `;

    $("rules").appendChild(tr);
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
    $("modal").hidden = false;
    $("commands").textContent = "";

    availableCommands.forEach(cmd => {
      const o = document.createElement("option");
      o.value = cmd;
      o.textContent = cmd;
      $("commands").appendChild(o);
    });

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
    $("modal").hidden = true;
  }

  function toggleCommands() {
    $("commands").disabled = $("allow_all").checked;
  }

  /* ===================== APPLY ===================== */

  function applyRule() {
    const user = $("user").value.trim();
    if (!user) return alert("User is required");

    const runas = $("runas").value || "root";
    const mode  = $("nopasswd").checked ? "nopasswd" : "passwd";
    const cmds  = $("allow_all").checked
      ? "ALL"
      : [...$("commands").selectedOptions].map(o => o.value).join(", ");

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

  /* ===================== RENDER ===================== */

  function render() {
    const root = $("sudo-manager-app");
    root.replaceChildren();

    root.insertAdjacentHTML("afterbegin", `
      <div class="pf-v6-c-toolbar pf-v6-u-mb-md">
        <div class="pf-v6-c-toolbar__content pf-v6-u-justify-content-flex-end">
	  <div class="pf-v6-c-toolbar__item">
            <button id="add" class="pf-v6-c-button pf-m-primary">
	      Add sudo user
	    </button>
	  </div>
        </div>
      </div>

      <div id="status" class="pf-v6-u-mb-md"></div>

      <div class="pf-v6-c-card">
        <div class="pf-v6-c-card__body">
          <table class="pf-v6-c-table pf-m-compact">
            <thead>
              <tr><th>User</th><th>Commands</th><th>NOPASSWD</th><th></th></tr>
            </thead>
            <tbody id="rules"></tbody>
          </table>
        </div>
      </div>

      <div class="pf-v6-c-modal pf-m-md" id="modal" hidden>
        <div class="pf-v6-c-modal__content">
          <header class="pf-v6-c-modal__header">
            <h1 id="modal-title"></h1>
            <button id="modal-close" class="pf-v6-c-button pf-m-plain">✕</button>
          </header>

          <section class="pf-v6-c-modal__body">
            <form id="form" class="pf-v6-c-form">
              <label>User <input id="user" class="pf-v6-c-form-control"></label>
              <label>Run as <input id="runas" class="pf-v6-c-form-control"></label>
              <label><input id="allow_all" type="checkbox"> Allow ALL</label>
              <select id="commands" multiple size="6" class="pf-v6-c-form-control"></select>
              <label><input id="nopasswd" type="checkbox"> NOPASSWD</label>
            </form>
          </section>

          <footer class="pf-v6-c-modal__footer">
            <button id="apply" class="pf-v6-c-button pf-m-primary">Save</button>
            <button id="cancel" class="pf-v6-c-button pf-m-link">Cancel</button>
          </footer>
        </div>
      </div>
    `);

    $("add").onclick = () => openModal();
    $("apply").onclick = applyRule;
    $("cancel").onclick = closeModal;
    $("modal-close").onclick = closeModal;
    $("allow_all").onchange = toggleCommands;

    loadCommandCatalog().then(loadRules);
  }

  render();
})();
