#!/usr/bin/env python3
"""Run the auto-grill answerer over the eval cases and grade the Status labels.

Usage:
  export AUTO_GRILL_COMMAND='llm-wrapper --read-only'
  evals/run.py                  # every case, once
  evals/run.py -n 3             # every case, 3 runs each
  evals/run.py 002-chat-edges    # selected cases under evals/cases/
  evals/run.py --command 'llm-wrapper --read-only'  # override the environment

Supply a CLI or adapter for your runtime/provider. It must read the prompt from
stdin, emit only the answer as Markdown on stdout, and use cwd for repository
reads. Configure its model and permissions in the command or adapter: allow
repository reads and web research, deny writes and further delegation, and disable
session persistence and unrelated integrations. No provider or model is assumed.
The command is split into arguments, not executed through a shell.

A case is a folder under evals/cases/:
  handoff.md    what /auto-grill handed the answerer (text after "=== HANDOFF ===")
  expected.md   one line per question: "Q<n>: ANSWERED | JUDGEMENT | any  # why"
  feedback.md   the user's words about what went wrong (read by /auto-grill-improve, not graded)
  answers.md    optional: the answers that prompted the case
  context/      snapshot of GLOSSARY.md (legacy CONTEXT.md also works) and docs/adr/;
                the answerer runs with this as its cwd

Outputs go to evals/results/<timestamp>/<case>/run<k>.md, and a summary is printed.
Exit code is 0 only when every graded label matches in every run.
"""

import argparse
import concurrent.futures as cf
import datetime as dt
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
CASES = SKILL / "evals" / "cases"
RESULTS = SKILL / "evals" / "results"

EVAL_NOTE = (
    "\n\n(Eval mode: the repo is snapshotted in the current directory, which holds only its "
    "GLOSSARY.md (CONTEXT.md in older snapshots) and docs/adr/. "
    "Ignore any repo path in the handoff and read files here. "
    "Code facts you'd normally look up are in the handoff.)\n"
)


def parse_expected(path: Path) -> dict[int, str]:
    out = {}
    for line in path.read_text().splitlines():
        m = re.match(r"\s*Q(\d+)\s*:\s*(ANSWERED|JUDGEMENT|any)\b", line)
        if m:
            out[int(m.group(1))] = m.group(2)
    return out


def parse_statuses(text: str) -> dict[int, str]:
    out, current = {}, None
    for line in text.splitlines():
        if m := re.match(r"\s*#+\s*Q(\d+)\b", line):
            current = int(m.group(1))
        elif current is not None and (m := re.match(r"\s*Status:\s*\**\s*(ANSWERED|JUDGEMENT)", line)):
            out.setdefault(current, m.group(1))
    return out


def run_once(case: Path, prompt: str, out: Path, command: list[str]) -> str:
    with tempfile.TemporaryDirectory(prefix=f"auto-grill-{case.name}-") as tmp:
        if (case / "context").is_dir():
            shutil.copytree(case / "context", tmp, dirs_exist_ok=True)
        proc = subprocess.run(
            command,
            input=prompt, cwd=tmp, capture_output=True, text=True, timeout=900,
        )
    text = proc.stdout if proc.returncode == 0 else f"ERROR {proc.returncode}\n{proc.stderr}\n{proc.stdout}"
    out.write_text(text)
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("cases", nargs="*")
    ap.add_argument("-n", type=int, default=1, help="runs per case")
    ap.add_argument("--command", default=os.environ.get("AUTO_GRILL_COMMAND"),
                    help="CLI/adapter command; prompt on stdin, Markdown on stdout (or AUTO_GRILL_COMMAND)")
    args = ap.parse_args()
    if not args.command:
        ap.error("set --command or AUTO_GRILL_COMMAND to a read-only CLI/adapter")
    try:
        command = shlex.split(args.command)
    except ValueError as exc:
        ap.error(f"invalid command: {exc}")
    if not command:
        ap.error("command must not be empty")

    cases = [CASES / c for c in args.cases] if args.cases else sorted(p for p in CASES.iterdir() if p.is_dir())
    answerer = (SKILL / "ANSWERER.md").read_text()
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    outdir = RESULTS / stamp

    jobs = {}
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        for case in cases:
            (outdir / case.name).mkdir(parents=True, exist_ok=True)
            prompt = answerer + "\n=== HANDOFF ===\n" + (case / "handoff.md").read_text() + EVAL_NOTE
            for k in range(1, args.n + 1):
                jobs[pool.submit(run_once, case, prompt, outdir / case.name / f"run{k}.md", command)] = (case, k)
        texts = {jobs[f]: f.result() for f in cf.as_completed(jobs)}

    ok_all, total, passed = True, 0, 0
    for case in cases:
        expected = parse_expected(case / "expected.md")
        print(f"\n{case.name}")
        for q, want in sorted(expected.items()):
            got = [parse_statuses(texts[(case, k)]).get(q, "MISSING") for k in range(1, args.n + 1)]
            if want == "any":
                print(f"  Q{q:<3} want any        got {' '.join(got)}")
                continue
            hits = sum(g == want for g in got)
            total += args.n
            passed += hits
            mark = "ok " if hits == args.n else "FAIL"
            ok_all &= hits == args.n
            print(f"  Q{q:<3} want {want:<9}  got {' '.join(got):<30} {mark}")
    print(f"\n{passed}/{total} graded labels match. Outputs: {outdir}")
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
