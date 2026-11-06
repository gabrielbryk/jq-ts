---
'@gabrielbryk/jq-ts': patch
---

Bind `as` to the last stage of a pipe, as jq does: `.a | . as $t | .n` now runs the body on `.a`, not on the pipe's input.
