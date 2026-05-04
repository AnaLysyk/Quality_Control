Render Outbound IP Addresses

Network requests from the Render service will originate from shared regional IP ranges. Whitelist these ranges in any external services (databases, APIs, firewalls) that must accept traffic from the app.

Provided ranges:

- 74.220.48.0/24
- 74.220.56.0/244  # provided by user; validate mask (likely /24)

Notes:
- These IPs are shared by other Render services in the same region and are not unique to your service.
- Confirm the second CIDR (`74.220.56.0/244`) — typical CIDR masks go up to /32; if you meant `/24` please update accordingly.
- If using managed DBs with IP allowlists, add these ranges before deploying so outbound connections (e.g., webhooks, external APIs) can be received where applicable.

If you want, I can:
- Correct the second CIDR to `/24` if that was intended and commit the fix.
- Add these notes to the PR description or `PRS_MIGRATION_INSTRUCTIONS.md`.
- Create a small checklist for ops to configure the Render service and environment variables.
