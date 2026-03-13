---
"@nmi-agro/fdm-app": patch
---

Fix: remove the `signal.aborted` check from inside the `for await` loop so FlatGeobuf always completes its HTTP exchange cleanly. The abort guard before `setData()` is kept, so stale data is still never rendered after a map pan.

Additionally, append `?v={APP_VERSION}` to the FlatGeobuf file URL so that users who already have a corrupted browser cache get a fresh cache key on the next deploy.
