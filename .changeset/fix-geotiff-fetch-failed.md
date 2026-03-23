---
"@nmi-agro/fdm-calculator": patch
---

Fix intermittent `fetch failed` errors during GeoTIFF processing by implementing a multi-layered defense strategy:
- **Hybrid Loading**: Small files (<= 2MB) are now buffered in RAM to eliminate excessive HTTP Range requests.
- **Concurrency Throttling**: Added a semaphore to limit concurrent raster reads, protecting the socket pool.
- **Robustness**: Integrated 10s timeouts, `AbortSignal` support for request cancellation, and automatic retries with exponential backoff for transient network failures.
