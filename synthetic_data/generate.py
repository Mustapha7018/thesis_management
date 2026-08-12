#!/usr/bin/env python3
"""
Rule-based synthetic data generator for the Thesis Management Platform (O1).

Design (see README.md for full rationale and literature grounding):
  * Schema-first, rule-based, parametric generation (Tammisto et al., 2025):
    no real seed data is used anywhere; every distribution and dependency is
    declared explicitly in config.json or in the rules below.
  * Deterministic: one seed drives a single random.Random instance, so the
    same config always yields byte-identical output (required for reproducible
    GA benchmarking, O6).
  * Dependency-aware: student interests depend on programme; student
    preference lists depend on interest/expertise alignment; supervisor
    scores depend on alignment and prior attainment. This is what separates
    the generator from context-free fakers (see README §5).
  * Stdlib-only: no third-party dependencies; runs anywhere Python 3.9+ runs.

Usage:
    python3 generate.py [--config config.json] [--outdir data]

Outputs: one CSV per populated table in --outdir, plus thesis_management.db
(SQLite) built from schema.sql and the generated rows.
"""

import argparse
import csv
import json
import math
import random
import sqlite3
import string
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# ============================================================================
# Reference data (declared, not sampled from any real dataset)
# ============================================================================

# Research-area taxonomy for the School of Computer Science & Engineering.
# Grounded in the school's advertised programme portfolio (data science,
# computer science, cybersecurity) plus standard CS research themes.
RESEARCH_AREAS = [
    ("AI_ML",    "Artificial Intelligence & Machine Learning",
     "Learning algorithms, neural networks, optimisation, applied AI."),
    ("DATA_SCI", "Data Science & Analytics",
     "Statistical modelling, data engineering, visual analytics."),
    ("CYBER",    "Cybersecurity",
     "Network security, cryptography, threat modelling, digital forensics."),
    ("SOFT_ENG", "Software Engineering",
     "Architecture, DevOps, testing, empirical software engineering."),
    ("HCI",      "Human-Computer Interaction",
     "Usability, accessibility, user experience, interaction design."),
    ("NET_IOT",  "Networks & Internet of Things",
     "Distributed systems, edge computing, sensor networks."),
    ("HEALTH",   "Health Informatics & Digital Health",
     "Clinical data systems, health analytics, assistive technology."),
    ("CV",       "Computer Vision & Image Processing",
     "Image analysis, object recognition, medical imaging."),
    ("NLP",      "Natural Language Processing",
     "Text mining, language models, information retrieval."),
    ("GAMES",    "Games & Immersive Technologies",
     "Game engineering, AR/VR, serious games."),
    ("CLOUD",    "Cloud & Distributed Computing",
     "Cloud architecture, virtualisation, scalable services."),
    ("EDTECH",   "Educational Technology",
     "Learning analytics, e-learning systems, technology-enhanced learning."),
]

# Relative prevalence of each area among SUPERVISOR expertise (skewed: a
# school of this profile employs more AI/data/cyber/SE staff than niche areas).
AREA_SUPERVISOR_WEIGHTS = {
    "AI_ML": 1.6, "DATA_SCI": 1.5, "CYBER": 1.4, "SOFT_ENG": 1.3,
    "HCI": 0.9, "NET_IOT": 1.0, "HEALTH": 0.8, "CV": 0.9,
    "NLP": 0.9, "GAMES": 0.7, "CLOUD": 1.0, "EDTECH": 0.6,
}

# Programme -> interest-area weighting. Rows are renormalised at sampling
# time; unlisted areas receive the "other" weight. This encodes the key
# real-world dependency: what students want to research follows what they
# study.
PROGRAMME_AREA_WEIGHTS = {
    "MSc Data Science":
        {"DATA_SCI": 3.0, "AI_ML": 2.5, "NLP": 1.2, "CV": 1.2, "HEALTH": 0.9, "other": 0.35},
    "MSc Computer Science":
        {"SOFT_ENG": 2.2, "AI_ML": 1.4, "CLOUD": 1.3, "NET_IOT": 1.1, "GAMES": 0.9, "HCI": 0.9, "other": 0.5},
    "MSc Cybersecurity":
        {"CYBER": 3.5, "NET_IOT": 1.4, "CLOUD": 1.0, "SOFT_ENG": 0.7, "other": 0.3},
    "MSc Applied Cybersecurity":
        {"CYBER": 3.5, "NET_IOT": 1.3, "CLOUD": 1.0, "SOFT_ENG": 0.7, "other": 0.3},
    "MSc Computer Science with Data Science":
        {"DATA_SCI": 2.5, "AI_ML": 2.0, "SOFT_ENG": 1.3, "CV": 1.0, "NLP": 1.0, "other": 0.4},
    "MSc Computer Science with Cyber Security":
        {"CYBER": 2.5, "SOFT_ENG": 1.5, "NET_IOT": 1.2, "CLOUD": 1.0, "other": 0.4},
}

# Curated, internationally diverse name pools (declared reference data —
# not personal data; combinations are random and any resemblance to a real
# person is coincidental).
FIRST_NAMES = [
    "James", "Oliver", "Harry", "Jack", "George", "Thomas", "Daniel", "Samuel",
    "Emily", "Olivia", "Sophie", "Charlotte", "Grace", "Hannah", "Lucy", "Ella",
    "Mohammed", "Ahmed", "Omar", "Yusuf", "Fatima", "Aisha", "Zainab", "Layla",
    "Wei", "Jun", "Hao", "Li", "Mei", "Xin", "Yan", "Ling",
    "Aarav", "Rohan", "Arjun", "Vikram", "Priya", "Ananya", "Divya", "Sneha",
    "Chinedu", "Emeka", "Tunde", "Kwame", "Ngozi", "Amara", "Chiamaka", "Adaeze",
    "Lukas", "Matteo", "Andrei", "Piotr", "Elena", "Sofia", "Anna", "Katarzyna",
    "Carlos", "Diego", "Rafael", "Miguel", "Lucia", "Camila", "Valentina", "Isabela",
    "Minh", "Duc", "Anh", "Linh", "Somchai", "Nok", "Jin", "Hana",
    "Adam", "Ethan", "Noah", "Leo", "Maya", "Zara", "Nadia", "Yasmin",
]
LAST_NAMES = [
    "Smith", "Jones", "Taylor", "Brown", "Wilson", "Davies", "Evans", "Thomas",
    "Johnson", "Roberts", "Walker", "Wright", "Robinson", "Thompson", "White", "Hughes",
    "Khan", "Ali", "Ahmed", "Hussain", "Rahman", "Begum", "Chowdhury", "Malik",
    "Wang", "Li", "Zhang", "Chen", "Liu", "Yang", "Huang", "Zhao",
    "Patel", "Sharma", "Singh", "Kumar", "Gupta", "Reddy", "Iyer", "Nair",
    "Okafor", "Adeyemi", "Eze", "Mensah", "Osei", "Ibrahim", "Diallo", "Abubakar",
    "Muller", "Schmidt", "Nowak", "Kowalski", "Popescu", "Ivanov", "Petrov", "Novak",
    "Garcia", "Martinez", "Rodriguez", "Silva", "Santos", "Fernandez", "Lopez", "Costa",
    "Nguyen", "Tran", "Pham", "Le", "Kim", "Park", "Sato", "Tanaka",
    "O'Brien", "Murphy", "Kelly", "Doyle", "MacDonald", "Fraser", "Stewart", "Burns",
]


# ============================================================================
# Helpers
# ============================================================================

def weighted_choice(rng, weight_map):
    """Pick a key from {key: weight}."""
    keys = list(weight_map.keys())
    weights = [float(weight_map[k]) for k in keys]
    return rng.choices(keys, weights=weights, k=1)[0]


def clipped_gauss(rng, mean, sd, lo, hi):
    return max(lo, min(hi, rng.gauss(mean, sd)))


def softmax_sample_without_replacement(rng, items, scores, k, temperature):
    """Sample k distinct items, probability proportional to exp(score/T).

    Models bounded-rational choice: students usually pick well-aligned
    supervisors but not always the mathematically optimal ones.
    """
    chosen = []
    pool = list(zip(items, scores))
    for _ in range(min(k, len(pool))):
        mx = max(s for _, s in pool)
        weights = [math.exp((s - mx) / temperature) for _, s in pool]
        pick = rng.choices(range(len(pool)), weights=weights, k=1)[0]
        chosen.append(pool[pick][0])
        pool.pop(pick)
    return chosen


# ============================================================================
# Generation steps
# ============================================================================

def gen_supervisors(rng, cfg, created_at):
    """Supervisors with identity, seniority, FTE and workload quotas.

    Quota model (README §4.3): quota_max = round(base_capacity[seniority] * fte),
    quota_min in {1,2}. Professors get a lower base (research/leadership load),
    consistent with workload-based allocation modelling (Alnaji et al., 2024).
    After sampling, quotas are proportionally inflated if total capacity falls
    below capacity_slack_target * n_students, guaranteeing a feasible
    allocation instance.
    """
    n = cfg["counts"]["supervisors"]
    attrs = cfg["supervisors_attrs"]
    wl = cfg["workload"]
    used_emails, used_names = set(), set()
    rows = []
    for sid in range(1, n + 1):
        while True:
            fn, ln = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
            if (fn, ln) not in used_names:
                used_names.add((fn, ln))
                break
        fn_clean = fn.lower().replace("'", "")
        ln_clean = ln.lower().replace("'", "")
        email = f"{fn_clean}.{ln_clean}@{cfg['email']['staff_domain']}"
        if email in used_emails:  # extremely unlikely after name dedupe; guard anyway
            email = email.replace("@", f"{sid}@")
        used_emails.add(email)
        seniority = weighted_choice(rng, attrs["seniority_weights"])
        fte = float(weighted_choice(rng, attrs["fte_weights"]))
        title = "Prof" if seniority == "Professor" else "Dr"
        quota_max = max(2, round(wl["base_capacity"][seniority] * fte))
        quota_min = rng.choice(wl["quota_min_choices"])
        rows.append({
            "supervisor_id": sid, "title": title, "first_name": fn, "last_name": ln,
            "email": email, "seniority": seniority, "fte": fte,
            "quota_min": quota_min, "quota_max": quota_max, "created_at": created_at,
        })
    # Feasibility guarantee: total capacity must exceed cohort size with slack.
    target = math.ceil(cfg["counts"]["students"] * wl["capacity_slack_target"])
    total = sum(r["quota_max"] for r in rows)
    while total < target:  # add capacity one seat at a time, round-robin, seeded
        r = rows[rng.randrange(len(rows))]
        r["quota_max"] += 1
        total += 1
    return rows


def gen_supervisor_expertise(rng, cfg, supervisors, area_ids_by_code):
    """2–4 areas per supervisor, sampled by school-profile weights; the first
    (strongest) area gets proficiency 3, later ones 1–2."""
    rows = []
    for sup in supervisors:
        k = int(weighted_choice(rng, cfg["expertise"]["areas_per_supervisor"]))
        codes = list(AREA_SUPERVISOR_WEIGHTS.keys())
        weights = [AREA_SUPERVISOR_WEIGHTS[c] for c in codes]
        picked = []
        pool = list(zip(codes, weights))
        for _ in range(k):
            cs, ws = zip(*pool)
            c = rng.choices(cs, weights=ws, k=1)[0]
            picked.append(c)
            pool = [(cc, ww) for cc, ww in pool if cc != c]
        for i, code in enumerate(picked):
            rows.append({
                "supervisor_id": sup["supervisor_id"],
                "area_id": area_ids_by_code[code],
                "proficiency": 3 if i == 0 else rng.choice([1, 2, 2]),
            })
    return rows


def gen_students(rng, cfg, created_at):
    """Students with programme-weighted attributes and university-format emails.

    Email rule (user requirement): local part is exactly 6 random alphanumeric
    characters at student.sunderland.ac.uk. First character is forced to be a
    letter (mail systems and some validators reject leading digits), the rest
    are lowercase letters or digits. Uniqueness enforced.
    """
    n = cfg["counts"]["students"]
    attrs = cfg["students_attrs"]
    letters = string.ascii_lowercase
    alnum = string.ascii_lowercase + string.digits
    used_emails = set()
    rows = []
    for stid in range(1, n + 1):
        fn, ln = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        while True:
            local = rng.choice(letters) + "".join(rng.choice(alnum) for _ in range(
                cfg["email"]["student_local_length"] - 1))
            email = f"{local}@{cfg['email']['student_domain']}"
            if email not in used_emails:
                used_emails.add(email)
                break
        programme = weighted_choice(rng, attrs["programme_weights"])
        qual = weighted_choice(rng, attrs["entry_qualification_weights"])
        pm = attrs["prior_mark_by_qualification"][qual]
        rows.append({
            "student_id": stid, "first_name": fn, "last_name": ln, "email": email,
            "programme": programme,
            "mode": "FT" if rng.random() < attrs["mode_ft_share"] else "PT",
            "entry_year": cfg["academic_year"]["entry_year"],
            "entry_qualification": qual,
            "prior_avg_mark": round(clipped_gauss(rng, pm["mean"], pm["sd"], 40.0, 90.0), 1),
            "created_at": created_at,
        })
    return rows


def gen_student_interests(rng, cfg, students, area_ids_by_code):
    """1–3 ranked interest areas per student, weighted by programme."""
    rows = []
    all_codes = [c for c, _, _ in RESEARCH_AREAS]
    for st in students:
        k = int(weighted_choice(rng, cfg["interests"]["areas_per_student"]))
        wmap = PROGRAMME_AREA_WEIGHTS[st["programme"]]
        other = wmap.get("other", 0.4)
        pool = [(c, wmap.get(c, other)) for c in all_codes]
        picked = []
        for _ in range(k):
            cs, ws = zip(*pool)
            c = rng.choices(cs, weights=ws, k=1)[0]
            picked.append(c)
            pool = [(cc, ww) for cc, ww in pool if cc != c]
        for r, code in enumerate(picked, start=1):
            rows.append({
                "student_id": st["student_id"],
                "area_id": area_ids_by_code[code],
                "rank": r,
            })
    return rows


def alignment_score(st_interest_rows, sup_expertise_rows):
    """Interest/expertise overlap in [0,1].

    Sum over shared areas of interest_weight * proficiency_weight, where the
    student's rank-1 interest counts 1.0, rank-2 0.6, rank-3 0.35, and
    proficiency 3/2/1 counts 1.0/0.7/0.4. Normalised by the student's maximum
    attainable weight so the score is comparable across students.
    """
    iw = {1: 1.0, 2: 0.6, 3: 0.35}
    pw = {3: 1.0, 2: 0.7, 1: 0.4}
    sup_areas = {r["area_id"]: pw[r["proficiency"]] for r in sup_expertise_rows}
    total, max_total = 0.0, 0.0
    for r in st_interest_rows:
        w = iw[r["rank"]]
        max_total += w
        if r["area_id"] in sup_areas:
            total += w * sup_areas[r["area_id"]]
    return total / max_total if max_total else 0.0


def gen_student_preferences(rng, cfg, students, supervisors,
                            interests_by_student, expertise_by_supervisor):
    """Each student ranks list_length supervisors.

    Choice model: score(s, sup) = alignment + popularity_bias(sup) + noise,
    then softmax sampling without replacement (temperature from config).
    A small per-supervisor popularity bias (seeded, N(0, sd)) reproduces the
    real-world clustering of applications on well-known staff without any
    real data — a phenomenon a uniform sampler would miss entirely.
    """
    pcfg = cfg["preferences"]
    pop_bias = {s["supervisor_id"]: rng.gauss(0.0, pcfg["popularity_noise_sd"])
                for s in supervisors}
    rows = []
    for st in students:
        sup_ids, scores = [], []
        for sup in supervisors:
            a = alignment_score(interests_by_student[st["student_id"]],
                                expertise_by_supervisor[sup["supervisor_id"]])
            sup_ids.append(sup["supervisor_id"])
            scores.append(a + pop_bias[sup["supervisor_id"]] + rng.gauss(0.0, 0.05))
        chosen = softmax_sample_without_replacement(
            rng, sup_ids, scores, pcfg["list_length"], pcfg["softmax_temperature"])
        for rank, sup_id in enumerate(chosen, start=1):
            rows.append({"student_id": st["student_id"],
                         "supervisor_id": sup_id, "rank": rank})
    return rows


def gen_supervisor_preferences(rng, students_by_id, student_prefs,
                               interests_by_student, expertise_by_supervisor):
    """Supervisors score exactly their applicants (students who listed them).

    score = 0.65 * alignment + 0.25 * normalised prior mark + 0.10 * noise,
    clipped to [0,1]. Prior attainment enters because the at-risk literature
    (Chen & Zhai, 2023) identifies it as the signal staff actually use.
    """
    rows = []
    seen = set()
    for pref in student_prefs:
        key = (pref["supervisor_id"], pref["student_id"])
        if key in seen:
            continue
        seen.add(key)
        st = students_by_id[pref["student_id"]]
        a = alignment_score(interests_by_student[st["student_id"]],
                            expertise_by_supervisor[pref["supervisor_id"]])
        mark_norm = (st["prior_avg_mark"] - 40.0) / 50.0
        score = 0.65 * a + 0.25 * mark_norm + 0.10 * rng.random()
        rows.append({"supervisor_id": pref["supervisor_id"],
                     "student_id": pref["student_id"],
                     "score": round(max(0.0, min(1.0, score)), 4)})
    return rows


# ============================================================================
# Output
# ============================================================================

TABLE_ORDER = [
    ("research_areas",        ["area_id", "code", "name", "description"]),
    ("supervisors",           ["supervisor_id", "title", "first_name", "last_name",
                               "email", "seniority", "fte", "quota_min", "quota_max",
                               "created_at"]),
    ("supervisor_expertise",  ["supervisor_id", "area_id", "proficiency"]),
    ("students",              ["student_id", "first_name", "last_name", "email",
                               "programme", "mode", "entry_year",
                               "entry_qualification", "prior_avg_mark", "created_at"]),
    ("student_interests",     ["student_id", "area_id", "rank"]),
    ("student_preferences",   ["student_id", "supervisor_id", "rank"]),
    ("supervisor_preferences",["supervisor_id", "student_id", "score"]),
]


def write_csvs(outdir, data):
    outdir.mkdir(parents=True, exist_ok=True)
    for table, cols in TABLE_ORDER:
        path = outdir / f"{table}.csv"
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(data[table])
        print(f"  wrote {path.name} ({len(data[table])} rows)")


def build_sqlite(db_path, schema_path, data):
    """Build in a local temp dir first: SQLite needs POSIX locks that some
    mounted/network filesystems don't support, so we connect on tmpfs and
    move the finished file into place."""
    import shutil, tempfile
    tmp = Path(tempfile.mkdtemp()) / db_path.name
    con = sqlite3.connect(tmp)
    con.executescript(schema_path.read_text(encoding="utf-8"))
    for table, cols in TABLE_ORDER:
        placeholders = ", ".join("?" for _ in cols)
        con.executemany(
            f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})",
            [tuple(row[c] for c in cols) for row in data[table]])
    con.commit()
    # integrity check while we are here
    fk = con.execute("PRAGMA foreign_key_check").fetchall()
    con.close()
    if fk:
        sys.exit(f"FATAL: foreign key violations in built database: {fk[:5]}")
    # copyfile overwrites content in place (works even where unlink is
    # restricted, e.g. mounted folders)
    shutil.copyfile(str(tmp), str(db_path))
    print(f"  built {db_path.name}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(HERE / "config.json"))
    ap.add_argument("--outdir", default=str(HERE / "data"))
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    rng = random.Random(cfg["seed"])
    created_at = cfg["academic_year"]["created_at"]

    print(f"Generating with seed={cfg['seed']}: "
          f"{cfg['counts']['students']} students, "
          f"{cfg['counts']['supervisors']} supervisors")

    areas = [{"area_id": i + 1, "code": c, "name": n, "description": d}
             for i, (c, n, d) in enumerate(RESEARCH_AREAS)]
    area_ids_by_code = {a["code"]: a["area_id"] for a in areas}

    supervisors = gen_supervisors(rng, cfg, created_at)
    expertise = gen_supervisor_expertise(rng, cfg, supervisors, area_ids_by_code)
    students = gen_students(rng, cfg, created_at)
    interests = gen_student_interests(rng, cfg, students, area_ids_by_code)

    interests_by_student = {}
    for r in interests:
        interests_by_student.setdefault(r["student_id"], []).append(r)
    expertise_by_supervisor = {}
    for r in expertise:
        expertise_by_supervisor.setdefault(r["supervisor_id"], []).append(r)

    student_prefs = gen_student_preferences(
        rng, cfg, students, supervisors, interests_by_student, expertise_by_supervisor)
    students_by_id = {s["student_id"]: s for s in students}
    supervisor_prefs = gen_supervisor_preferences(
        rng, students_by_id, student_prefs, interests_by_student, expertise_by_supervisor)

    data = {
        "research_areas": areas,
        "supervisors": supervisors,
        "supervisor_expertise": expertise,
        "students": students,
        "student_interests": interests,
        "student_preferences": student_prefs,
        "supervisor_preferences": supervisor_prefs,
    }

    outdir = Path(args.outdir)
    write_csvs(outdir, data)
    build_sqlite(HERE / "thesis_management.db", HERE / "schema.sql", data)
    print("Done. Run validate.py next.")


if __name__ == "__main__":
    main()
