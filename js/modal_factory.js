/*
 * js/modal_factory.js
 * Modal factory (DOM-driven)
*/
"use strict";

import { $ } from "./dom.js";

export function createModal({ id, title, body, onSave, onCancel }) {
  const root = document.body;

  const shellTpl = document.querySelector("#modal-shell-template");
  if (!shellTpl) {
    throw new Error("modal-shell-template not found");
  }

  if (!body) {
    throw new Error("modal body not provided");
  }

  const fragment = shellTpl.content.cloneNode(true);

  const backdrop = fragment.querySelector(".pf-v6-c-backdrop");
  const titleEl  = fragment.querySelector(".pf-v6-c-modal-box__title");
  const bodyEl   = fragment.querySelector(".pf-v6-c-modal-box__body");
  const saveBtn  = fragment.querySelector(".modal-apply");
  const cancelBtn = fragment.querySelector(".modal-cancel");

  titleEl.textContent = title || "";
  bodyEl.appendChild(body);

  saveBtn.onclick   = onSave || (() => {});
  cancelBtn.onclick = onCancel || (() => {});

  backdrop.id = id;
  backdrop.hidden = true;

  root.appendChild(backdrop);
}
