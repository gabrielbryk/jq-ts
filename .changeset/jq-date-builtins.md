---
'@gabrielbryk/jq-ts': minor
---

Implement the jq date/time builtins: `now`, `gmtime`, `localtime`, `mktime`, `strftime`, `strflocaltime`, `strptime`, `todate`, `todateiso8601`, `fromdate`, and `fromdateiso8601`.

These match the jq 1.8 binary, including the broken-down time array layout `[year, month, mday, hour, min, sec, wday, yday]`, fractional seconds, the `%V`/`%G`/`%u`/`%I`/`%p` strftime specifiers, and `strftime`/`strflocaltime` accepting either a broken-down array or an epoch number.

`now` is clock-injectable via the new `EvalOptions.now` option (a `Date` or epoch seconds) and throws when no clock is supplied, so jq-ts never reads the host clock on its own and date programs stay deterministic. The other date builtins are pure functions of their input.
