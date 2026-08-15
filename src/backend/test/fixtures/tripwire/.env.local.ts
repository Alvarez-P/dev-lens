// Fake secret planted in a source-eligible (.ts) file whose NAME matches the
// .env* deny-list (REQ-CA-004). The manifest extension filter passes it — it
// reaches the manifest and the IR — so ONLY the SourceFileFilter deny-list
// (rule '.env*') can keep its signatures out of AI context. The fake secret is
// embedded in the class decorator as a string literal so it WOULD surface in a
// signature-only sketch if the deny-list did not exclude this file.
// Never a real credential.
function envDecorator(_options: unknown): (target: object) => void {
  return () => undefined;
}

@envDecorator({ secret: 'sk-tripwire-super-secret-9f3a1c' })
export class LocalEnvConfig {
  getSecret(): string {
    return 'sk-tripwire-super-secret-9f3a1c';
  }
}
