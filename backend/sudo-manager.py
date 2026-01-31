#!/usr/bin/env python3
"""
sudo-manager.py

Cockpit Sudo Manager backend entrypoint.

Responsibilities:
- CLI dispatch and argument validation
- Orchestrate policy operations
- Expose JSON-safe output to Cockpit frontend

All policy logic lives in dedicated modules.
"""

import sys
import json

from sudo_rules import (
    list_rules,
    update_rule,
    update_group,
    delete_rule,
)

from sudo_catalog import (
    catalog as command_catalog,
    group_catalog,
)

from sudo_aliases import write_user_alias
from sudo_validate import die

# ---------------- Debug ----------------

print(f"[DEBUG] argv = {sys.argv}", file=sys.stderr)

# ============================================================
# CLI usage
# ============================================================

def usage():
    die(
        "Usage:\n"
        "  sudo-manager.py list\n"
        "  sudo-manager.py catalog\n"
        "  sudo-manager.py group-catalog\n"
        "  sudo-manager.py update <user> <runas> <passwd|nopasswd> <cmds|ALL>\n"
        "  sudo-manager.py update-group <group> <runas> <passwd> <cmds|ALL>\n"
        "  sudo-manager.py delete <user>\n"
        "  sudo-manager.py add-alias User_Alias <name> <members...>\n"
    )

# ============================================================
# Main dispatch
# ============================================================

if len(sys.argv) < 2:
    usage()

action = sys.argv[1]

try:
    if action == "list":
        list_rules()

    elif action == "catalog":
        print(json.dumps(command_catalog(), indent=2))

    elif action == "group-catalog":
        print(json.dumps(group_catalog(), indent=2))

    elif action == "update" and len(sys.argv) == 6:
        update_rule(
            user=sys.argv[2],
            runas=sys.argv[3],
            mode=sys.argv[4],
            cmds=sys.argv[5],
        )

    elif action == "update-group" and len(sys.argv) == 6:
        update_group(
            group=sys.argv[2],
            runas=sys.argv[3],
            mode=sys.argv[4],
            cmds=sys.argv[5],
        )

    elif action == "delete" and len(sys.argv) == 3:
        delete_rule(sys.argv[2])

    elif action == "add-alias" and len(sys.argv) >= 5:
        alias_type = sys.argv[2]
        alias_name = sys.argv[3]
        members    = sys.argv[4:]

        if alias_type != "User_Alias":
            die(f"Unsupported alias type: {alias_type}")

        write_user_alias(alias_name, members)

        print(json.dumps({
            "status": "ok",
            "type": alias_type,
            "alias": alias_name,
            "members": members,
        }))

    else:
        usage()

except Exception as e:
    die(str(e))
