#!/usr/bin/env python3
import sys
import json
import subprocess
import re
from pathlib import Path
from datetime import datetime, timezone

# ------------- Trouble Shooting --------
print(f"[DEBUG] argv = {sys.argv}", file=sys.stderr)


# ---------------- Paths ----------------

SUDOERS_DIR = Path("/etc/sudoers.d")

APP_BASE = Path("/usr/share/cockpit/sudo-manager")
TEMPLATE = APP_BASE / "templates/user.sudoers.tpl"

COMMAND_SOURCES = [
    Path("/usr/share/cockpit/sudo-manager/sudo-commands.d"),
    Path("/etc/cockpit/sudo-manager/commands.local"),
]

# ---------------- Regex ----------------

SUDO_RE = re.compile(
    r"^(?P<user>\S+)\s+ALL=\((?P<runas>[^)]+)\)\s+"
    r"(?P<nopasswd>NOPASSWD:)?\s*(?P<cmds>.+)$"
)

# ---------------- Helpers ----------------

def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)

def visudo_check(path):
    subprocess.run(["visudo", "-cf", str(path)], check=True)

def normalize(cmd):
    return re.sub(r"\s+", " ", cmd.strip())

def load_allowed_commands():
    cmds = set()
    for src in COMMAND_SOURCES:
        if src.is_dir():
            for f in src.glob("*"):
                cmds.update(
                    normalize(c)
                    for c in f.read_text().splitlines()
                    if c.strip()
                )
        elif src.exists():
            cmds.update(
                normalize(c)
                for c in src.read_text().splitlines()
                if c.strip()
            )
    return cmds

def render_template(user, rule_line):
    tpl = TEMPLATE.read_text()
    return (
        tpl.replace("{{USER}}", user)
           .replace("{{DATE}}", datetime.utcnow().isoformat())
           .replace("{{RULE}}", rule_line)
    )

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

        # ---- MODE 1: Cockpit-managed structured ----
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
                    cmds = rest.replace("\\", "").strip()
                    alias_map[alias] = [normalize(c) for c in cmds.split(",")]

            for line in lines:
                if line.startswith("#"):
                    continue

                if "ALL=(" in line:
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

        # ---- MODE 2: legacy single-line ----
        for line in lines:
            if line.startswith("#"):
                continue

            m = SUDO_RE.match(line)
            if not m:
                continue

            raw_runas = m.group("runas")
            runas = "root" if raw_runas == "ALL" else raw_runas
            cmds = m.group("cmds").strip()

            rules.append({
                "user": m.group("user"),
                "runas": runas,
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
        if not cmds.strip():
            die("At least one command is required unless ALL is selected")

        requested = [normalize(c) for c in cmds.split(",") if c.strip()]

        for c in requested:
            if c not in allowed:
                die(f"Command not allowed: {c}")

        rule_line = (
            f"{user} ALL=({runas}) {nopasswd} " +
            ", ".join(requested)
        )

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
        "  sudo-manager.py update <user> <runas> <passwd|nopasswd> <cmds|ALL>\n"
        "  sudo-manager.py delete <user>"
    )

if len(sys.argv) < 2:
    usage()

try:
    action = sys.argv[1]

    if action == "list":
        list_rules()

    elif action == "update" and len(sys.argv) == 6:
        update_rule(
            user=sys.argv[2],
            runas=sys.argv[3],
            mode=sys.argv[4],
            cmds=sys.argv[5],
        )

    elif action == "delete" and len(sys.argv) == 3:
        delete_rule(sys.argv[2])

    else:
        usage()

except subprocess.CalledProcessError:
    die("visudo validation failed")
