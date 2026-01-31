# Cockpit Sudo Manager

A Cockpit plugin for managing `sudo` policy on SUSE Linux Enterprise systems in a structured, auditable, and policy-driven way.

Cockpit Sudo Manager provides a UI-driven alternative to manually editing `/etc/sudoers` and `/etc/sudoers.d/*`, while still respecting native `sudo` behavior, ordering, and security expectations.

---

## Overview

Managing `sudo` safely at scale is hard:

- Manual edits are error-prone  
- Syntax errors can lock out administrators  
- Auditors want traceability  
- Engineers want speed and clarity  

**Cockpit Sudo Manager** bridges that gap by exposing controlled sudo management inside Cockpit, backed by standard sudoers files on disk.

The plugin is designed to:
- Avoid replacing `sudo`
- Avoid inventing a new policy language
- Keep everything compatible with existing tooling (`visudo`, config management, backups)

---

## Current Working Platform

| Component | Status |
|--------|--------|
| OS | **SUSE Linux Enterprise Server 16** |
| Cockpit | Cockpit (native SLES packages) |
| Sudo | Standard `sudo` |
| Packaging | Manual install (see below) |

> ⚠️ Only **SLES 16** is supported at this time.

---

## Current Capabilities

- View existing sudo rules
- Manage sudo rules stored under `/etc/sudoers.d/`
- Safe rule generation (no direct editing of `/etc/sudoers`)
- Cockpit-integrated UI
- Preserves sudo file ordering and naming conventions

---

## Work in Progress / Planned Features

The following items are **actively planned or under development**:

- **Advanced sudo options**
  - `NOEXEC`
  - `SETENV`
  - Command-specific flags

- **Validation**
  - `visudo` validation before applying changes
  - Rollback on failure

- **Audit & Logging**
  - Optional journald integration
  - Change history / metadata (who changed what, when)

- **Role separation**
  - Read-only vs admin UI access (Cockpit RBAC)

---

## Installation (Current – Manual)

> Packaging is still in progress. Until then, installation is manual.

### Prerequisites

```bash
sudo zypper install cockpit sudo
sudo systemctl enable --now cockpit.socket
