# frozen_string_literal: true

# Every time on this site is Belgian local time. Announcements are written by
# hand, and "2026-09-19 09:30:00 +02:00" is a lot of ceremony - and a DST trap
# twice a year - for someone who just wants to say half past nine.
#
# YAML reads a timestamp without an offset as UTC. Left alone, Jekyll then
# renders a bare "09:30" as 09:30 in the visible text but as 11:30+02:00 in the
# <time datetime> attribute that assets/js/status.js reads, so the page would
# move an entry between Current, Planned and the history at the wrong moment.
#
# This generator re-reads those offset-less timestamps as wall-clock time in
# the site timezone, so 09:30 means 09:30 here, in summer and in winter. A
# timestamp written with an explicit non-zero offset is left exactly as it is,
# so older announcements keep rendering correctly.
module VibDataCore
  class LocalTimes < Jekyll::Generator
    safe true
    priority :highest

    FIELDS = %w[start end].freeze

    def generate(site)
      site.collections.each_value do |collection|
        collection.docs.each { |doc| localize_document(doc) }
      end
    end

    private

    def localize_document(doc)
      FIELDS.each do |field|
        doc.data[field] = localize(doc.data[field]) if doc.data.key?(field)
      end

      updates = doc.data["updates"]
      return unless updates.is_a?(Array)

      updates.each do |update|
        update["time"] = localize(update["time"]) if update.is_a?(Hash) && update.key?("time")
      end
    end

    # Jekyll has already put `timezone:` from _config.yml into ENV["TZ"], so
    # Time.local picks the right offset for that date, DST included.
    def localize(value)
      case value
      when Time
        return value unless value.utc_offset.zero?

        Time.local(value.year, value.month, value.day, value.hour, value.min, value.sec)
      when DateTime
        return value.to_time unless value.offset.zero?

        Time.local(value.year, value.month, value.day, value.hour, value.min, value.sec)
      when Date
        Time.local(value.year, value.month, value.day)
      else
        value
      end
    end
  end
end
