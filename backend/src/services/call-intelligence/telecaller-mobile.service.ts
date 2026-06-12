import { telecallerAdminService } from '../admin/telecaller-admin.service.js';
import { callQcService } from './call-qc.service.js';
import { marketingPerformanceService, dateRangeFromDays } from '../admin/marketing-performance.service.js';

export const telecallerMobileService = {
  async getDashboard(agentEmail: string) {
    const [overview, qc, queueHealth] = await Promise.all([
      telecallerAdminService.getOverview(agentEmail),
      callQcService.getOverview(7, agentEmail),
      marketingPerformanceService
        .getOverview(dateRangeFromDays(7))
        .then((r) => r.queueHealth)
        .catch(() => null),
    ]);

    return {
      overview,
      qc,
      queueHealth,
    };
  },

  async listLeads(
    agentEmail: string,
    query: { scope?: 'mine' | 'all'; limit?: number }
  ) {
    const result = await telecallerAdminService.listLeads(
      {
        scope: query.scope ?? 'mine',
        page: 1,
        limit: query.limit ?? 40,
      },
      agentEmail
    );
    return result.leads;
  },

  async listFollowUps(agentEmail: string, status = 'pending') {
    return telecallerAdminService.listTasks(agentEmail, status);
  },
};
