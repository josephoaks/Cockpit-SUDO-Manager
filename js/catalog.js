/*
 * js/catalog.js
 * Command Catalog logic
*/
"use strict";

import { $, qsa } from "./dom.js";
import { spawnBackend } from "./backend.js";

export let availableCommands = [];

/*
 * Load sudo command catalog from backend.
 *
 * Responsibilities:
 * - Fetch catalog JSON
 * - Populate command <select> elements
 * - Build flat availableCommands list
 * - Return full catalog for consumers (UI hover, etc)
 */
export async function loadCommandCatalog() {
  availableCommands = [];

  const out = await spawnBackend(["catalog"]);
  const catalog = JSON.parse(out);

  populateCommandSelect(catalog);

  Object.values(catalog).forEach(section => {
    Object.keys(section.command_aliases || {}).forEach(a => {
      if (!availableCommands.includes(a)) {
        availableCommands.push(a);
      }
    });

    (section.raw_commands || []).forEach(c => {
      if (!availableCommands.includes(c)) {
        availableCommands.push(c);
      }
    });
  });

  return catalog;
}

/*
 * Populate command selector UI from catalog
 */
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
