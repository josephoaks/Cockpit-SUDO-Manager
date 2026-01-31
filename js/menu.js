/*
 * js/menu.js
 * Menu helper
*/
"use strict";

export function initMenus() {
  document.addEventListener("click", e => {
    const toggle = e.target.closest(
      ".pf-v6-c-menu-toggle, .pf-c-menu-toggle"
    );

    const item = e.target.closest(
      ".pf-v6-c-menu__item, .pf-c-menu__item"
    );

    if (toggle) {
      e.stopPropagation();

      const menu = toggle.nextElementSibling;
      if (!menu) return;

      const willOpen = menu.hidden;

      closeAllMenus();

      menu.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
      return;
    }

    if (item) {
      closeAllMenus();
      return;
    }

    closeAllMenus();
  });
}

function closeAllMenus() {
  document
    .querySelectorAll(".pf-v6-c-menu__list, .pf-c-menu__list")
    .forEach(menu => {
      menu.hidden = true;

      const toggle = menu.previousElementSibling;
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }
    });
}
