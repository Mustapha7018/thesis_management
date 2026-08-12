-- ============================================================================
-- Thesis Management Platform — Database Schema
-- ----------------------------------------------------------------------------
-- Target: SQLite (development). Written to be PostgreSQL-compatible for
-- deployment: portable types (INTEGER/TEXT/REAL), no engine-specific syntax,
-- all constraints declared (CHECK / UNIQUE / FOREIGN KEY).
--
-- The synthetic dataset (generate.py) populates the CORE entities marked
-- [populated]. The PORTAL entities marked [empty] are created now so the same
-- schema serves as the application database from day one; the API and GA
-- engine will write into them.
--
-- Conventions:
--   * Dates/timestamps stored as ISO-8601 TEXT (portable across SQLite/PG).
--   * Booleans stored as INTEGER 0/1 with CHECK constraints.
--   * Natural keys (emails) are UNIQUE; surrogate integer PKs everywhere.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. research_areas [populated]
--    Taxonomy of research themes for the School of Computer Science &
--    Engineering. Shared by supervisor expertise and student interests.
-- ----------------------------------------------------------------------------
CREATE TABLE research_areas (
    area_id     INTEGER PRIMARY KEY,
    code        TEXT    NOT NULL UNIQUE,          -- short stable code, e.g. 'AI_ML'
    name        TEXT    NOT NULL UNIQUE,
    description TEXT
);

-- ----------------------------------------------------------------------------
-- 2. supervisors [populated]
--    Academic staff. quota_min/quota_max are the workload-derived supervision
--    quotas used as hard constraints by the allocation engine (O2); they are
--    proportional to FTE and seniority (see README: workload model).
-- ----------------------------------------------------------------------------
CREATE TABLE supervisors (
    supervisor_id INTEGER PRIMARY KEY,
    title         TEXT    NOT NULL CHECK (title IN ('Dr', 'Prof')),
    first_name    TEXT    NOT NULL,
    last_name     TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,        -- firstname.lastname@sunderland.ac.uk
    seniority     TEXT    NOT NULL CHECK (seniority IN
                     ('Lecturer', 'Senior Lecturer', 'Associate Professor', 'Professor')),
    fte           REAL    NOT NULL CHECK (fte > 0.0 AND fte <= 1.0),
    quota_min     INTEGER NOT NULL CHECK (quota_min >= 0),
    quota_max     INTEGER NOT NULL CHECK (quota_max >= 1),
    created_at    TEXT    NOT NULL,
    CHECK (quota_max >= quota_min)
);

-- ----------------------------------------------------------------------------
-- 3. supervisor_expertise [populated]  (M:N supervisors <-> research_areas)
--    proficiency: 1 = working knowledge, 2 = established, 3 = leading.
-- ----------------------------------------------------------------------------
CREATE TABLE supervisor_expertise (
    supervisor_id INTEGER NOT NULL REFERENCES supervisors(supervisor_id),
    area_id       INTEGER NOT NULL REFERENCES research_areas(area_id),
    proficiency   INTEGER NOT NULL CHECK (proficiency BETWEEN 1 AND 3),
    PRIMARY KEY (supervisor_id, area_id)
);

-- ----------------------------------------------------------------------------
-- 4. students [populated]
--    Postgraduate project students, Faculty of Business (School of CS & Eng.).
--    prior_avg_mark and entry_qualification are retained because the reviewed
--    at-risk literature (Ujkani et al., 2024; Chen & Zhai, 2023) identifies
--    prior attainment as a leading predictive feature; the dashboard's
--    flagging rules may weight them.
-- ----------------------------------------------------------------------------
CREATE TABLE students (
    student_id          INTEGER PRIMARY KEY,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    email               TEXT NOT NULL UNIQUE,     -- 6-char alphanumeric @student.sunderland.ac.uk
    programme           TEXT NOT NULL CHECK (programme IN
                          ('MSc Data Science',
                           'MSc Computer Science',
                           'MSc Cybersecurity',
                           'MSc Applied Cybersecurity',
                           'MSc Computer Science with Data Science',
                           'MSc Computer Science with Cyber Security')),
    mode                TEXT NOT NULL CHECK (mode IN ('FT', 'PT')),
    entry_year          INTEGER NOT NULL,
    entry_qualification TEXT NOT NULL CHECK (entry_qualification IN
                          ('First', '2:1', '2:2', 'International equivalent')),
    prior_avg_mark      REAL NOT NULL CHECK (prior_avg_mark >= 40.0 AND prior_avg_mark <= 90.0),
    created_at          TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 5. student_interests [populated]  (M:N students <-> research_areas)
--    rank: 1 = primary interest, up to 3.
-- ----------------------------------------------------------------------------
CREATE TABLE student_interests (
    student_id INTEGER NOT NULL REFERENCES students(student_id),
    area_id    INTEGER NOT NULL REFERENCES research_areas(area_id),
    rank       INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
    PRIMARY KEY (student_id, area_id),
    UNIQUE (student_id, rank)
);

-- ----------------------------------------------------------------------------
-- 6. student_preferences [populated]
--    Each student ranks exactly PREF_LIST_LENGTH (default 5) supervisors.
--    One side of the two-sided preference model (SPA-style).
-- ----------------------------------------------------------------------------
CREATE TABLE student_preferences (
    student_id    INTEGER NOT NULL REFERENCES students(student_id),
    supervisor_id INTEGER NOT NULL REFERENCES supervisors(supervisor_id),
    rank          INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 5),
    PRIMARY KEY (student_id, rank),
    UNIQUE (student_id, supervisor_id)
);

-- ----------------------------------------------------------------------------
-- 7. supervisor_preferences [populated]
--    The other side of the two-sided model: supervisors score the students
--    who listed them (their "applicants"), 0.0–1.0. Score-based rather than
--    strict ranking: real supervisors do not produce total orders over whole
--    cohorts, and scores let the GA weight alignment continuously.
-- ----------------------------------------------------------------------------
CREATE TABLE supervisor_preferences (
    supervisor_id INTEGER NOT NULL REFERENCES supervisors(supervisor_id),
    student_id    INTEGER NOT NULL REFERENCES students(student_id),
    score         REAL    NOT NULL CHECK (score >= 0.0 AND score <= 1.0),
    PRIMARY KEY (supervisor_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 8. allocations [empty — written by the GA engine (O2)]
--    run_id groups one execution of an allocation algorithm so that GA and
--    baseline (manual/random) runs can be benchmarked side by side (O6).
-- ----------------------------------------------------------------------------
CREATE TABLE allocations (
    allocation_id  INTEGER PRIMARY KEY,
    run_id         TEXT    NOT NULL,
    algorithm      TEXT    NOT NULL,              -- 'ga', 'random', 'manual', ...
    student_id     INTEGER NOT NULL REFERENCES students(student_id),
    supervisor_id  INTEGER NOT NULL REFERENCES supervisors(supervisor_id),
    objective_score REAL,
    created_at     TEXT    NOT NULL,
    UNIQUE (run_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 9. sprints / 10. milestones / 11. tasks [empty — Agile module (O3)]
-- ----------------------------------------------------------------------------
CREATE TABLE sprints (
    sprint_id  INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id),
    name       TEXT    NOT NULL,
    goal       TEXT,
    start_date TEXT    NOT NULL,
    end_date   TEXT    NOT NULL,
    CHECK (end_date >= start_date)
);

CREATE TABLE milestones (
    milestone_id INTEGER PRIMARY KEY,
    student_id   INTEGER NOT NULL REFERENCES students(student_id),
    title        TEXT    NOT NULL,
    description  TEXT,
    due_date     TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned', 'in_progress', 'done', 'overdue')),
    created_at   TEXT    NOT NULL
);

CREATE TABLE tasks (
    task_id      INTEGER PRIMARY KEY,
    sprint_id    INTEGER REFERENCES sprints(sprint_id),
    milestone_id INTEGER REFERENCES milestones(milestone_id),
    student_id   INTEGER NOT NULL REFERENCES students(student_id),
    title        TEXT    NOT NULL,
    priority     TEXT    NOT NULL DEFAULT 'medium'
                   CHECK (priority IN ('low', 'medium', 'high')),
    status       TEXT    NOT NULL DEFAULT 'todo'
                   CHECK (status IN ('todo', 'in_progress', 'done')),
    created_at   TEXT    NOT NULL,
    updated_at   TEXT
);

-- ----------------------------------------------------------------------------
-- 12. meetings [empty — meeting logging (O4)]
-- ----------------------------------------------------------------------------
CREATE TABLE meetings (
    meeting_id    INTEGER PRIMARY KEY,
    student_id    INTEGER NOT NULL REFERENCES students(student_id),
    supervisor_id INTEGER NOT NULL REFERENCES supervisors(supervisor_id),
    scheduled_at  TEXT    NOT NULL,
    held          INTEGER NOT NULL DEFAULT 0 CHECK (held IN (0, 1)),
    notes         TEXT
);

-- ----------------------------------------------------------------------------
-- 13. at_risk_flags [empty — explainable flagging for the dashboard (O5)]
--     rule_code + reason make every flag explainable (Ujkani et al., 2024).
-- ----------------------------------------------------------------------------
CREATE TABLE at_risk_flags (
    flag_id    INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id),
    rule_code  TEXT    NOT NULL,                  -- e.g. 'MILESTONE_OVERDUE_2'
    reason     TEXT    NOT NULL,                  -- human-readable explanation
    raised_at  TEXT    NOT NULL,
    cleared_at TEXT
);

-- ----------------------------------------------------------------------------
-- Indexes for the access paths the API will use most.
-- ----------------------------------------------------------------------------
CREATE INDEX idx_expertise_area      ON supervisor_expertise(area_id);
CREATE INDEX idx_interests_area      ON student_interests(area_id);
CREATE INDEX idx_prefs_supervisor    ON student_preferences(supervisor_id);
CREATE INDEX idx_sprefs_student      ON supervisor_preferences(student_id);
CREATE INDEX idx_alloc_run           ON allocations(run_id);
CREATE INDEX idx_milestones_student  ON milestones(student_id);
CREATE INDEX idx_tasks_student       ON tasks(student_id);
CREATE INDEX idx_meetings_student    ON meetings(student_id);
CREATE INDEX idx_flags_student       ON at_risk_flags(student_id);
