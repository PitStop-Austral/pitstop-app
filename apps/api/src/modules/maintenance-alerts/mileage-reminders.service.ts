import { Injectable, Logger } from '@nestjs/common';
import {
  FirebaseService,
  getFirebaseMessagingErrorCode,
  isStaleFirebaseMessagingTokenError,
} from '../../firebase/firebase.service';
import {
  MileageRemindersRepository,
  type EligibleMileageReminderVehicle,
  type MileageReminderCandidate,
  type MileageReminderClaim,
} from './mileage-reminders.repository';
import {
  MILEAGE_REMINDER_AFTER_DAYS,
  mileageReminderPeriod,
  mileageReminderPeriodKey,
} from './mileage-reminders';

export type MileageReminderRunResult = {
  sent: number;
  failed: number;
  skipped: number;
};

type DeliveryCandidate = MileageReminderCandidate & {
  title: string;
  body: string;
};

type DeliveryResult = 'sent' | 'failed' | 'skipped';
type FirebaseDeliveryResult =
  | { status: 'sent'; messageId: string }
  | { status: 'failed'; error: unknown };

const DAY_IN_MILLISECONDS = 86_400_000;
const DELIVERY_CONCURRENCY = 8;

@Injectable()
export class MileageRemindersService {
  private readonly logger = new Logger(MileageRemindersService.name);

  constructor(
    private readonly mileageRemindersRepository: MileageRemindersRepository,
    private readonly firebaseService: FirebaseService,
  ) {}

  async runDailyReview(now = new Date()): Promise<MileageReminderRunResult> {
    const cutoff = new Date(now.getTime() - MILEAGE_REMINDER_AFTER_DAYS * DAY_IN_MILLISECONDS);
    const vehicles = await this.mileageRemindersRepository.findEligibleVehicles(cutoff);
    const candidates = this.buildCandidates(vehicles, now);
    const deliveryGroups = new Map<string, DeliveryCandidate[]>();
    for (const candidate of candidates) {
      const group = deliveryGroups.get(candidate.installationId) ?? [];
      group.push(candidate);
      deliveryGroups.set(candidate.installationId, group);
    }

    const results: DeliveryResult[] = [];
    const groups = [...deliveryGroups.values()];
    for (let index = 0; index < groups.length; index += DELIVERY_CONCURRENCY) {
      const batch = await Promise.allSettled(
        groups
          .slice(index, index + DELIVERY_CONCURRENCY)
          .map((group) => this.claimAndDeliverSequentially(group)),
      );
      let infrastructureFailure: PromiseRejectedResult | undefined;
      for (const result of batch) {
        if (result.status === 'fulfilled') results.push(...result.value);
        else infrastructureFailure ??= result;
      }
      if (infrastructureFailure) throw infrastructureFailure.reason;
    }

    return {
      sent: results.filter((result) => result === 'sent').length,
      failed: results.filter((result) => result === 'failed').length,
      skipped: results.filter((result) => result === 'skipped').length,
    };
  }

  private buildCandidates(
    vehicles: EligibleMileageReminderVehicle[],
    now: Date,
  ): DeliveryCandidate[] {
    return vehicles.flatMap((vehicle) => {
      const period = mileageReminderPeriod(vehicle.mileageUpdatedAt, now);
      if (period === null) return [];
      const days = Math.floor(
        (now.getTime() - vehicle.mileageUpdatedAt.getTime()) / DAY_IN_MILLISECONDS,
      );
      const vehicleName = vehicle.nickname?.trim() || `${vehicle.brand} ${vehicle.model}`;

      return vehicle.owner.notificationDevices.map((device) => ({
        vehicleId: vehicle.id,
        ownerId: vehicle.owner.id,
        mileageUpdatedAt: vehicle.mileageUpdatedAt,
        installationId: device.installationId,
        notificationDeviceId: device.id,
        token: device.token,
        periodKey: mileageReminderPeriodKey(vehicle.mileageUpdatedAt, period),
        title: 'Actualizá el kilometraje',
        body: `${vehicleName} (${vehicle.plate}): pasaron ${days} días desde la última actualización.`,
      }));
    });
  }

  private async claimAndDeliverSequentially(group: DeliveryCandidate[]): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];
    for (const candidate of group) {
      const claim = await this.mileageRemindersRepository.claimDelivery(candidate);
      if (!claim) {
        results.push('skipped');
        continue;
      }
      results.push(await this.deliver(claim, candidate));
    }
    return results;
  }

  private async deliver(
    claim: MileageReminderClaim,
    candidate: DeliveryCandidate,
  ): Promise<DeliveryResult> {
    const result = await this.mileageRemindersRepository.withCurrentContextLock(
      candidate,
      async (): Promise<FirebaseDeliveryResult> => {
        try {
          const messageId = await this.firebaseService.sendDataMessage(candidate.token, {
            kind: 'mileage-reminder',
            notificationId: claim.id,
            title: candidate.title,
            body: candidate.body,
            vehicleId: candidate.vehicleId,
          });
          return { status: 'sent', messageId };
        } catch (error) {
          return { status: 'failed', error };
        }
      },
    );

    if (result === null) {
      await this.mileageRemindersRepository.markFailed(claim.id, 'context-changed');
      return 'failed';
    }
    if (result.status === 'failed') {
      const errorCode = getFirebaseMessagingErrorCode(result.error) ?? 'unknown';
      await this.mileageRemindersRepository.markFailed(claim.id, errorCode);
      if (isStaleFirebaseMessagingTokenError(result.error) && claim.notificationDeviceId) {
        await this.mileageRemindersRepository.removeDeviceIfTokenMatches(
          claim.notificationDeviceId,
          candidate.token,
        );
      }
      this.logger.warn(`Mileage reminder delivery failed with code: ${errorCode}`);
      return 'failed';
    }

    await this.mileageRemindersRepository.markSent(claim.id, result.messageId);
    return 'sent';
  }
}
