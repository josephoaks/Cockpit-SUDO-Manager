/*
 * js/modal.js
 * Generic Modal engine (PF6-correct)
*/
"use strict";

import { $ } from "./dom.js";

export function openModal(backdropId, onOpen) {
  const el = $(backdropId);
  if (!el) return;

  el.hidden = false;

  // PF6 modal activation
  document.body.classList.add("pf-v6-c-backdrop__open");

  if (onOpen) onOpen();
}

export function closeModal(backdropId) {
  const el = $(backdropId);
  if (!el) return;

  el.hidden = true;

  document.body.classList.remove("pf-v6-c-backdrop__open");
}
