/* 
 * js/templates.js
 * template loader
*/
"use strict";

export async function loadTemplate(path) {
  const r = await fetch(path);
  if (!r.ok) {
    throw new Error(`Failed to load template: ${path}`);
  }
  return r.text();
}
