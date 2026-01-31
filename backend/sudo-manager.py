#!/usr/bin/env python3
import sys
import json
import subprocess
import re
from pathlib import Path
from datetime import datetime

from sudo_parser import parse_sudo_commands

# ------------- Debug ----------------
print(f"[DEBUG] argv = {sys.argv}", file=sys.stderr)

# ---------------- Paths ----------------

SUDOERS_DIR = Path("/etc/sudoers.d")
APP_BASE = Path("/usr/share/cockpit/sudo-manager")
TEMPLATE = APP_BASE / "templates/user.sudoers.tpl"

# >>> Alias support
ALIAS_FILE = SUDOERS_DIR / "cockpit-aliases"
ALIAS_TEMPLATE = APP_BASE / "templates/aliases.tpl"

# Marker string REQUIRED by list_rules()
ALIAS_HEADER = (
    "# Managed by Cockpit Sudo Manager\n"
    "# DO NOT EDIT BY HAND\n\n"
)

COMMAND_SOURCES = [
    Path("/usr/share/cockpit/sudo-manager/sudo-commands.d"),
    Path("/etc/cockpit/sudo-manager/commands.local"),
]

# ---------------- Regex ----------------

SUDO_RE = re.compile(
    r"^(?P<user>\S+)\s+ALL=\((?P<runas>[^)]+)\)\s+"
    r"(?P<nopasswd>NOPASSWD:)?\s*(?P<cmds>.+)$"
)

ALIAS_NAME_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")

# ---------------- Helpers ----------------

def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)

def visudo_check(path: Path):
    proc = subprocess.run(
        ["visudo", "-cf", str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    if proc.returncode != 0:
        die(proc.stderr.strip() or "visudo validation failed")

def normalize(cmd: str) -> str:
    return re.sub(r"\s+", " ", cmd.strip())

def load_allowed_commands() -> set[str]:
    """
    Flatten parser output into a set of selectable commands.
    Used for update validation.
    """
    allowed = set()
    catalog = parse_sudo_commands()

    for cat in catalog.values():
        for cmds in cat["command_aliases"].values():
            allowed.update(cmds)
        allowed.update(cat["raw_commands"])

    return allowed

def render_template(user: str, rule_line: str) -> str:
    tpl = TEMPLATE.read_text()
    return (
        tpl.replace("{{USER}}", user)
           .replace("{{DATE}}", datetime.utcnow().isoformat())
           .replace("{{RULE}}", rule_line)
    )

# ---------------- Alias helpers ----------------

def validate_alias(alias_type, name, members):
    if alias_type not in {"User_Alias", "Runas_Alias", "Host_Alias", "Cmnd_Alias"}:
        die("Invalid alias type")

    if not ALIAS_NAME_RE.match(name):
        die("Alias name must be UPPERCASE with underscores")

    if not members:
        die("Alias must contain at least one member")

    if alias_type == "Cmnd_Alias":
        for m in members:
            if not m.startswith("/"):
                die(f"Command must be absolute path: {m}")
            if re.search(r"[;&|$`]|&&|\|\|", m):
                die(f"Unsafe characters in command: {m}")

def render_alias(alias_type, name, members) -> str:
    tpl = ALIAS_TEMPLATE.read_text()
    return (
        tpl.replace("{{ALIAS_TYPE}}", alias_type)
           .replace("{{ALIAS_NAME}}", name)
           .replace("{{ALIAS_MEMBERS}}", ", ".join(members))
    )

def add_alias(alias_type, name, members):
    validate_alias(alias_type, name, members)

    alias_line = render_alias(alias_type, name, members)

    if not ALIAS_FILE.exists():
        content = ALIAS_HEADER + alias_line + "\n"
    else:
        content = ALIAS_FILE.read_text()
        if re.search(rf"^{alias_type}\s+{name}\s*=", content, re.MULTILINE):
            die("Alias already exists")
        content = content.rstrip() + "\n" + alias_line + "\n"

    ALIAS_FILE.write_text(content)
    ALIAS_FILE.chmod(0o440)
    visudo_check(ALIAS_FILE)

# ---------------- CATALOG ----------------

def catalog():
    """
    UI-facing catalog:
    policy-filtered, menu-safe, authoritative.
    """
    data = parse_sudo_commands()
    print(json.dumps(data, indent=2))

# ---------------- LIST ----------------

def list_rules():
    rules = []

    for f in SUDOERS_DIR.iterdir():
        if not f.is_file():
            continue

        try:
            text = f.read_text(errors="ignore")
        except Exception:
            continue

        lines = [l.rstrip() for l in text.splitlines() if l.strip()]

        # ---- Cockpit-managed ----
        if "Managed by Cockpit Sudo Manager" in text:
            user = None
            runas = "root"
            nopasswd = False
            commands = []
            alias_map = {}

            for line in lines:
                if line.startswith("#"):
                    continue
                if line.startswith("Cmnd_Alias"):
                    name, rest = line.split("=", 1)
                    alias = name.split()[1]
                    alias_map[alias] = [
                        normalize(c) for c in rest.replace("\\", "").split(",")
                    ]

            for line in lines:
                if "ALL=(" not in line:
                    continue

                if "NOPASSWD:" in line:
                    nopasswd = True
                    line = line.replace("NOPASSWD:", "").strip()

                parts = line.split()
                user = parts[0]
                raw_runas = parts[2].strip("()")
                runas = "root" if raw_runas == "ALL" else raw_runas

                target = line.split(")", 1)[1].strip()
                if target == "ALL":
                    commands = []
                elif target in alias_map:
                    commands = alias_map[target]
                else:
                    commands = [normalize(c) for c in target.split(",")]

            if user:
                rules.append({
                    "user": user,
                    "runas": runas,
                    "nopasswd": nopasswd,
                    "all": not commands,
                    "commands": commands,
                })
            continue

        # ---- Legacy ----
        for line in lines:
            if line.startswith("#"):
                continue

            m = SUDO_RE.match(line)
            if not m:
                continue

            cmds = m.group("cmds").strip()
            rules.append({
                "user": m.group("user"),
                "runas": "root" if m.group("runas") == "ALL" else m.group("runas"),
                "nopasswd": bool(m.group("nopasswd")),
                "all": cmds == "ALL",
                "commands": [] if cmds == "ALL"
                            else [normalize(c) for c in cmds.split(",")],
            })
            break

    print(json.dumps(rules))

# ---------------- UPDATE ----------------

def update_rule(user, runas, mode, cmds):
    allowed = load_allowed_commands()
    target = SUDOERS_DIR / user
    tmp = target.with_suffix(".tmp")

    nopasswd = "NOPASSWD:" if mode == "nopasswd" else ""

    if cmds == "ALL":
        rule_line = f"{user} ALL=({runas}) {nopasswd} ALL"
    else:
        requested = [normalize(c) for c in cmds.split(",") if c.strip()]
        for c in requested:
            if c not in allowed:
                die(f"Command not allowed by policy: {c}")

        rule_line = f"{user} ALL=({runas}) {nopasswd} " + ", ".join(requested)

    content = render_template(user, rule_line) + "\n"
    tmp.write_text(content)
    tmp.chmod(0o440)
    visudo_check(tmp)
    tmp.replace(target)

# ---------------- DELETE ----------------

def delete_rule(user):
    f = SUDOERS_DIR / user
    if f.exists():
        f.unlink()

# ---------------- MAIN ----------------

def usage():
    die(
        "Usage:\n"
        "  sudo-manager.py list\n"
        "  sudo-manager.py catalog\n"
        "  sudo-manager.py update <user> <runas> <passwd|nopasswd> <cmds|ALL>\n"
        "  sudo-manager.py delete <user>\n"
        "  sudo-manager.py add-alias <type> <name> <member...>"
    )

if len(sys.argv) < 2:
    usage()

try:
    action = sys.argv[1]

    if action == "list":
        list_rules()
    elif action == "catalog":
        catalog()
    elif action == "update" and len(sys.argv) == 6:
        update_rule(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    elif action == "delete" and len(sys.argv) == 3:
        delete_rule(sys.argv[2])
    elif action == "add-alias" and len(sys.argv) >= 5:
        add_alias(sys.argv[2], sys.argv[3], sys.argv[4:])
    else:
        usage()

except subprocess.CalledProcessError:
    die("visudo validation failed")
