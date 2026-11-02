import { MaintenanceAlertsController } from './maintenance-alerts.controller';
import { MaintenanceAlertsService } from './maintenance-alerts.service';
import { MileageRemindersService } from './mileage-reminders.service';

describe('MaintenanceAlertsController', () => {
  it('runs maintenance alerts first and returns the mileage reminder result', async () => {
    const calls: string[] = [];
    const maintenanceAlertsService = {
      runDailyReview: jest.fn(async () => {
        calls.push('maintenance-alerts');
        return { selected: 1, claimed: 1, sent: 1, failed: 0 };
      }),
    } as unknown as MaintenanceAlertsService;
    const mileageRemindersService = {
      runDailyReview: jest.fn(async () => {
        calls.push('mileage-reminders');
        return { sent: 1, failed: 0, skipped: 0 };
      }),
    } as unknown as MileageRemindersService;
    const controller = new MaintenanceAlertsController(
      maintenanceAlertsService,
      mileageRemindersService,
    );

    await expect(controller.run()).resolves.toEqual({
      selected: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
      mileageReminders: { sent: 1, failed: 0, skipped: 0 },
    });
    expect(calls).toEqual(['maintenance-alerts', 'mileage-reminders']);
  });
});
