import { Injectable, Logger } from '@nestjs/common';
import {
  FirebaseService,
  getFirebaseMessagingErrorCode,
  isStaleFirebaseMessagingTokenError,
} from '../../firebase/firebase.service';
import { computeScheduleDue, type ScheduleStatus } from '../schedules/schedule-due';
import { argentinaDateToday } from '../schedules/schedule-date';
import {
  MaintenanceAlertsRepository,
  type EligibleAlertSchedule,
  type MaintenanceAlertClaim,
  type MaintenanceAlertClaimCandidate,
} from './maintenance-alerts.repository';

export type MaintenanceAlertRunResult = {
  selected: number;
  claimed: number;
  sent: number;
  failed: number;
};

type DeliveryCandidate = MaintenanceAlertClaimCandidate & {
  notificationDeviceId: string;
  token: string;
  vehicleId: string;
  title: string;
  body: string;
  status: Exclude<ScheduleStatus, 'on_track'>;
};

type DeliveryResult = 'sent' | 'failed' | 'skipped';
type FirebaseDeliveryResult =
  | { status: 'sent'; messageId: string }
  | { status: 'failed'; error: unknown };
const DELIVERY_CONCURRENCY = 8;

@Injectable()
export class MaintenanceAlertsService {
  private readonly logger = new Logger(MaintenanceAlertsService.name);

  constructor(
    private readonly maintenanceAlertsRepository: MaintenanceAlertsRepository,
    private readonly firebaseService: FirebaseService,
  ) {}

  async runDailyReview(): Promise<MaintenanceAlertRunResult> {
    const schedules = await this.maintenanceAlertsRepository.findEligibleSchedules();
    const candidates = this.buildCandidates(schedules, argentinaDateToday());
    const deliveryGroups = new Map<string, DeliveryCandidate[]>();
    for (const candidate of candidates) {
      const group = deliveryGroups.get(candidate.installationId) ?? [];
      group.push(candidate);
      deliveryGroups.set(candidate.installationId, group);
    }

    const groups = [...deliveryGroups.values()];
    const deliveryResults: DeliveryResult[] = [];
    for (let index = 0; index < groups.length; index += DELIVERY_CONCURRENCY) {
      const batch = await Promise.allSettled(
        groups
          .slice(index, index + DELIVERY_CONCURRENCY)
          .map((group) => this.claimAndDeliverSequentially(group)),
      );
      let infrastructureFailure: PromiseRejectedResult | undefined;
      for (const result of batch) {
        if (result.status === 'fulfilled') deliveryResults.push(...result.value);
        else infrastructureFailure ??= result;
      }
      if (infrastructureFailure) throw infrastructureFailure.reason;
    }

    return {
      selected: candidates.length,
      claimed: deliveryResults.filter((result) => result !== 'skipped').length,
      sent: deliveryResults.filter((result) => result === 'sent').length,
      failed: deliveryResults.filter((result) => result === 'failed').length,
    };
  }

  private async claimAndDeliverSequentially(group: DeliveryCandidate[]): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];
    for (const candidate of group) {
      const {
        vehicleId: _vehicleId,
        title: _title,
        body: _body,
        status: _status,
        ...claimInput
      } = candidate;
      const [claim] = await this.maintenanceAlertsRepository.claimDeliveries([claimInput]);
      if (!claim) {
        results.push('skipped');
        continue;
      }
      results.push(await this.deliver(claim, candidate));
    }
    return results;
  }

  private buildCandidates(schedules: EligibleAlertSchedule[], today: Date): DeliveryCandidate[] {
    return schedules.flatMap((schedule) => {
      const owner = schedule.vehicle.owner;
      const due = computeScheduleDue(schedule, {
        currentMileage: schedule.vehicle.mileage,
        today,
        thresholdDays: owner.upcomingThresholdDays,
        thresholdKm: owner.upcomingThresholdKm,
      });
      if (due.status === 'on_track') return [];

      const status = due.status;
      const vehicleName =
        schedule.vehicle.nickname?.trim() || `${schedule.vehicle.brand} ${schedule.vehicle.model}`;
      const title = status === 'overdue' ? 'Mantenimiento vencido' : 'Mantenimiento próximo';
      const body = `${vehicleName} (${schedule.vehicle.plate}): ${schedule.type}`;
      const dueKey = this.dueKey(due.nextDueDate, due.nextDueMileage);

      return owner.notificationDevices.map((device) => ({
        scheduleId: schedule.id,
        installationId: device.installationId,
        notificationDeviceId: device.id,
        dueKey,
        dueDate: due.nextDueDate,
        dueMileage: due.nextDueMileage,
        ownerId: owner.id,
        token: device.token,
        vehicleId: schedule.vehicle.id,
        title,
        body,
        status,
      }));
    });
  }

  private async deliver(
    claim: MaintenanceAlertClaim,
    candidate: DeliveryCandidate,
  ): Promise<DeliveryResult> {
    const result = await this.maintenanceAlertsRepository.withCurrentDeviceLock(
      {
        id: candidate.notificationDeviceId,
        ownerId: candidate.ownerId,
        installationId: candidate.installationId,
        token: candidate.token,
      },
      async (): Promise<FirebaseDeliveryResult> => {
        try {
          const messageId = await this.firebaseService.sendDataMessage(candidate.token, {
            kind: 'maintenance-alert',
            notificationId: claim.id,
            title: candidate.title,
            body: candidate.body,
            vehicleId: candidate.vehicleId,
            scheduleId: candidate.scheduleId,
            status: candidate.status,
          });
          return { status: 'sent', messageId };
        } catch (error) {
          return { status: 'failed', error };
        }
      },
    );

    if (result === null) {
      await this.maintenanceAlertsRepository.markFailed(claim.id, 'device-changed');
      return 'failed';
    }
    if (result.status === 'failed') {
      const errorCode = getFirebaseMessagingErrorCode(result.error) ?? 'unknown';
      await this.maintenanceAlertsRepository.markFailed(claim.id, errorCode);
      if (isStaleFirebaseMessagingTokenError(result.error) && claim.notificationDeviceId) {
        await this.maintenanceAlertsRepository.removeDeviceIfTokenMatches(
          claim.notificationDeviceId,
          candidate.token,
        );
      }
      this.logger.warn(`Maintenance alert delivery failed with code: ${errorCode}`);
      return 'failed';
    }

    await this.maintenanceAlertsRepository.markSent(claim.id, result.messageId);
    return 'sent';
  }

  private dueKey(dueDate: Date | null, dueMileage: number | null): string {
    return `${dueDate?.toISOString().slice(0, 10) ?? 'none'}:${dueMileage ?? 'none'}`;
  }
}
