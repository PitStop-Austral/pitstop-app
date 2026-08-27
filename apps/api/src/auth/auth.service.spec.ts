import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UsersRepository } from '../modules/users/users.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let upsertByFirebaseUid: jest.MockedFunction<UsersRepository['upsertByFirebaseUid']>;

  beforeEach(async () => {
    upsertByFirebaseUid = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: UsersRepository, useValue: { upsertByFirebaseUid } }],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('upserts using the token name when present', async () => {
    const user = { id: 'uuid-1', firebaseUid: 'uid-1', email: 'a@b.com', name: 'Ada' };
    upsertByFirebaseUid.mockResolvedValue(user as never);

    const result = await authService.syncUser({
      uid: 'uid-1',
      email: 'a@b.com',
      name: 'Ada',
    } as Partial<DecodedIdToken> as DecodedIdToken);

    expect(upsertByFirebaseUid).toHaveBeenCalledWith('uid-1', 'a@b.com', 'Ada');
    expect(result).toBe(user);
  });

  it('falls back to the email local-part when the token has no name', async () => {
    upsertByFirebaseUid.mockResolvedValue({} as never);

    await authService.syncUser({
      uid: 'uid-2',
      email: 'driver@example.com',
    } as Partial<DecodedIdToken> as DecodedIdToken);

    expect(upsertByFirebaseUid).toHaveBeenCalledWith('uid-2', 'driver@example.com', 'driver');
  });

  it('throws Unauthorized when the token has no email', async () => {
    await expect(
      authService.syncUser({ uid: 'uid-3' } as Partial<DecodedIdToken> as DecodedIdToken),
    ).rejects.toThrow(UnauthorizedException);
    expect(upsertByFirebaseUid).not.toHaveBeenCalled();
  });
});
