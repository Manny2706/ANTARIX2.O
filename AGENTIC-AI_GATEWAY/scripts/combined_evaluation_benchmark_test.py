#!/usr/bin/env python3
"""Launcher alias for 'Combined Evaluation Benchmark test.py'.

Enables running either:
    python scripts/combined_evaluation_benchmark_test.py
or:
    python "scripts/Combined Evaluation Benchmark test.py"
"""

import runpy
from pathlib import Path

target_file = Path(__file__).parent / "Combined Evaluation Benchmark test.py"

if __name__ == "__main__":
    runpy.run_path(str(target_file), run_name="__main__")
