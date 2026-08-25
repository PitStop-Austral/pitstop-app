import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseAuthError } from 'firebase-admin/auth';

import { FirebaseController } from './firebase.controller';
import { FirebaseService } from './firebase.service';

// firebase-admin/auth pulls in the ESM-only `jose` package, which Jest's module loader cannot
// transform (Node itself loads it fine via native require(esm)). Mock it so this spec never
// touches the real firebase-admin/auth module graph.
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
  FirebaseAuthError: class FirebaseAuthError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  },
}));

describe('FirebaseController', () => {
  let controller: FirebaseController;
  let verifyIdToken: jest.Mock;

  beforeEach(async () => {
    verifyIdToken = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FirebaseController],
      providers: [{ provide: FirebaseService, useValue: { verifyIdToken } }],
    }).compile();

    controller = module.get<FirebaseController>(FirebaseController);
  });

  it('returns the uid for a valid bearer token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'abc123' });

    await expect(controller.whoami('Bearer valid-token')).resolves.toEqual({ uid: 'abc123' });
  });

  it('throws Unauthorized when the header is missing', async () => {
    await expect(controller.whoami(undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('throws Unauthorized for an invalid or expired token', async () => {
    verifyIdToken.mockRejectedValue(
      new FirebaseAuthError({ code: 'id-token-expired', message: 'expired' }),
    );

    await expect(controller.whoami('Bearer expired-token')).rejects.toThrow(UnauthorizedException);
  });

  it('throws InternalServerError instead of leaking details for unexpected failures', async () => {
    verifyIdToken.mockRejectedValue(new Error('network unreachable'));

    await expect(controller.whoami('Bearer some-token')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
