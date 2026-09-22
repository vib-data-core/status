#!/usr/bin/env ruby
# frozen_string_literal: true

# Checks every announcement against the controlled vocabularies in _data/.
# Runs on every pull request; run it locally with:
#
#   ruby script/validate.rb        (or: npm run validate)

require "yaml"
require "date"

ROOT = File.expand_path("..", __dir__)
FILENAME_RE = /\A\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md\z/.freeze

# There is one collection and one vocabulary: `type:`, whose allowed values
# are the keys of _data/levels.yml.
COLLECTION = "_announcements"
FIELD = "type"
# Copied, never published (see the exclude list in _config.yml). It is still
# checked here so it cannot drift away from the vocabularies, but it is
# exempt from the YYYY-MM-DD-slug naming rule.
TEMPLATE = "TEMPLATE.md"

# Times are written without a timezone offset and read as Europe/Brussels by
# _plugins/local_times.rb. An offset still renders correctly, but it is noise;
# a zero offset (Z / +00:00) is worse than noise, because it is exactly what a
# bare local time looks like to the YAML parser and would silently shift by an
# hour or two.
OFFSET_RE = /^\s*(?:-\s+)?(?:start|end|time):\s*\d{4}-\d{2}-\d{2}[ Tt]\d{2}:\d{2}(?::\d{2})?\s*(Z|[+-]\d{2}:?\d{2})\s*$/.freeze
ZERO_OFFSET_RE = /\AZ|\A[+-]00:?00\z/.freeze
# `severity` was the field of the old incident collection. Flag it explicitly:
# a stray severity: is the most likely mistake when copying an older file.
RETIRED_FIELDS = %w[severity kind].freeze

def load_yaml(text)
  YAML.safe_load(text, permitted_classes: [Date, Time], aliases: true)
end

levels = load_yaml(File.read(File.join(ROOT, "_data", "levels.yml")))
services = load_yaml(File.read(File.join(ROOT, "_data", "services.yml")))
service_ids = services.map { |s| s["id"] }

errors = []
warnings = []
count = 0

# _data/levels.yml is the colour config for the whole site: each type carries
# its `color` through to CSS as --accent. A typo there would silently render
# shapes with no colour at all, so check it here instead.
HEX_RE = /\A#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\z/.freeze
levels.each do |key, defn|
  %w[label icon description].each do |field|
    errors << "_data/levels.yml: `#{key}` is missing `#{field}`" if defn[field].to_s.strip.empty?
  end
  color = defn["color"]
  if color.nil? || color.to_s.strip.empty?
    errors << "_data/levels.yml: `#{key}` is missing `color` (a quoted hex, e.g. \"#cf8f9c\")"
  elsif !color.to_s.match?(HEX_RE)
    errors << "_data/levels.yml: `#{key}` has color `#{color}`, which is not a hex like \"#cf8f9c\""
  end
end

def timestamp?(value)
  value.is_a?(Time) || value.is_a?(DateTime) || value.is_a?(Date)
end

def to_time(value)
  value.to_time
end

dir = COLLECTION
path = File.join(ROOT, dir)
allowed = levels.keys
known_keys = %w[title start end services_affected summary updates layout] + [FIELD]

if Dir.exist?(path)
  Dir.glob(File.join(path, "*.md")).sort.each do |file|
    rel = file.sub("#{ROOT}/", "")
    count += 1
    err = ->(msg) { errors << "#{rel}: #{msg}" }
    warn_ = ->(msg) { warnings << "#{rel}: #{msg}" }

    basename = File.basename(file)
    unless basename == TEMPLATE || basename.match?(FILENAME_RE)
      warn_.call("filename should look like YYYY-MM-DD-short-slug.md")
    end

    raw = File.read(file)
    match = raw.match(/\A---\s*\n(.*?)\n---\s*(\n|\z)/m)
    unless match
      err.call("no YAML front matter found (the file must start with ---)")
      next
    end

    begin
      fm = load_yaml(match[1])
    rescue Psych::Exception => e
      err.call("front matter is not valid YAML: #{e.message}")
      next
    end

    unless fm.is_a?(Hash)
      err.call("front matter must be a mapping of key: value pairs")
      next
    end

    # --- timezone offsets ---------------------------------------------------
    match[1].each_line do |line|
      offset = line[OFFSET_RE, 1]
      next if offset.nil?

      if offset.match?(ZERO_OFFSET_RE)
        err.call("`#{offset}` on `#{line.strip}` is read as Europe/Brussels, not UTC - drop the offset and write the Belgian local time")
      else
        warn_.call("the `#{offset}` offset is no longer needed; times are read as Europe/Brussels - `#{line.strip.sub(/\s*#{Regexp.escape(offset)}\z/, '')}` is enough")
      end
    end

    # --- title -------------------------------------------------------------
    title = fm["title"]
    err.call("`title` is required") if title.nil? || title.to_s.strip.empty?
    warn_.call("`title` is very long (#{title.to_s.length} chars), keep it under 90") if title.to_s.length > 90

    # --- start / end -------------------------------------------------------
    start = fm["start"]
    if start.nil?
      err.call("`start` is required")
    elsif !timestamp?(start)
      err.call("`start` must be an unquoted date-time, e.g. 2026-09-14 08:20:00 (got #{start.class})")
    end

    finish = fm["end"]
    if !finish.nil? && !timestamp?(finish)
      err.call("`end` must be an unquoted date-time, e.g. 2026-09-14 18:00:00 (got #{finish.class})")
    elsif timestamp?(start) && timestamp?(finish) && to_time(finish) < to_time(start)
      err.call("`end` (#{finish}) is before `start` (#{start})")
    end

    # --- type --------------------------------------------------------------
    RETIRED_FIELDS.each do |retired|
      next unless fm.key?(retired)
      err.call("`#{retired}` no longer exists; this site has no severity scale, use `#{FIELD}: #{allowed.join(' | ')}`")
    end

    value = fm[FIELD]
    if value.nil?
      err.call("`#{FIELD}` is required, one of: #{allowed.join(', ')}")
    elsif !allowed.include?(value.to_s)
      err.call("unknown #{FIELD} `#{value}`, use one of: #{allowed.join(', ')}")
    end

    # --- services ----------------------------------------------------------
    affected = fm["services_affected"]
    if affected.nil? || (affected.respond_to?(:empty?) && affected.empty?)
      err.call("`services_affected` is required and must list at least one service")
    elsif !affected.is_a?(Array)
      err.call("`services_affected` must be a list, e.g. [project-storage, usegalaxy]")
    else
      affected.each do |id|
        if id.nil? || id.to_s.strip.empty?
          err.call("`services_affected` has an empty entry - fill in a service id or remove the line")
        elsif !service_ids.include?(id.to_s)
          err.call("unknown service `#{id}` - add it to _data/services.yml or use one of: #{service_ids.join(', ')}")
        end
      end
      dupes = affected.tally.select { |_, n| n > 1 }.keys
      warn_.call("duplicate services listed: #{dupes.join(', ')}") if dupes.any?
    end

    # --- summary -----------------------------------------------------------
    summary = fm["summary"]
    if summary.nil? || summary.to_s.strip.empty?
      warn_.call("no `summary`: the card will only show the title")
    elsif summary.to_s.length > 300
      warn_.call("`summary` is long (#{summary.to_s.length} chars); it is meant to be one or two sentences")
    end

    # --- updates -----------------------------------------------------------
    updates = fm["updates"]
    if updates
      if !updates.is_a?(Array)
        err.call("`updates` must be a list")
      else
        updates.each_with_index do |u, i|
          label = "updates[#{i}]"
          unless u.is_a?(Hash)
            err.call("#{label} must be a mapping with `time` and `body`")
            next
          end
          err.call("#{label}.time must be an unquoted date-time") unless timestamp?(u["time"])
          err.call("#{label}.body is required") if u["body"].to_s.strip.empty?
          if u.key?("status")
            warn_.call("#{label}.status is ignored; every update is labelled \"Update\"")
          end
          if timestamp?(start) && timestamp?(u["time"]) && to_time(u["time"]) < to_time(start)
            warn_.call("#{label}.time is before the start of the entry")
          end
        end
      end
    end

    # --- body --------------------------------------------------------------
    body = raw[match.end(0)..].to_s.strip
    warn_.call("the body is empty; describe impact and resolution") if body.empty?

    (fm.keys - known_keys - RETIRED_FIELDS).each do |key|
      warn_.call("unknown front matter key `#{key}` (ignored when rendering)")
    end
  end
end

puts "Checked #{count} announcement#{count == 1 ? '' : 's'} in #{COLLECTION}."

unless warnings.empty?
  puts "\nWarnings (#{warnings.size}):"
  warnings.each { |w| puts "  ! #{w}" }
end

if errors.empty?
  puts "\nAll good."
  exit 0
end

puts "\nErrors (#{errors.size}):"
errors.each { |e| puts "  x #{e}" }
exit 1
