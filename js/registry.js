/* 
 * js/registry.js
 * Modal Registry (core logic)
*/
"use strict";

import { $ } from "./dom.js";
import { openModal, closeModal } from "./modal.js";
import { spawnBackend } from "./backend.js";
import { availableCommands } from "./catalog.js";

function closeAllModals() {
  Object.values(MODALS).forEach(m => {
    const el = document.getElementById(m.backdrop);
    if (el) {
      el.hidden = true;
    }
  });

  document.body.classList.remove("pf-v6-c-backdrop__open");
}

function toggleCommands() {
  const disabled = $("allow_all").checked;
  $("commands").disabled = disabled;
  if (disabled) {
    [...$("commands").options].forEach(o => o.selected = false);
  }
}

export const MODALS = {

  user: {
    backdrop: "modal-backdrop",

    open(rule) {
      $("form").reset();
      $("runas").value = "root";

      if (rule) {
        $("user").value = rule.user;
        $("runas").value = rule.runas;
        $("nopasswd").checked = rule.nopasswd;
        $("allow_all").checked = rule.all;

        if (!rule.all) {
          [...$("commands").options].forEach(o => {
            o.selected = rule.commands.includes(o.value);
          });
        }
      }

      toggleCommands();
    },

    apply(onDone) {
      const user = $("user").value.trim();
      if (!user) return alert("User is required");

      const runas = $("runas").value || "root";
      const mode  = $("nopasswd").checked ? "nopasswd" : "passwd";
      const selected = [...$("commands").selectedOptions].map(o => o.value);

      if (!$("allow_all").checked && selected.length === 0) {
        return alert("Select at least one command or Allow ALL");
      }

      const cmds = $("allow_all").checked ? "ALL" : selected.join(", ");

      spawnBackend(
        ["update", user, runas, mode, cmds],
        { onSuccess: onDone }
      );
    }
  },

  alias: {
    backdrop: "alias-modal-backdrop",

    open() {
      $("alias-form").reset();
    },

    apply(onDone) {
      const type = $("alias-type").value;
      const name = $("alias-name").value.trim();
      const members = $("alias-members").value
        .split("\n").map(m => m.trim()).filter(Boolean);

      if (!type || !name || members.length === 0) {
        return alert("All alias fields are required");
      }

      spawnBackend(
        ["add-alias", type, name, ...members],
        { onSuccess: onDone }
      );
    }
  },

  group: {
    backdrop: "group-modal-backdrop",

    open() {
      $("group-form").reset();
      $("group-runas").value = "root";

      const select = $("group-commands");
      select.textContent = "";

      availableCommands.forEach(cmd => {
        const o = document.createElement("option");
        o.value = cmd;
        o.textContent = cmd;
        select.appendChild(o);
      });
    },

    apply(onDone) {
      const group = $("group").value.trim();
      if (!group) return alert("Group is required");

      const runas = $("group-runas").value || "root";
      const allowAll = $("group-allow-all").checked;

      const selected = [...$("group-commands").selectedOptions]
        .map(o => o.value);

      if (!allowAll && selected.length === 0) {
        return alert("Select at least one command or Allow ALL");
      }

      const cmds = allowAll ? "ALL" : selected.join(", ");

      spawnBackend(
        ["update-group", group, runas, "passwd", cmds],
        { onSuccess: onDone }
      );
    }
  }
};

export function showModal(type, payload, onDone) {
  closeAllModals();
  const m = MODALS[type];
  openModal(m.backdrop, () => m.open(payload));
  m._onDone = onDone;
}

export function hideModal(type) {
  closeModal(MODALS[type].backdrop);
}
