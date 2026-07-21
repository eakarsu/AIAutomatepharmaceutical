# Operations and clinical-use boundary

Copy `.env.example` to `.env`, replace secrets, then explicitly run `scripts/bootstrap.sh` and `scripts/migrate.sh`. `start.sh` is non-destructive. Synthetic data requires `CONFIRM_DEMO_SEED=yes scripts/seed-demo.sh`.

`/api/evidence-cases` records pseudonymous subjects, versioned source hashes, terminology versions, interaction-rule outcomes, consent basis, uncertainty, independent professional review, optimistic concurrency, tenant boundaries, and immutable history. It rejects direct patient identifiers and autonomous diagnosis, prescribing, or dose-change requests. Generated gap, generic AI, regulatory gateway, and other unvalidated provider routes are not mounted. Clinical, terminology, registry, and regulatory integrations require governed credentials and expert validation.

