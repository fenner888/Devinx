# App Review handoff template

Do not place credentials in this repository. Enter the final non-production review credential only in App Store Connect's private review fields.

## Review notes

DevinX is an independent mobile client for the Devin API and is not affiliated with Cognition AI. Reviewers can test the complete cloud path with the non-production Devin credential provided privately in App Store Connect.

1. Open DevinX and choose **Devin Cloud**.
2. Enter the supplied non-production credential and complete validation.
3. From Home, create a harmless session or open an existing review session.
4. Open Sessions to verify search, status, and session detail.
5. Open Settings → Privacy to review the in-app data-flow disclosure and full privacy-policy link.

The optional **Computer** path requires DevinX Connector on a user-controlled Mac plus Tailscale and explicit local approval. It is not required to use Devin Cloud. If Apple requests computer-path review, provide a dedicated Mac/Connector setup and review instructions through private App Review correspondence; never place a shared server password, Devin credential, pairing payload, or Tailscale key in review notes.

## Private fields to complete

- Review username or account label: `PROVIDE_IN_APP_STORE_CONNECT`
- Review credential: `PROVIDE_IN_APP_STORE_CONNECT`
- Credential expiration/rotation owner: `PROVIDE_IN_APP_STORE_CONNECT`
- Review contact name, email, and phone: `PROVIDE_IN_APP_STORE_CONNECT`
- Any test-session title or expected response: use non-sensitive review-only content

Before submission, verify the credential on a clean install of the exact selected build and confirm it cannot access production/customer data.
