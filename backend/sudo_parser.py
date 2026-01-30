#!/usr/bin/env python3
import re
from pathlib import Path

CMD_ALIAS_RE = re.compile(r'^Cmnd_Alias\s+(\w+)\s*=\s*(.*)')
RUNAS_ALIAS_RE = re.compile(r'^Runas_Alias\s+(\w+)\s*=\s*(.*)')

def _normalize(cmd: str) -> str:
    return re.sub(r"\s+", " ", cmd.strip())

def parse_sudo_commands(
    path: str = "/usr/share/cockpit/sudo-manager/sudo-commands.d"
) -> dict:
    """
    Parse sudo-commands.d into a menu-safe, policy-aware catalog.

    - Ignores comments, Defaults, empty lines
    - Ignores policy-only files (05-policy, *policy*)
    - Resolves line continuations
    - Normalizes commands
    - Returns ONLY selectable commands / aliases
    """

    catalog: dict[str, dict] = {}

    for file in sorted(Path(path).iterdir()):
        if not file.is_file():
            continue

        # Policy files are constraints, never menu options
        if "policy" in file.name:
            continue

        category = file.name
        catalog[category] = {
            "command_aliases": {},
            "runas_aliases": {},
            "raw_commands": [],
        }

        buffer = ""

        for line in file.read_text(errors="ignore").splitlines():
            line = line.strip()

            if not line or line.startswith("#"):
                continue

            # Defaults are policy, not commands
            if line.startswith("Defaults"):
                continue

            # Handle continuations
            if line.endswith("\\"):
                buffer += line[:-1] + " "
                continue

            line = buffer + line
            buffer = ""

            if m := CMD_ALIAS_RE.match(line):
                name, rest = m.groups()
                catalog[category]["command_aliases"][name] = [
                    _normalize(c) for c in rest.split(",") if c.strip()
                ]
                continue

            if m := RUNAS_ALIAS_RE.match(line):
                name, rest = m.groups()
                catalog[category]["runas_aliases"][name] = [
                    r.strip() for r in rest.split(",") if r.strip()
                ]
                continue

            # Raw commands (allowed but uncommon)
            catalog[category]["raw_commands"].append(_normalize(line))

    return catalog
