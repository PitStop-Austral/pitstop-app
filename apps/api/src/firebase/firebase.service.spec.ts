import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

import { FirebaseService } from './firebase.service';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(),
}));

describe('FirebaseService', () => {
  let verifyIdToken: jest.Mock;
  let deleteFile: jest.Mock;

  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = 'test-key';
    process.env.FIREBASE_STORAGE_BUCKET = 'test-project.firebasestorage.app';

    verifyIdToken = jest.fn();
    deleteFile = jest.fn();
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
    (getStorage as jest.Mock).mockReturnValue({
      bucket: jest.fn(() => ({ file: jest.fn(() => ({ delete: deleteFile })) })),
    });
  });

  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_STORAGE_BUCKET;
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

  it('deletes a Storage file without failing when it is already absent', async () => {
    const service = new FirebaseService();

    await expect(
      service.deleteFile('user-1/vehicles/vehicle-1/photo.webp'),
    ).resolves.toBeUndefined();
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: true });
  });
});
