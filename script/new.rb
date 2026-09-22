#!/usr/bin/env ruby
# frozen_string_literal: true

# Scaffolds a new announcement.
#
#   ruby script/new.rb "Project Storage is slow"
#   ruby script/new.rb "Maintenance of the ELN" --type planned
#
# Prints the path of the created file; edit it and commit it.

require "time"

USAGE = <<~TEXT
  Usage: ruby script/new.rb "Title" [--type unplanned|planned]

    --type KEY   unplanned (default) | planned
TEXT

args = ARGV.dup
title = args.shift

abort USAGE unless title && !title.strip.empty? && !title.start_with?("-")

type = nil
until args.empty?
  flag = args.shift
  case flag
  when "--type", "-t" then type = args.shift
  else abort "Unknown option #{flag}\n\n#{USAGE}"
  end
end

type ||= "unplanned"
abort "--type must be unplanned or planned\n\n#{USAGE}" unless %w[unplanned planned].include?(type)

now = Time.now
slug = title.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "")[0, 50].sub(/-\z/, "")
path = File.join(File.expand_path("..", __dir__), "_announcements", "#{now.strftime('%Y-%m-%d')}-#{slug}.md")

abort "#{path} already exists" if File.exist?(path)

stamp = now.strftime("%Y-%m-%d %H:%M:00 ") + now.strftime("%:z")

File.write(path, <<~MARKDOWN)
  ---
  title: #{title}
  start: #{stamp}
  # Add `end:` once it is over, in the same format as `start`.
  type: #{type}
  services_affected:
    - # id from _data/services.yml
  summary: >-
    One or two sentences describing the impact, in general terms.
  ---

  Describe what people notice and what they can do about it. Keep it general:
  no sub-systems, no suppliers, no cause.
MARKDOWN

puts path
