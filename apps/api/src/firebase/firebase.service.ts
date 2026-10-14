import { Injectable } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

const STALE_MESSAGING_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const MESSAGING_ERROR_CODE_PATTERN = /^messaging\/[a-z-]+$/;

export function getFirebaseMessagingErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' && MESSAGING_ERROR_CODE_PATTERN.test(error.code)
    ? error.code
    : undefined;
}

export function isStaleFirebaseMessagingTokenError(error: unknown): boolean {
  const code = getFirebaseMessagingErrorCode(error);
  return code !== undefined && STALE_MESSAGING_TOKEN_ERROR_CODES.has(code);
}

@Injectable()
export class FirebaseService {
  private readonly app: App;
  private readonly storageBucket: string;

  constructor() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!projectId || !clientEmail || !privateKey || !storageBucket) {
      throw new Error(
        'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_STORAGE_BUCKET are required to connect to Firebase',
      );
    }

    this.storageBucket = storageBucket;

    this.app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
  }

  verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return getAuth(this.app).verifyIdToken(idToken);
  }

  sendMessage(message: Message): Promise<string> {
    return getMessaging(this.app).send(message);
  }

  sendDataMessage(token: string, data: Record<string, string>): Promise<string> {
    return this.sendMessage({ token, data });
  }

  async deleteFile(path: string): Promise<void> {
    await getStorage(this.app)
      .bucket(this.storageBucket)
      .file(path)
      .delete({ ignoreNotFound: true });
  }
}
