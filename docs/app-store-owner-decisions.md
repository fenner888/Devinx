# App Store owner decisions

Prepared: July 13, 2026

This packet contains the remaining human, legal, commercial, and physical decisions for App Store
version 1.0. It is not permission to submit App Review or release the app. Build `0.1.0 (67)` is the
current signed iPhone-only candidate; Apple processing completed and the owner installed it from
TestFlight. Select it only after the remaining physical acceptance checks and the narrow
visual/setup-link spot-check pass.

## Recommended launch choices

### Price and distribution

Recommended initial choice:

- **Free** app;
- **Public** distribution;
- no pre-order;
- keep Apple-silicon Mac and Vision Pro availability disabled until each surface is validated;
- begin with the English-language storefronts the owner is prepared to support, then expand only
  after territory-specific content-rights and compliance obligations are confirmed.

Apple requires a price and availability before review. A paid price also requires the Paid Apps
Agreement. The owner must approve the exact storefront list; the agent must not infer it.

### Age rating

Recommended truthful capability answers:

- Parental Controls: **No**
- Age Assurance: **No**
- Unrestricted Web Access: **No** — DevinX does not ship a general-purpose in-app browser
- User-Generated Content: **Yes** — users author prompts and can view account/session content
- Social Media: **No**
- Messaging and Chat: **Yes** — users send prompts and follow-up messages to Devin sessions
- Advertising: **No**
- all mature-theme, medical, sexuality/nudity, violence, and chance-based descriptors: answer from
  the app's actual supported experience and test evidence, not from a desired rating
- Made for Kids: **No**
- Override to Higher Age Rating: **Not Applicable** unless the governing Devin terms or the owner's
  intended audience impose a higher minimum age

Let App Store Connect calculate the regional ratings from the questionnaire. Do not force a lower
rating. Apple documents the questionnaire and regional calculation at
<https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/>.

### Content Rights

DevinX accesses third-party content and displays third-party names or marks. The truthful declaration
is therefore the branch stating that the app contains, shows, or accesses third-party content. Do
not complete the accompanying rights warranty until the owner has retained evidence that the app is
authorized or otherwise legally permitted to use:

- the Devin name and references to Cognition;
- the owner-supplied companion artwork;
- model-provider names and bundled provider marks;
- repository, pull-request, and session content shown through a user's connected account.

An unofficial-client disclaimer is important but is not itself a rights grant. If the evidence is
not sufficient, remove or replace the affected marks before submission. Apple describes the field
at <https://developer.apple.com/help/app-store-connect/reference/app-information/app-information>.

### Digital Services Act

App Store Connect currently identifies this developer as a **non-trader** for DevinX. Apple requires
the developer to self-assess this status and says professional or business activity may indicate
trader status. The owner must confirm the legal choice and, if applicable, complete Apple's contact
verification before including EU storefronts. See
<https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/>.

## Required owner-supplied fields

Enter these directly in App Store Connect; never commit review credentials:

- copyright holder and year;
- review contact first name, last name, phone number, and email;
- a private non-production Devin review account or credential with the minimum scope needed for the
  documented Cloud review path;
- final storefront list;
- final Content Rights confirmation and retained evidence;
- final DSA trader decision and verification, if required.

## Privacy publication approval

The local `PRIVACY.md` is newer and materially more complete than `origin/main:PRIVACY.md`. The
public URL therefore does not yet match the Build 66 data flow. Required sequence:

1. Owner explicitly approves publishing the frozen local policy.
2. Publish that exact file to the public privacy URL.
3. Fetch the public file and byte-verify it against the approved local file.
4. Compare App Store Connect's unpublished privacy answers line by line with
   `docs/app-privacy-review.md` and the final binary.
5. Only then publish the App Privacy answers.

## Screenshot handoff

The six final iPhone 6.5-inch compositions are prepared at `1242 x 2688` under
`artifacts/app-store/screenshots/iphone-6.5/final/`. Build 67 is the verified, processed, and installed
iPhone-only screenshot and release candidate; physically spot-check it before these images are uploaded. No iPad
set is required for the initial release. The Security Work composition must remain based on a genuine
`origin = code_scan` root; omit it if that provenance cannot be retained.

## Connector distribution checkpoint

Connector 0.1.0 is published from the official GitHub release with a Developer ID signature,
notarization ticket, staple, adjacent checksum, and Gatekeeper acceptance. The current-account
non-admin lifecycle path passed. A separate fresh-account install/startup/update/repair/uninstall
exercise remains a hardening follow-up; it is not represented as completed evidence.

## Final stop boundary

After screenshots, metadata, privacy publication, physical acceptance, and Connector signing are
complete, perform one final product-page audit. Stop before **Add for Review** until the owner gives
separate explicit approval. After approval, keep manual release enabled and stop again before the
public release action unless separately authorized.
