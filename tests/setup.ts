// Sentry's React Native module starts internal cleanup intervals at import
// time. Unit tests assert DevinX's scrubber inputs directly and must not start
// an SDK runtime or leave background handles behind.
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  init: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
}));
