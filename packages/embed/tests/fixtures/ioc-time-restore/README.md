# Frozen B4 browser collection inputs

These are the exact B4 acceptance inputs, copied from `docs/evidence/ioc-header-b4/evidence/restore-{contract,adapter}.json`. They are test fixtures, not a new design authority. The collector snapshot comes from `moon-skills/skills/sdd-dev-frontend/scripts/collect_restore_facts.js`; its SHA-256 is `11322dfbf0ba8c8de9ae40ad858fd65e5f6e900da73b8e93b1c1dfc7119d5f2a`.

Keep these inputs self-contained for installed-consumer CI. The collector has no imports or external requests. Browser output belongs in Playwright test artifacts, so routine tests do not overwrite historical acceptance evidence. Updating this snapshot requires an explicit B4 contract/collector revision.
