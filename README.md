# VIB Data Core — announcements

Public notice board for the services run by VIB Data Core:
**https://vib-data-core.github.io/status**

Everything on that page comes from Markdown files in this repository. Posting
an announcement means adding one file — no HTML, no CSS, no build step on your
side.

## Quick start: post an announcement

Copy [`_announcements/TEMPLATE.md`](_announcements/TEMPLATE.md) to a new file
next to it and edit it. On GitHub: open the template, **Copy raw file**, then
in [`_announcements/`](_announcements/) click **Add file → Create new file**,
name it `YYYY-MM-DD-short-slug.md` — for example
`2026-09-19-project-storage-slow.md` — and paste.


```yaml
---
title: Slower than usual access to Project Storage
start: 2026-09-19 09:30:00
type: unplanned
services_affected:
  - project-storage
summary: >-
  One or two sentences shown on the card and in the history.
---

Markdown body
```

Leave `end:` out entirely while it is still going on. When it is over, edit the
same file and add the end time:

```yaml
end: 2026-09-19 18:00:00
```

For planned work, set `type: planned` and give both `start` and `end` up front:

```yml
---
title: Planned maintenance of the Electronic Lab Notebook
start: 2026-10-06 19:00:00
end: 2026-10-06 23:00:00
type: planned
services_affected:
  - eln
summary: >-
  The Electronic Lab Notebook is unavailable for about four hours.
---
```

The page rebuilds automatically after the change lands on `main`.

## Updates during a long announcement

A long-running announcement can carry a list of updates. Newest first or
oldest first, both work; the page sorts them. The most recent update is also
shown on the card on the landing page.

```yaml
updates:
  - time: 2026-09-20 11:00:00
    body: >-
      Performance has improved for most users.
  - time: 2026-09-19 10:15:00
    body: >-
      We are aware of the slower access and are looking into it.
```

## Front matter reference

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `title` | yes | text | Keep it under ~90 characters. Describe the impact, not the cause. |
| `start` | yes | date-time | Unquoted, **no timezone offset**: `2026-09-19 09:30:00`. Always Belgian local time — summer and winter time are handled for you. |
| `end` | no | date-time | Omit while it is still going on. Once it is in the past, the entry moves to the history page. |
| `type` | yes | keyword | `unplanned` or `planned`. |
| `services_affected` | yes | list | Ids from [`_data/services.yml`](_data/services.yml). Unknown ids fail the build check. |
| `summary` | recommended | text | One or two sentences, shown on cards and in the history. |
| `updates` | no | list | Chronological updates during a long announcement, each one a `time` and a `body`. See the commented-out block in the template. |

Times carry no offset because every time on this page is Belgian local time.
[`_plugins/local_times.rb`](_plugins/local_times.rb) reads them that way; YAML
would otherwise take a bare time for UTC and the page would move the entry an
hour or two late.

### Services

Defined in [`_data/services.yml`](_data/services.yml), and they mirror the Data
Core catalogue (the services listed in Connect). One announcement can cover
several of them. Use the `id` in front matter; the `name` is what readers see:

```yaml
- id: project-storage
  name: Project Storage
  description: Laboris nisi ut aliquip ex ea commodo consequat.
```

The `description` only surfaces as the tooltip on a service chip, and the ones
checked in are placeholder text — replace them with the catalogue wording.

If the catalogue gains a service, add it here in the same change. Ids are
lowercase with dashes and should not change afterwards — they appear in
shareable filter links such as `/history/?services=project-storage,usegalaxy`.

## Working on it locally

You need Ruby (3.1+) and Node (18+).

```bash
bundle install     # Jekyll and friends
npm install        # Tailwind CLI

npm run serve      # builds the CSS, watches it, and serves on http://localhost:3002/status/
```

Other commands:

```bash
npm run css        # one-off, minified stylesheet
npm run build      # CSS + full Jekyll build into _site/
npm run validate   # check all entries against the vocabularies
```

`assets/css/main.css` is generated and git-ignored — never edit it by hand,
edit [`assets/css/tailwind.css`](assets/css/tailwind.css) instead.


### Checks on every change

[`script/validate.rb`](script/validate.rb) runs in CI and fails on:

- missing `title`, `start` or `type`
- an unknown `type`, or a retired `severity:`/`kind:` key
- quoted or malformed date-times, and an `end` before the `start`
- a `Z` or `+00:00` offset on a time, which is indistinguishable from a bare
  Belgian local time and would silently shift the entry by an hour or two
- missing or unknown service ids
- malformed `updates` entries

It also prints warnings (empty body, missing summary, odd file name) that do
not block the change.


## Licence

Code in this repository is MIT licensed (see [LICENSE](LICENSE)).
