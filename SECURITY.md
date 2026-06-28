# Security Policy

## Supported Versions

The latest released version of jq-ts is supported for security updates. If you're using an earlier minor version (e.g., 1.4.x), we recommend upgrading to the latest 1.x release to receive fixes.

```
Version | Supported
---------|----------
1.x (latest) | ✓
< 1.0    | ✗
```

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately in one of these ways:

1. **Preferred:** Use GitHub's private vulnerability reporting feature: https://github.com/gabrielbryk/jq-ts/security/advisories/new
2. **Alternative:** Email me@gabebryk.com with details of the vulnerability

We ask that you include:

- Description of the vulnerability
- Steps to reproduce (if applicable)
- Affected versions
- Your suggested fix (if you have one)

## Response Timeline

- We aim to acknowledge receipt within a few days
- We work with you on a coordinated disclosure timeline
- Once a fix is available, we'll release a patched version and publicly disclose the vulnerability

## Threat Model

jq-ts evaluates **untrusted jq expressions** deterministically with execution limits and no I/O access. The primary security surface is:

- **Sandbox escapes:** Attempts to bypass execution limits (maxSteps, maxDepth, maxOutputs)
- **Host access:** Attempts to access the filesystem, network, environment, or system time
- **Unbounded computation:** Resource exhaustion through infinite loops or exponential complexity

Expressions cannot call functions outside the jq sandbox, access external state, or produce side effects.

## License

By reporting a vulnerability, you agree to responsible disclosure practices.
