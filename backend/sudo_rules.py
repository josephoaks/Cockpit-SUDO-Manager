import os
import re
import json
from pathlib import Path

from sudo_aliases import compile_aliases, load_allowed_commands
from sudo_templates import render_template
from sudo_validate import die, normalize, visudo_check
from sudo_paths import SUDOERS_DIR

# ============================================================
# Rule parsing
# ============================================================

SUDO_RE = re.compile(
    r"^(?P<user>\S+)\s+ALL=\((?P<runas>[^)]+)\)\s+"
    r"(?P<options>(?:[A-Z_,]+:)?)\s*(?P<cmds>.+)$"
)

# ============================================================
# Helpers
# ============================================================

def render_sudo_options(opts: dict) -> str:
    """
    Convert structured options into sudoers option prefix.
    """
    mapping = {
        "nopasswd": "NOPASSWD",
        "noexec": "NOEXEC",
        "setenv": "SETENV",
        "log_input": "LOG_INPUT",
        "log_output": "LOG_OUTPUT",
    }

    enabled = [
        mapping[k]
        for k, v in opts.items()
        if v and k in mapping
    ]

    return ",".join(enabled)


# ============================================================
# List rules
# ============================================================

def list_rules():
    rules = []

    for f in SUDOERS_DIR.iterdir():
        if not f.is_file():
            continue

        try:
            text = f.read_text(errors="ignore")
        except Exception:
            continue

        effective_match = None

        for line in text.splitlines():
            line = line.strip()

            if not line or line.startswith("#"):
                continue

            m = SUDO_RE.match(line)
            if not m:
                continue

            cmds = m.group("cmds").strip()

            # Skip guardrail / neutralization rules
            if cmds == "!ALL":
                continue

            effective_match = m

        if not effective_match:
            continue

        opts_raw = effective_match.group("options") or ""
        opts = {
            "nopasswd": "NOPASSWD" in opts_raw,
            "noexec": "NOEXEC" in opts_raw,
            "setenv": "SETENV" in opts_raw,
            "log_input": "LOG_INPUT" in opts_raw,
            "log_output": "LOG_OUTPUT" in opts_raw,
        }

        cmds = effective_match.group("cmds").strip()

        rules.append({
            "user": effective_match.group("user"),
            "runas": (
                "root"
                if effective_match.group("runas") == "ALL"
                else effective_match.group("runas")
            ),
            "options": opts,
            "all": cmds == "ALL",
            "commands": (
                []
                if cmds == "ALL"
                else [normalize(c) for c in cmds.split(",")]
            ),
        })

    print(json.dumps(rules))


# ============================================================
# Update user rule
# ============================================================

def update_rule(user: str, runas: str, mode: str, cmds: str):
    """
    NOTE:
    - CLI still passes `mode` as passwd|nopasswd
    - Additional options can be injected later without changing rendering
    """

    compile_aliases()

    allowed = load_allowed_commands()
    target = SUDOERS_DIR / user
    tmp = target.with_suffix(".tmp")

    # Base options from legacy CLI
    options = {
        "nopasswd": mode == "nopasswd",
        "noexec": False,
        "setenv": False,
        "log_input": False,
        "log_output": False,
    }

    opt_str = render_sudo_options(options)
    opt_prefix = f"{opt_str}:" if opt_str else ""

    if cmds == "ALL":
        rule_line = f"{user} ALL=({runas}) {opt_prefix} ALL"
    else:
        requested = [normalize(c) for c in cmds.split(",") if c.strip()]
        for c in requested:
            if c not in allowed:
                die(f"Command not allowed by policy: {c}")

        rule_line = (
            f"{user} ALL=({runas}) {opt_prefix} "
            + ", ".join(requested)
        )

    content = render_template(user, rule_line) + "\n"

    tmp.write_text(content)
    os.chown(tmp, 0, 0)
    os.chmod(tmp, 0o440)

    visudo_check(tmp)
    tmp.replace(target)


# ============================================================
# Update group rule
# ============================================================

def update_group(group: str, runas: str, mode: str, cmds: str):
    compile_aliases()

    if mode == "nopasswd":
        die("NOPASSWD not permitted for group rules")

    target = SUDOERS_DIR / "10-group-system"

    if cmds == "ALL":
        rule_line = f"%{group} ALL=({runas}) ALL"
    else:
        rule_line = f"%{group} ALL=({runas}) {cmds}"

    if not target.exists():
        target.write_text(
            "# Managed by Cockpit Sudo Manager\n"
            "# DO NOT EDIT BY HAND\n\n"
            f"{rule_line}\n"
        )
    else:
        with target.open("a") as f:
            f.write(rule_line + "\n")

    os.chown(target, 0, 0)
    os.chmod(target, 0o440)

    visudo_check(target)


# ============================================================
# Delete rule
# ============================================================

def delete_rule(user: str):
    f = SUDOERS_DIR / user
    if f.exists():
        f.unlink()
