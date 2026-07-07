/**
 * Onboarding group — placeholder for Session 1 (§7.1).
 * Phase 0 ships the route shell; screens are built in Session 1.
 */
import { Redirect } from 'expo-router';

export default function OnboardingGroup() {
  // No auth wired yet in Phase 0 — redirect to main board placeholder.
  return <Redirect href="/(main)" />;
}
