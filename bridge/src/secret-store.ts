/**
 * Platform-neutral storage boundary for the connector's encrypted state.
 * Implementations must use the operating system's protected credential store.
 */
export interface SecretStore {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  delete(): Promise<void>;
}
