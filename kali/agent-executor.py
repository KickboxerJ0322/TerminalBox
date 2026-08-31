#!/usr/bin/env python3
"""Execute a pre-parsed TerminalBox Agent plan without invoking a shell."""

import base64
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time

MAX_OUTPUT = 65536
MAX_SEQUENCE = 12
MAX_PIPELINE = 8
children = []


def stop_children(_signum=None, _frame=None):
    for child in children:
        try:
            child.kill()
        except ProcessLookupError:
            pass


signal.signal(signal.SIGTERM, stop_children)
signal.signal(signal.SIGINT, stop_children)


def decode_plan(value):
    raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    plan = json.loads(raw.decode("utf-8"))
    sequence = plan.get("sequence")
    if not isinstance(sequence, list) or not 1 <= len(sequence) <= MAX_SEQUENCE:
        raise ValueError("invalid sequence")
    return sequence


def validate_command(item):
    argv = item.get("argv")
    redirects = item.get("redirects", [])
    if not isinstance(argv, list) or not argv or len(argv) > 128:
        raise ValueError("invalid argv")
    if any(not isinstance(value, str) or not value or len(value) > 4096 for value in argv):
        raise ValueError("invalid argument")
    if not isinstance(redirects, list) or len(redirects) > 3:
        raise ValueError("invalid redirects")
    return argv, redirects


def harden_argv(argv):
    command = argv[0].split('/')[-1]
    if command == "curl":
        return [argv[0], "-q", *argv[1:]]
    if command == "git":
        for index, argument in enumerate(argv[1:], 1):
            if not argument.startswith("-"):
                if argument in {"diff", "log", "show"}:
                    return [*argv[:index + 1], "--no-ext-diff", "--no-textconv", *argv[index + 1:]]
                break
    return argv


def open_redirects(redirects):
    stdin_handle = None
    stdout_handle = None
    stderr_handle = None
    opened = []
    for redirect in redirects:
        operator = redirect.get("operator")
        target = redirect.get("target")
        if operator not in {">", ">>", "<", "1>", "1>>", "2>", "2>>"} or not isinstance(target, str):
            raise ValueError("invalid redirection")
        if operator == "<":
            handle = open(target, "rb")
            stdin_handle = handle
        else:
            handle = open(target, "ab" if operator.endswith(">>") else "wb")
            if operator.startswith("2"):
                stderr_handle = handle
            else:
                stdout_handle = handle
        opened.append(handle)
    return stdin_handle, stdout_handle, stderr_handle, opened


def builtin_type(argv, redirects):
    lines = []
    exit_code = 0
    for name in argv[1:]:
        location = shutil.which(name)
        if location:
            lines.append(f"{name} is {location}")
        else:
            lines.append(f"type: {name}: not found")
            exit_code = 1
    stdout = ("\n".join(lines) + ("\n" if lines else "")).encode()
    stdin_handle, stdout_handle, stderr_handle, opened = open_redirects(redirects)
    try:
        if stdout_handle is not None:
            stdout_handle.write(stdout)
            stdout = b""
        return stdout, b"", exit_code
    finally:
        for handle in opened:
            handle.close()


def run_pipeline(items):
    processes = []
    opened = []
    previous_stdout = None
    captured_stdout = b""
    captured_stderr = b""
    try:
        if len(items) == 1 and items[0].get("argv", [""])[0].split("/")[-1] == "type":
            argv, redirects = validate_command(items[0])
            return builtin_type(argv, redirects)
        for index, item in enumerate(items):
            argv, redirects = validate_command(item)
            argv = harden_argv(argv)
            redirect_in, redirect_out, redirect_err, handles = open_redirects(redirects)
            opened.extend(handles)
            stdin = redirect_in if redirect_in is not None else previous_stdout
            is_last = index == len(items) - 1
            stdout_capture = tempfile.TemporaryFile() if is_last and redirect_out is None else None
            stderr_capture = tempfile.TemporaryFile() if redirect_err is None else None
            if stdout_capture is not None:
                opened.append(stdout_capture)
            if stderr_capture is not None:
                opened.append(stderr_capture)
            stdout = redirect_out if redirect_out is not None else (stdout_capture if is_last else subprocess.PIPE)
            stderr = redirect_err if redirect_err is not None else stderr_capture
            child = subprocess.Popen(argv, stdin=stdin, stdout=stdout, stderr=stderr, cwd="/home/student")
            children.append(child)
            if previous_stdout is not None:
                previous_stdout.close()
            previous_stdout = child.stdout if not is_last and redirect_out is None else None
            processes.append((child, stdout_capture, stderr_capture))

        final = processes[-1][0]
        final.wait()
        for child, stdout_capture, stderr_capture in processes[:-1]:
            child.wait()
        for _child, stdout_capture, stderr_capture in processes:
            if stdout_capture is not None:
                stdout_capture.seek(0)
                captured_stdout += stdout_capture.read(MAX_OUTPUT + 1)
            if stderr_capture is not None:
                stderr_capture.seek(0)
                captured_stderr += stderr_capture.read(MAX_OUTPUT + 1)
        return captured_stdout[:MAX_OUTPUT], captured_stderr[:MAX_OUTPUT], final.returncode
    finally:
        for handle in opened:
            handle.close()
        for child, *_rest in processes:
            if child in children:
                children.remove(child)


def main():
    if len(sys.argv) != 2:
        raise ValueError("one encoded plan is required")
    sequence = decode_plan(sys.argv[1])
    stdout_parts = []
    stderr_parts = []
    last_exit = 0
    started = time.monotonic()
    executed = 0
    for entry in sequence:
        connector = entry.get("connector")
        pipeline = entry.get("pipeline")
        if connector not in {None, ";", "&&", "||"}:
            raise ValueError("invalid connector")
        if not isinstance(pipeline, list) or not 1 <= len(pipeline) <= MAX_PIPELINE:
            raise ValueError("invalid pipeline")
        if connector == "&&" and last_exit != 0:
            continue
        if connector == "||" and last_exit == 0:
            continue
        out, err, last_exit = run_pipeline(pipeline)
        stdout_parts.append(out)
        stderr_parts.append(err)
        executed += 1
    result = {
        "stdout": b"".join(stdout_parts)[:MAX_OUTPUT].decode("utf-8", "replace"),
        "stderr": b"".join(stderr_parts)[:MAX_OUTPUT].decode("utf-8", "replace"),
        "exitCode": last_exit,
        "durationMs": round((time.monotonic() - started) * 1000),
        "executed": executed,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(125)
