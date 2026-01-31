/* 
 * js/backend.js
 * cockpit.spawn wrapper
*/
"use strict";

const PYTHON  = "/usr/bin/python3";
const BACKEND = "/usr/share/cockpit/sudo-manager/backend/sudo-manager.py";

export function spawnBackend(args, { onSuccess, onError } = {}) {
  return cockpit.spawn(
    [PYTHON, BACKEND, ...args],
    { superuser: "require", err: "message" }
  )
  .then(result => {
    if (onSuccess) onSuccess(result);
    return result;
  })
  .catch(err => {
    if (onError) onError(err);
    else alert(err.message || "Backend operation failed");
  });
}
