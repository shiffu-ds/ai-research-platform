# Container Security Scan Findings

## Scan Date

2026-09-23

## Scanner

Trivy

## Images Scanned

- postgres:16-alpine
- redis:7-alpine

---

## Redis

Image:

```text
redis:7-alpine
```

Result:

```text
HIGH: 0
CRITICAL: 0
```

Status:

```text
PASS
```

---

## PostgreSQL

Image:

```text
postgres:16-alpine
```

### Alpine OS Layer

Result:

```text
HIGH: 0
CRITICAL: 0
```

Status:

```text
PASS
```

### gosu Binary

Location:

```text
/usr/local/bin/gosu
```

Result:

```text
HIGH: 21
CRITICAL: 1
```

Critical vulnerability:

```text
CVE-2025-68121
```

Installed Go standard-library version detected by Trivy:

```text
v1.24.6
```

Fixed versions reported by Trivy include:

```text
1.24.13
1.25.7
1.26.0-rc.3
```

Status:

```text
FAIL FOR PRODUCTION
```

---

## Security Decision

The PostgreSQL image may continue to be used for local development and testing.

It must not be approved for production while a CRITICAL vulnerability remains.

No production security exception has been approved.

Before production deployment, M5 must:

- rescan the image
- use an updated or hardened image if required
- verify that no CRITICAL vulnerabilities remain
- document risk acceptance for any remaining HIGH findings

## Security Policy

- CRITICAL vulnerabilities block production.
- HIGH vulnerabilities require explicit risk acceptance.
