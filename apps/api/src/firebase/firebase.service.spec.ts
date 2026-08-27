import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { FirebaseService } from './firebase.service';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

describe('FirebaseService', () => {
  let verifyIdToken: jest.Mock;

  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = 'test-key';

    verifyIdToken = jest.fn();
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
  });

  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    jest.clearAllMocks();
  });

  it('throws when required env vars are missing', () => {
    delete process.env.FIREBASE_PROJECT_ID;

    expect(() => new FirebaseService()).toThrow(/FIREBASE_PROJECT_ID/);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('resolves with the decoded token uid for a valid token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'abc123' });

    const service = new FirebaseService();

    await expect(service.verifyIdToken('valid-token')).resolves.toEqual(
      expect.objectContaining({ uid: 'abc123' }),
    );
  });

  it('rejects instead of crashing for an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const service = new FirebaseService();

    await expect(service.verifyIdToken('bad-token')).rejects.toThrow('invalid token');
  });

  it('reuses an already-initialized app instead of calling initializeApp again', () => {
    const existingApp = { name: '[DEFAULT]' };
    (getApps as jest.Mock).mockReturnValue([existingApp]);

    new FirebaseService();

    expect(initializeApp).not.toHaveBeenCalled();
  });
});
