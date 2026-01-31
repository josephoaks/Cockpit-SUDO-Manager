from datetime import datetime
from sudo_paths import TEMPLATE

def render_template(user: str, rule_line: str) -> str:
    tpl = TEMPLATE.read_text()
    return (
        tpl.replace("{{USER}}", user)
           .replace("{{DATE}}", datetime.utcnow().isoformat())
           .replace("{{RULE}}", rule_line)
    )
