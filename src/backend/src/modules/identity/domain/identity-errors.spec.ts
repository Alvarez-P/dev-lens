import {
  InvalidOAuthState,
  UnknownOAuthProvider,
  MissingOAuthCode,
  IdentityAlreadyLinked,
  CannotUnlinkSoleIdentity,
} from './identity-errors';

describe('InvalidOAuthState', () => {
  it('should create with correct code and status', () => {
    const error = new InvalidOAuthState();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidOAuthState');
    expect(error.code).toBe('INVALID_OAUTH_STATE');
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('Invalid OAuth state');
  });
});

describe('UnknownOAuthProvider', () => {
  it('should create with provider name in message', () => {
    const error = new UnknownOAuthProvider('bitbucket');

    expect(error.code).toBe('UNKNOWN_OAUTH_PROVIDER');
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('bitbucket');
  });
});

describe('MissingOAuthCode', () => {
  it('should create with correct code', () => {
    const error = new MissingOAuthCode();

    expect(error.code).toBe('MISSING_OAUTH_CODE');
    expect(error.statusCode).toBe(400);
  });
});

describe('IdentityAlreadyLinked', () => {
  it('should create with correct code, status and provider info', () => {
    const error = new IdentityAlreadyLinked('github', 'gh_12345');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('IDENTITY_ALREADY_LINKED');
    expect(error.statusCode).toBe(409);
    expect(error.message).toContain('github');
    expect(error.message).toContain('gh_12345');
  });
});

describe('CannotUnlinkSoleIdentity', () => {
  it('should create with correct code and status', () => {
    const error = new CannotUnlinkSoleIdentity();

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('CANNOT_UNLINK_SOLE_IDENTITY');
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('Cannot unlink');
  });
});
