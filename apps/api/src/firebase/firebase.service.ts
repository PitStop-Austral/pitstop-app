import { Injectable } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

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

  async deleteFile(path: string): Promise<void> {
    await getStorage(this.app)
      .bucket(this.storageBucket)
      .file(path)
      .delete({ ignoreNotFound: true });
  }
}
