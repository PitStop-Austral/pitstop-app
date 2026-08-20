#!/usr/bin/env python3
"""Token-cheap executor for start-stack's verified STACK_STARTUP.md recipe.

Always exits 0 so Claude can fall back to recovery/discovery. It prints exactly one
short status line. No repository analysis is performed here.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path

MARKER_RE = re.compile(r"<!--\s*START_STACK_V2\s*(\{.*?\})\s*-->", re.DOTALL)
DANGEROUS = [
    re.compile(r"(^|[;&|]\s*)sudo\b", re.I),
    re.compile(r"\brm\s+-[^\n]*r[^\n]*f\b", re.I),
    re.compile(r"docker\s+(?:compose\s+)?down\b[^\n]*\s-v(?:\s|$)", re.I),
    re.compile(r"docker\s+volume\s+(?:rm|prune)\b", re.I),
    re.compile(r"\bdrop\s+(?:database|schema|table)\b", re.I),
    re.compile(r"\b(?:prisma\s+migrate\s+reset|rails\s+db:drop|git\s+clean\s+-[^\n]*f)\b", re.I),
]


def emit(kind: str, **fields: object) -> None:
    parts = [kind]
    for key, value in fields.items():
        if value is None or value == "" or value == []:
            continue
        if isinstance(value, list):
            value = ",".join(str(v) for v in value)
        text = str(value).replace("\n", " ").replace("\r", " ")
        parts.append(f"{key}={shlex.quote(text[:500])}")
    print(" ".join(parts))


def cache_dir(repo: Path) -> Path:
    digest = hashlib.sha256(str(repo).encode()).hexdigest()[:16]
    root = Path.home() / ".cache" / "start-stack" / digest
    (root / "logs").mkdir(parents=True, exist_ok=True)
    (root / "pids").mkdir(parents=True, exist_ok=True)
    return root


def validate_command(command: str) -> bool:
    return bool(command.strip()) and not any(p.search(command) for p in DANGEROUS)


def resolve_cwd(repo: Path, rel: str) -> Path | None:
    try:
        target = (repo / rel).resolve()
        target.relative_to(repo.resolve())
    except (ValueError, OSError):
        return None
    return target if target.is_dir() else None


def run_shell(command: str, cwd: Path, timeout: int, log: Path | None = None) -> int:
    kwargs = dict(cwd=str(cwd), shell=True, timeout=timeout)
    if log:
        with log.open("ab", buffering=0) as fh:
            proc = subprocess.run(command, stdout=fh, stderr=subprocess.STDOUT, **kwargs)
    else:
        proc = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kwargs)
    return proc.returncode


def verify_all(checks: list[str], cwd: Path, timeout_each: int = 8) -> bool:
    if not checks:
        return False
    for check in checks:
        if not validate_command(check):
            return False
        try:
            if run_shell(check, cwd, timeout_each) != 0:
                return False
        except (subprocess.TimeoutExpired, OSError):
            return False
    return True


def pid_alive(pid_file: Path) -> bool:
    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, 0)
        return True
    except (ValueError, OSError, ProcessLookupError):
        return False


def start_background(command: str, cwd: Path, log: Path, pid_file: Path) -> tuple[bool, str]:
    if pid_alive(pid_file):
        return False, "existing_process_unhealthy"
    try:
        pid_file.unlink(missing_ok=True)
        fh = log.open("ab", buffering=0)
        proc = subprocess.Popen(
            command,
            cwd=str(cwd),
            shell=True,
            stdout=fh,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
        fh.close()
        pid_file.write_text(str(proc.pid))
        return True, ""
    except OSError:
        return False, "spawn_failed"


def load_manifest(path: Path) -> dict | None:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    match = MARKER_RE.search(text)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) and data.get("version") == 2 else None


def main() -> None:
    repo = Path(sys.argv[1] if len(sys.argv) > 1 else os.getcwd()).expanduser().resolve()
    manifest_path = repo / "STACK_STARTUP.md"
    if not manifest_path.is_file():
        emit("FAST_PATH_MISS", reason="no_manifest")
        return

    data = load_manifest(manifest_path)
    if data is None:
        emit("FAST_PATH_MISS", reason="legacy_manifest")
        return

    steps = data.get("steps")
    urls = data.get("urls", [])
    if not isinstance(steps, list) or not (1 <= len(steps) <= 32):
        emit("FAST_PATH_FAIL", reason="invalid_manifest")
        return
    if not isinstance(urls, list):
        urls = []

    cache = cache_dir(repo)
    started: list[str] = []
    reused: list[str] = []

    for index, step in enumerate(steps):
        if not isinstance(step, dict):
            emit("FAST_PATH_FAIL", reason="invalid_step", step=index)
            return
        name = str(step.get("name") or f"step-{index+1}")
        rel_cwd = str(step.get("cwd", "."))
        mode = str(step.get("mode", "background"))
        start = step.get("start")
        verify = step.get("verify")
        timeout = step.get("timeout", 45)

        if isinstance(verify, str):
            verify = [verify]
        if not isinstance(verify, list) or not all(isinstance(v, str) for v in verify):
            emit("FAST_PATH_FAIL", reason="invalid_verify", service=name)
            return
        if not isinstance(start, str) or not validate_command(start):
            emit("FAST_PATH_FAIL", reason="unsafe_or_invalid_start", service=name)
            return
        if mode not in {"background", "oneshot"}:
            emit("FAST_PATH_FAIL", reason="invalid_mode", service=name)
            return
        try:
            timeout = max(1, min(int(timeout), 180))
        except (TypeError, ValueError):
            timeout = 45

        cwd = resolve_cwd(repo, rel_cwd)
        if cwd is None:
            emit("FAST_PATH_FAIL", reason="missing_cwd", service=name, cwd=rel_cwd)
            return

        if verify_all(verify, cwd):
            reused.append(name)
            continue

        safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", name)[:80]
        log = cache / "logs" / f"{safe_name}.log"
        pid_file = cache / "pids" / f"{safe_name}.pid"

        if mode == "background":
            ok, reason = start_background(start, cwd, log, pid_file)
            if not ok:
                emit("FAST_PATH_FAIL", reason=reason, service=name, log=log)
                return
        else:
            try:
                code = run_shell(start, cwd, timeout, log)
            except subprocess.TimeoutExpired:
                emit("FAST_PATH_FAIL", reason="start_timeout", service=name, log=log)
                return
            except OSError:
                emit("FAST_PATH_FAIL", reason="start_failed", service=name, log=log)
                return
            if code != 0:
                emit("FAST_PATH_FAIL", reason="start_nonzero", service=name, log=log)
                return

        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if verify_all(verify, cwd):
                started.append(name)
                break
            if mode == "background" and not pid_alive(pid_file):
                emit("FAST_PATH_FAIL", reason="process_exited", service=name, log=log)
                return
            time.sleep(1)
        else:
            emit("FAST_PATH_FAIL", reason="verify_timeout", service=name, log=log)
            return

    emit("FAST_PATH_OK", started=started, reused=reused, urls=[str(u) for u in urls])


if __name__ == "__main__":
    main()
