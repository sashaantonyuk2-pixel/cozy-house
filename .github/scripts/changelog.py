"""Adds CHANGELOG.md entries for pushed commits that did not update the changelog themselves."""
import os
import subprocess

CHANGELOG = "CHANGELOG.md"
MARKER = "<!-- NEW ENTRIES BELOW -->"
REPO_URL = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}"


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True,
                          env={**os.environ, "TZ": "Europe/Kyiv"}).stdout.strip()


def commits_in_push():
    before, after = os.environ.get("BEFORE", ""), os.environ["AFTER"]
    if not before or set(before) == {"0"}:
        return [after]
    try:
        out = git("rev-list", "--reverse", "--no-merges", f"{before}..{after}")
    except subprocess.CalledProcessError:
        return [after]
    return [c for c in out.splitlines() if c]


def entry(sha):
    files = [f for f in git("show", "--name-only", "--format=", sha).splitlines() if f]
    if CHANGELOG in files:  # already documented by hand
        return None
    date = git("show", "-s", "--date=format-local:%d.%m.%Y", "--format=%ad", sha)
    subject = git("show", "-s", "--format=%s", sha)
    body = git("show", "-s", "--format=%b", sha)
    body_lines = [l for l in body.splitlines() if l.strip() and not l.lower().startswith(("co-authored-by:", "signed-off-by:", "claude-session:"))]
    lines = [f"### {date} — {subject} (авто)"]
    lines += [f"- {l.strip().lstrip('-* ').strip()}" for l in body_lines]
    if files:
        lines.append("- Змінені файли: " + ", ".join(f"`{f}`" for f in files))
    lines.append(f"- Коміт: [{sha[:7]}]({REPO_URL}/commit/{sha})")
    return "\n".join(lines)


def main():
    entries = [e for e in (entry(c) for c in commits_in_push()) if e]
    if not entries:
        print("Nothing to add.")
        return
    text = open(CHANGELOG, encoding="utf-8").read() if os.path.exists(CHANGELOG) else f"# Журнал змін\n\n{MARKER}\n"
    if MARKER not in text:
        text = text.rstrip() + f"\n\n{MARKER}\n"
    new = "\n\n".join(reversed(entries))  # newest first
    text = text.replace(MARKER, f"{MARKER}\n\n{new}", 1)
    open(CHANGELOG, "w", encoding="utf-8").write(text.replace("\n\n\n", "\n\n"))
    print(f"Added {len(entries)} entr(y/ies).")


if __name__ == "__main__":
    main()
