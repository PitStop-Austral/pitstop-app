#!/usr/bin/env python3
"""Cheap staged-diff gate for sync-project-docs.

Outputs exactly one line beginning with SKIP or REVIEW.
It intentionally eliminates only obvious no-doc cases; uncertain source/config
changes go to REVIEW for the cheapest possible semantic pass.
"""

from pathlib import PurePosixPath
import subprocess
import sys


def git(*args):
    return subprocess.run(
        ["git", *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def normalize(path):
    return path.replace("\\", "/").lstrip("./")


def is_docs(path):
    p = normalize(path)
    return p == "docs" or p.startswith("docs/")


def is_test(path):
    p = normalize(path).lower()
    pp = PurePosixPath(p)
    name = pp.name
    parts = set(pp.parts)
    return (
        bool(parts & {"test", "tests", "__tests__"})
        or name.startswith("test_")
        or name.endswith("_test.py")
        or name.endswith((
            ".test.js", ".test.jsx", ".test.ts", ".test.tsx",
            ".spec.js", ".spec.jsx", ".spec.ts", ".spec.tsx", ".snap",
        ))
    )


def is_lockfile(path):
    return PurePosixPath(normalize(path)).name.lower() in {
        "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml",
        "yarn.lock", "bun.lock", "bun.lockb", "poetry.lock",
        "pipfile.lock", "uv.lock", "cargo.lock", "gemfile.lock",
        "composer.lock",
    }


def is_generated_noise(path):
    pp = PurePosixPath(normalize(path).lower())
    if set(pp.parts) & {
        "dist", "build", "coverage", ".next", "out", "target",
        "generated", "vendor", "node_modules",
    }:
        return True
    if pp.name == ".ds_store":
        return True
    return pp.name.endswith((".map", ".min.js", ".min.css"))


def main():
    root = git("rev-parse", "--show-toplevel")
    if root.returncode != 0:
        print("SKIP not_git_repo")
        return 0

    changed = git("diff", "--cached", "--name-only", "--diff-filter=ACMRDTUXB")
    if changed.returncode != 0:
        print("REVIEW git_diff_failed")
        return 0

    paths = [normalize(x.strip()) for x in changed.stdout.splitlines() if x.strip()]
    if not paths:
        print("SKIP no_staged_changes")
        return 0

    non_docs = [p for p in paths if not is_docs(p)]
    if not non_docs:
        print("SKIP docs_only")
        return 0

    meaningful = [
        p for p in non_docs
        if not is_test(p)
        and not is_lockfile(p)
        and not is_generated_noise(p)
    ]

    if not meaningful:
        print("SKIP tests_lockfiles_or_generated_only")
        return 0

    print(f"REVIEW meaningful_staged_changes={len(meaningful)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
