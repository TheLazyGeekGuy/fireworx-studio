# Host browser-session recovery

An optional `EditorViewContext.recovered` flag identifies a restored browser session. Old hosts omit it and retain normal first-connection behavior. SDK, view, device-state schema and wire-operation validators are unchanged.

On recovery, preserve the local draft and allow the host to restore the previously selected endpoint pair. Do not automatically replace the draft with a device dump or replay a previous write grant. Explicit read/connect controls remain available. MIDI Studio owns workspace persistence; this module retains standalone operation and its own profile formats.

BCR32 retains firmware probing but skips initial assignment/global reads and uses the restored port selection. Mx000 identifies the resumed pair without reading over its draft; automatic edit-buffer arming is initially off on recovery. FireworX retains the recovered local capture and does not start automatic P0/live initialization. A subsequent explicit physical read establishes a fresh hardware reference for writes.

Source read: `ae34bc2161f5e9b3f648f98bf9727034453c44e3`, plus the local recovery context/adapter changes in this commit. Primary Codex, no sub-agents; exact model identifier and effort unavailable (model-version trace incomplete). Read/test: 24 October 2026, approximately 22:40–22:50 Europe/Paris. Existing offline module suites pass. Hardware feedback, persistent device storage and deployed public application behavior were not tested or changed by this source correction.
