import os
from sudo_parser import parse_sudo_commands
from sudo_paths import (
    ALIAS_OUT, ALIAS_HEADER, ALIAS_NAME_RE
)
from sudo_validate import die, normalize, visudo_check


# ============================================================
# Command Alias Compiler (EXISTING BEHAVIOR - UNCHANGED)
# ============================================================

def compile_aliases():
    catalog = parse_sudo_commands()
    lines = [ALIAS_HEADER.rstrip()]

    for cat in catalog.values():
        for name, members in cat["command_aliases"].items():
            if not ALIAS_NAME_RE.match(name):
                die(f"Invalid alias name: {name}")

            if not members:
                continue

            lines.append(
                f"Cmnd_Alias {name} = " +
                ", ".join(normalize(m) for m in members)
            )

    content = "\n".join(lines) + "\n"

    tmp = ALIAS_OUT.with_suffix(".tmp")
    tmp.write_text(content)
    os.chown(tmp, 0, 0)
    os.chmod(tmp, 0o440)
    visudo_check(tmp)
    tmp.replace(ALIAS_OUT)


# ============================================================
# User_Alias Writer (NEW – UI-MANAGED)
# ============================================================

def write_user_alias(name: str, members: list[str]):
    alias = name.upper()

    if not ALIAS_NAME_RE.match(name):
        die(f"Invalid User_Alias name: {name}")

    if not members:
        die("User_Alias must have at least one member")

    lines = [
        ALIAS_HEADER.rstrip(),
        f"User_Alias {name} = " +
        ", ".join(normalize(m) for m in members),
        ""
    ]

    content = "\n".join(lines)

    tmp = ALIAS_OUT.with_suffix(".tmp")
    tmp.write_text(content)
    os.chown(tmp, 0, 0)
    os.chmod(tmp, 0o440)
    visudo_check(tmp)
    tmp.replace(ALIAS_OUT)


# ============================================================
# Helpers
# ============================================================

def load_allowed_commands() -> set[str]:
    catalog = parse_sudo_commands()
    allowed = set()

    for cat in catalog.values():
        allowed.update(cat["command_aliases"].keys())

    return allowed
