---
# Copy this file to YYYY-MM-DD-short-slug.md and edit it. This file itself is
# never rendered: _config.yml excludes it from the build.
title: Temporary unavailability of VIB authentication for Globus
start: 2026-10-21 16:00:00
#   Belgian local time. No timezone offset - do not write +02:00.
# end: 2026-09-19 18:00:00
#   Leave `end` out entirely while it is still going on. Add it once it is
#   over and the entry moves to /history/ by itself.
type: unplanned
#   unplanned | planned - see _data/levels.yml
services_affected:
  - data-transfer
#   One or more ids from _data/services.yml
# summary: One or two sentences shown on the card and in the history.
#   Optional: leave it out and the card shows the first paragraph of the body.
# updates:
#   - time: 2026-09-19 14:00:00
#     body: What changed since this went up. Every update is labelled "Update"; there is nothing else to set.
---

The authentication service has been taken offline as a precaution due to a PHP vulnerability. Existing sessions may continue to work, but new authentication attempts will fail.
