# Security and operations

## Session configuration

Production requires a six-digit `GEMSTEPS_PIN` and a separately generated
`GEMSTEPS_SESSION_SECRET`. Generate the secret from at least 32 random bytes and
store it as a sensitive environment variable. Runtime byte-length validation is
only a minimum guard; it cannot measure the secret's entropy.

```sh
openssl rand -base64 32
```

The session token signs its version and absolute expiration with the session
secret. The configured PIN is included in the signed message, but is never used
as the HMAC key. Rotating either the PIN or the secret invalidates every
outstanding token.

Local lock and `DELETE /api/auth` do not revoke a copied token. Unless the PIN or
secret is rotated, a copied token remains valid until its embedded expiration.

## Mandatory production WAF rules

Both rules below are mandatory before exposing the authentication code in
Production.

```text
Name: gemsteps-auth-pin-ip-limit
Condition: Request Path equals /api/auth AND Request Method equals POST
Action: Rate Limit
Algorithm: Fixed Window
Window: 60 seconds
Limit: 5 requests
Key: IP
Response: 429

Name: gemsteps-auth-pin-ja4-limit
Condition: Request Path equals /api/auth AND Request Method equals POST
Action: Rate Limit
Algorithm: Fixed Window
Window: 60 seconds
Limit: 5 requests
Key: JA4 Digest
Response: 429
```

First observe matching Preview traffic in Log mode and capture evidence. Then
publish both rules in Rate Limit mode before the production deployment. These
steps require explicit authorization for external changes; this repository task
documents them but does not publish rules, deploy, or otherwise modify Vercel.
