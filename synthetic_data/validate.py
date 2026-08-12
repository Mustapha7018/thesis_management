#!/usr/bin/env python3
"""
Validation suite for the synthetic dataset (feeds D3/M4: "distribution/
constraint validation report").

Framing (README §6): because the dataset is rule-based, fidelity-to-real-data
metrics used for data-driven generators (Lautrup et al., 2024) do not apply —
there is no real reference dataset by design. Validation instead demonstrates:

  A. Constraint conformance — every row satisfies the schema's declared
     constraints (formats, ranges, uniqueness, referential integrity).
  B. Structural adequacy   — the instance is a well-posed allocation problem
     (size minimums met, capacity feasible, preference lists complete).
  C. Distributional plausibility — realised distributions match the declared
     design assumptions in config.json (the "documented assumptions" that
     rule-based realism claims rest on, per Tammisto et al., 2025).

Usage:
    python3 validate.py [--db thesis_management.db] [--config config.json]
                        [--report validation_report.md]

Exit code 0 iff all checks pass.
"""

import argparse
import json
import re
import sqlite3
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESULTS = []   # (section, name, passed, detail)


def check(section, name, passed, detail=""):
    RESULTS.append((section, name, bool(passed), detail))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    return passed


def q1(con, sql):
    return con.execute(sql).fetchone()[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(HERE / "thesis_management.db"))
    ap.add_argument("--config", default=str(HERE / "config.json"))
    ap.add_argument("--report", default=str(HERE / "validation_report.md"))
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    # Copy to a local temp file before connecting: SQLite locking can fail on
    # mounted/network filesystems (mirrors the strategy in generate.py).
    import shutil, tempfile
    local_db = Path(tempfile.mkdtemp()) / Path(args.db).name
    shutil.copy(args.db, local_db)
    con = sqlite3.connect(local_db)
    con.execute("PRAGMA foreign_keys = ON")

    n_students = q1(con, "SELECT COUNT(*) FROM students")
    n_sups = q1(con, "SELECT COUNT(*) FROM supervisors")
    pref_len = cfg["preferences"]["list_length"]

    # ---------------- A. Constraint conformance ----------------
    print("A. Constraint conformance")
    check("A", "No foreign-key violations",
          not con.execute("PRAGMA foreign_key_check").fetchall())

    student_email_re = re.compile(
        r"^[a-z][a-z0-9]{%d}@%s$" % (cfg["email"]["student_local_length"] - 1,
                                     re.escape(cfg["email"]["student_domain"])))
    bad = [e for (e,) in con.execute("SELECT email FROM students")
           if not student_email_re.match(e)]
    check("A", "Student email format (6-char alphanumeric local part @student domain)",
          not bad, f"violations: {bad[:3]}" if bad else f"{n_students}/{n_students} conform")

    staff_email_re = re.compile(
        r"^[a-z]+\.[a-z]+[0-9]*@%s$" % re.escape(cfg["email"]["staff_domain"]))
    bad = [e for (e,) in con.execute("SELECT email FROM supervisors")
           if not staff_email_re.match(e)]
    check("A", "Supervisor email format (firstname.lastname@staff domain)",
          not bad, f"violations: {bad[:3]}" if bad else f"{n_sups}/{n_sups} conform")

    check("A", "Student emails unique",
          q1(con, "SELECT COUNT(DISTINCT email) FROM students") == n_students)
    check("A", "Supervisor emails unique",
          q1(con, "SELECT COUNT(DISTINCT email) FROM supervisors") == n_sups)
    check("A", "prior_avg_mark within [40, 90]",
          q1(con, "SELECT COUNT(*) FROM students WHERE prior_avg_mark < 40 OR prior_avg_mark > 90") == 0)
    check("A", "Quotas well-ordered (quota_min <= quota_max)",
          q1(con, "SELECT COUNT(*) FROM supervisors WHERE quota_min > quota_max") == 0)
    check("A", "Preference scores within [0, 1]",
          q1(con, "SELECT COUNT(*) FROM supervisor_preferences WHERE score < 0 OR score > 1") == 0)

    # ---------------- B. Structural adequacy ----------------
    print("B. Structural adequacy (well-posed allocation instance)")
    check("B", f"Cohort size meets O1 minimum (>=200 students): {n_students}",
          n_students >= 200)
    check("B", f"Supervisor pool meets O1 minimum (>=30): {n_sups}", n_sups >= 30)

    cap = q1(con, "SELECT SUM(quota_max) FROM supervisors")
    slack = cap / n_students
    check("B", f"Capacity feasible: sum(quota_max)={cap} vs {n_students} students "
               f"(slack {slack:.2f}x, target >={cfg['workload']['capacity_slack_target']}x)",
          slack >= cfg["workload"]["capacity_slack_target"])

    min_quota_sum = q1(con, "SELECT SUM(quota_min) FROM supervisors")
    check("B", f"sum(quota_min)={min_quota_sum} <= {n_students} students "
               "(minimum loads satisfiable)", min_quota_sum <= n_students)

    complete = q1(con, f"""
        SELECT COUNT(*) FROM (
          SELECT student_id FROM student_preferences
          GROUP BY student_id
          HAVING COUNT(*) = {pref_len}
             AND COUNT(DISTINCT supervisor_id) = {pref_len}
             AND MIN(rank) = 1 AND MAX(rank) = {pref_len}
        )""")
    check("B", f"Every student has a complete preference list "
               f"(exactly {pref_len} distinct supervisors, ranks 1..{pref_len})",
          complete == n_students, f"{complete}/{n_students}")

    covered = q1(con, """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT sp.student_id, sp.supervisor_id
          FROM student_preferences sp
          LEFT JOIN supervisor_preferences svp
            ON svp.student_id = sp.student_id AND svp.supervisor_id = sp.supervisor_id
          WHERE svp.student_id IS NULL
        )""")
    check("B", "Two-sided coverage: every (student, listed supervisor) pair has a "
               "supervisor score", covered == 0)

    extra = q1(con, """
        SELECT COUNT(*) FROM supervisor_preferences svp
        LEFT JOIN student_preferences sp
          ON sp.student_id = svp.student_id AND sp.supervisor_id = svp.supervisor_id
        WHERE sp.student_id IS NULL""")
    check("B", "No supervisor scores for non-applicants (scores restricted to "
               "students who listed them)", extra == 0)

    interests_ok = q1(con, """
        SELECT COUNT(*) FROM (
          SELECT student_id FROM student_interests
          GROUP BY student_id HAVING COUNT(*) BETWEEN 1 AND 3 AND MIN(rank) = 1
        )""")
    students_with_interests = q1(con,
        "SELECT COUNT(DISTINCT student_id) FROM student_interests")
    check("B", "Every student has 1-3 ranked interests starting at rank 1",
          interests_ok == n_students and students_with_interests == n_students)

    expertise_ok = q1(con, """
        SELECT COUNT(*) FROM (
          SELECT supervisor_id FROM supervisor_expertise
          GROUP BY supervisor_id HAVING COUNT(*) BETWEEN 2 AND 4
             AND MAX(proficiency) = 3
        )""")
    check("B", "Every supervisor has 2-4 expertise areas incl. one at proficiency 3",
          expertise_ok == n_sups)

    # ---------------- C. Distributional plausibility ----------------
    print("C. Distributional plausibility (realised vs declared assumptions)")

    ft_share = q1(con, "SELECT AVG(mode = 'FT') FROM students")
    target = cfg["students_attrs"]["mode_ft_share"]
    check("C", f"FT share {ft_share:.3f} within +/-0.06 of declared {target}",
          abs(ft_share - target) <= 0.06)

    rows = con.execute("""
        SELECT entry_qualification, AVG(prior_avg_mark), COUNT(*)
        FROM students GROUP BY entry_qualification""").fetchall()
    ok, details = True, []
    for qual, avg, cnt in rows:
        mean = cfg["students_attrs"]["prior_mark_by_qualification"][qual]["mean"]
        sd = cfg["students_attrs"]["prior_mark_by_qualification"][qual]["sd"]
        tol = 2.5 * sd / max(1, cnt) ** 0.5 + 0.5  # ~99% CI for the mean + rounding
        good = abs(avg - mean) <= tol
        ok &= good
        details.append(f"{qual}: {avg:.1f} vs {mean} (n={cnt})")
    check("C", "Mean prior mark per qualification band near declared means",
          ok, "; ".join(details))

    # Alignment realism: rank-1 choices should align far better than random.
    r1 = con.execute("""
        SELECT AVG(hit) FROM (
          SELECT EXISTS(
            SELECT 1 FROM student_interests si
            JOIN supervisor_expertise se ON se.area_id = si.area_id
            WHERE si.student_id = sp.student_id
              AND se.supervisor_id = sp.supervisor_id) AS hit
          FROM student_preferences sp WHERE sp.rank = 1)""").fetchone()[0]
    rnd = con.execute("""
        SELECT AVG(hit) FROM (
          SELECT EXISTS(
            SELECT 1 FROM student_interests si
            JOIN supervisor_expertise se ON se.area_id = si.area_id
            WHERE si.student_id = s.student_id
              AND se.supervisor_id = sv.supervisor_id) AS hit
          FROM students s CROSS JOIN supervisors sv)""").fetchone()[0]
    check("C", f"Preferences encode alignment: rank-1 interest/expertise overlap "
               f"{r1:.2f} vs {rnd:.2f} under random pairing", r1 > rnd + 0.15)

    # Demand concentration: applications should cluster (popularity), but no
    # supervisor should be unlisted.
    counts = [c for (c,) in con.execute("""
        SELECT COUNT(*) FROM supervisors sv
        LEFT JOIN student_preferences sp ON sp.supervisor_id = sv.supervisor_id
        GROUP BY sv.supervisor_id""")]
    check("C", f"Every supervisor is listed by at least one student "
               f"(min {min(counts)}, max {max(counts)}, sd {statistics.pstdev(counts):.1f})",
          min(counts) >= 1)

    # ---------------- report ----------------
    n_pass = sum(1 for *_, p, _ in [(s, n, p, d) for s, n, p, d in RESULTS] if p)
    total = len(RESULTS)
    all_pass = n_pass == total

    lines = [
        "# Synthetic Dataset — Validation Report",
        "",
        f"Database: `{Path(args.db).name}` · Config: `{Path(args.config).name}` "
        f"(seed {cfg['seed']}) · Students: {n_students} · Supervisors: {n_sups}",
        "",
        f"**Result: {n_pass}/{total} checks passed"
        f"{' — DATASET VALID' if all_pass else ' — FAILURES PRESENT'}**",
        "",
        "Validation strategy: fidelity-to-real-data metrics do not apply to a "
        "rule-based dataset (no real reference data exists by design; see "
        "README §6). Checks instead cover (A) constraint conformance, "
        "(B) structural adequacy of the allocation instance, and "
        "(C) distributional plausibility against the declared assumptions.",
        "",
    ]
    for sec, title in [("A", "A. Constraint conformance"),
                       ("B", "B. Structural adequacy"),
                       ("C", "C. Distributional plausibility")]:
        lines.append(f"## {title}")
        lines.append("")
        lines.append("| Check | Result | Detail |")
        lines.append("|---|---|---|")
        for s, name, p, d in RESULTS:
            if s == sec:
                lines.append(f"| {name} | {'PASS' if p else '**FAIL**'} | {d} |")
        lines.append("")

    Path(args.report).write_text("\n".join(lines), encoding="utf-8")
    print(f"\n{n_pass}/{total} checks passed. Report: {args.report}")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
