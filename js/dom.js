/* 
 * js/dom.js
 * DOM helpers only
*/
"use strict";

export const $ = id => document.getElementById(id);
export const qs = sel => document.querySelector(sel);
export const qsa = sel => Array.from(document.querySelectorAll(sel));
