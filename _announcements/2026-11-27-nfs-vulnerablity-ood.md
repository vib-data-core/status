---
# Copy this file to YYYY-MM-DD-short-slug.md and edit it. This file itself is
# never rendered: _config.yml excludes it from the build.
title: Short interruption in running sessions on Open Ondemand
start: 2026-11-27 14:50:00
#   Belgian local time. No timezone offset - do not write +02:00.
end: 2026-11-27 15:10:00
#   Leave `end` out entirely while it is still going on. Add it once it is
#   over and the entry moves to /history/ by itself.
type: unplanned
#   unplanned | planned - see _data/levels.yml
services_affected:
  - compute
#   One or more ids from _data/services.yml
summary: To be able to apply an urgent patch to the kernel we will have to restart the Open Ondemand server
#   Optional: leave it out and the card shows the first paragraph of the body.
# updates:
#   - time: 2026-09-19 14:00:00
#     body: What changed since this went up. Every update is labelled "Update"; there is nothing else to set.
---

To be able to apply an urgent patch to the kernel we will have to restart the Open Ondemand server at 15h00 CET 27/11/2026. If you have a running sessions it could be that you need to reconnect again. We apologize for the inconvenience.
