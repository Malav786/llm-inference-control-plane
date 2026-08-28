#!/usr/bin/env bash
if command -v uv &>/dev/null; then
    uv run python python_core/test_runner.py "$@"
elif command -v python3 &>/dev/null; then
    python3 python_core/test_runner.py "$@"
elif command -v py &>/dev/null; then
    py python_core/test_runner.py "$@"
else
    python python_core/test_runner.py "$@"
fi

