# ============================================================
# P0.4 — README EXPANSION ERA ALIGNMENT AUDIT
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx (authoritative)
- ARCHITECTURE_OPERATIONALIZATION.pdf (historical substrate only)

Goal:

Audit README.md and identify every location where the README
still reflects pre-Expansion-Era assumptions.

This is an audit and correction pass.

Do not invent new roadmap content.

Use Expansion Era as the source of truth.

# ============================================================
# HARD CONSTRAINTS
# ============================================================

Do NOT modify:

- runtime code
- tests
- configuration
- documentation outside README

README only.

Do NOT invent features.

Do NOT remove completed work.

Do NOT alter historical descriptions of completed phases.

Only fix areas where README conflicts with:

- Expansion Era roadmap
- Voice Authority Amendment
- Current post-Phase-20 status

# ============================================================
# REQUIRED WORK
# ============================================================

Audit README for:

1. Voice assumptions

Identify any statements implying:

- wake word permanently forbidden
- conversation mode permanently forbidden
- voice can never approve anything

Compare against Expansion Era:

- T0/T1/T2/T3 authority model
- local wake word
- conversation mode
- standing consent

2. Expansion Era status

Verify README correctly states:

- Phase 1–20 complete
- Expansion Era active
- Expansion Era roadmap exists

3. Deferred vs Disabled

Identify features incorrectly presented as:

- permanently disabled

when Expansion Era has actually moved them into:

- future planned capability

4. CAI status

Verify README reflects:

- governed and integrated
- execution blocked
- explicit future opening required

5. Future roadmap section

Verify roadmap language aligns with:

Priority 0
Phase 21
Phase 22+
structure.

# ============================================================
# REQUIRED COMMANDS
# ============================================================

npm test

# only if README changes were made

git diff -- README.md

# ============================================================
# FINAL RESPONSE FORMAT
# ============================================================

1. Effort level

2. README sections audited

3. Expansion Era conflicts found

4. Exact README corrections made

5. Expansion Era alignment assessment

PASS
or
PASS WITH NOTES

6. Commands executed

7. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

docs: align README with Expansion Era architecture

