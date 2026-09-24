# Modernization progress

Work takes place on `modernise`. No deployment or push is part of this change.

1. Record the plan and remove generated dependencies from version control.
2. Validate and export the original flag database with explicit shared-flag rules.
3. Implement FastAPI game contracts, encrypted context and backend regression tests.
4. Build the React/Tailwind interface and integrate the API.
5. Verify browser journeys, clean builds and deployment configuration; document operation.

The replacement is developed together on this branch, so temporary patches to the retiring Flask interface are superseded by regression-tested replacements. Original production behavior remains in the base commit.

Competition accounts, durable result storage, rankings, regional challenges and installable offline support remain explicitly deferred as described in PLAN.md. The initial release is casual play.
