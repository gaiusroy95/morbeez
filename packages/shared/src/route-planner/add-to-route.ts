import type { AgentRouteSummary } from '../types/agronomist';

export type AddToRouteClients = {
  listRoutes: (date?: string) => Promise<AgentRouteSummary[]>;
  createRoute: (routeName: string) => Promise<AgentRouteSummary>;
  addRouteStop: (routeId: string, farmerId: string, blockId?: string) => Promise<unknown>;
};

/** Pick today's route or create one, then append a farmer/block stop. */
export async function addFarmerToTodayRoute(
  clients: AddToRouteClients,
  farmerId: string,
  blockId?: string,
  routeName?: string
): Promise<{ routeId: string; routeName: string; createdRoute: boolean }> {
  const routes = await clients.listRoutes();
  let route = routes[0];
  let createdRoute = false;

  if (!route) {
    const name = routeName?.trim() || `Route ${new Date().toLocaleDateString()}`;
    route = await clients.createRoute(name);
    createdRoute = true;
  }

  await clients.addRouteStop(route.id, farmerId, blockId);
  return { routeId: route.id, routeName: route.routeName, createdRoute };
}
