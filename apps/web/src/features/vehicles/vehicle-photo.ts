import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { auth, storage } from '@/lib/firebase';
import { validatePhotoFile } from '@/lib/vehicle-photo-validation';

const MAX_PHOTO_DIMENSION = 1280;

export { validatePhotoFile };

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No pudimos leer esa imagen. Probá con otra.'));
      },
      type,
      0.8,
    );
  });
}

export async function resizePhoto(file: File): Promise<Blob> {
  let image: ImageBitmap;

  try {
    image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No pudimos leer esa imagen. Probá con otra.');
  }

  const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    image.close();
    throw new Error('No pudimos leer esa imagen. Probá con otra.');
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  const webp = await canvasToBlob(canvas, 'image/webp');
  return webp.type === 'image/webp' ? webp : canvasToBlob(canvas, 'image/jpeg');
}

export async function uploadVehiclePhoto(
  vehicleId: string,
  blob: Blob,
): Promise<{ photoPath: string; photoUrl: string }> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('No pudimos subir la foto. Volvé a iniciar sesión.');

  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const photoPath = `${userId}/vehicles/${vehicleId}/${Date.now()}.${extension}`;
  const photoRef = ref(storage, photoPath);

  await uploadBytes(photoRef, blob, {
    contentType: blob.type,
    cacheControl: 'public,max-age=31536000',
  });

  return { photoPath, photoUrl: await getDownloadURL(photoRef) };
}
