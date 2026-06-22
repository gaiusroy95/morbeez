import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { RequireAuth, RequireGuest, RoleHomeRedirect } from './guards';
import { ProtectedPage } from './ProtectedPage';
import { paths } from '../lib/routes';
import { LoginPage } from '../pages/LoginPage';
import { AcceptInvitePage } from '../pages/AcceptInvitePage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TelecallerCrmPage } from '../pages/TelecallerCrmPage';
import { OperationsCenterPage } from '../pages/OperationsCenterPage';
import { LanguageTemplateEditorPage } from '../pages/operations/LanguageTemplateEditorPage';
import { BroadcastDashboardPage } from '../pages/broadcasts/BroadcastDashboardPage';
import { BroadcastCreatePage } from '../pages/broadcasts/BroadcastCreatePage';
import { BroadcastScheduledPage } from '../pages/broadcasts/BroadcastScheduledPage';
import { BroadcastSentPage } from '../pages/broadcasts/BroadcastSentPage';
import { BroadcastTemplatesPage } from '../pages/broadcasts/BroadcastTemplatesPage';
import { BroadcastAnalyticsPage } from '../pages/broadcasts/BroadcastAnalyticsPage';
import { BroadcastAutomationPage } from '../pages/broadcasts/BroadcastAutomationPage';
import { BroadcastAdminPage } from '../pages/broadcasts/BroadcastAdminPage';
import { IntelligenceHubPage } from '../pages/IntelligenceHubPage';
import { ProductGapsPage } from '../pages/ProductGapsPage';
import { PartnerProgramHubPage } from '../pages/PartnerProgramHubPage';
import { OutcomeIntelligencePage } from '../pages/agronomist/OutcomeIntelligencePage';
import { RegionalThreatRadarPage } from '../pages/RegionalThreatRadarPage';
import { AgronomistHubPage } from '../pages/AgronomistHubPage';
import { AgronomistOperationsPage } from '../pages/AgronomistOperationsPage';
import { VisitCommandCenterPage } from '../pages/agronomist/VisitCommandCenterPage';
import { AgronomistFarmersPage } from '../pages/agronomist/AgronomistFarmersPage';
import { Farmer360Page } from '../pages/Farmer360Page';
import { CommunicationHubPage } from '../pages/CommunicationHubPage';
import { PlotIntelligencePage } from '../pages/PlotIntelligencePage';
import { WeaknessDashboardPage } from '../pages/ai-ops/WeaknessDashboardPage';
import { RetrainingOpsPage } from '../pages/ai-ops/RetrainingOpsPage';
import { ResistanceIntelligencePage } from '../pages/ResistanceIntelligencePage';
import { ExecutiveCockpitPage } from '../pages/ExecutiveCockpitPage';
import { EscalationCommandCenterPage } from '../pages/EscalationCommandCenterPage';
import { EconomicDashboardPage } from '../pages/EconomicDashboardPage';
import { SimilarCasesExplorerPage } from '../pages/copilot/SimilarCasesExplorerPage';
import { KnowledgeExplorerPage } from '../pages/copilot/KnowledgeExplorerPage';
import { VisitWizardPage } from '../pages/agronomist/VisitWizardPage';
import { VisitSuccessPage } from '../pages/agronomist/VisitSuccessPage';
import { VisitDetailPage } from '../pages/agronomist/VisitDetailPage';
import { RoutePlannerPage } from '../pages/agronomist/RoutePlannerPage';
import { RouteDetailPage } from '../pages/agronomist/RouteDetailPage';
import { FarmerMapPage } from '../pages/agronomist/FarmerMapPage';
import { OpportunityDashboardPage } from '../pages/OpportunityDashboardPage';
import { ApprovalsPage } from '../pages/ApprovalsPage';
import { AnalyticsHubPage } from '../pages/AnalyticsHubPage';
import { CommerceHubPage } from '../pages/CommerceHubPage';
import { QuoteCheckoutPage } from '../pages/QuoteCheckoutPage';
import { QuoteViewPage } from '../pages/QuoteViewPage';
import { WarehouseHubPage } from '../pages/WarehouseHubPage';
import { WarehousePrintPage } from '../pages/WarehousePrintPage';
import { SeoHubPage } from '../pages/SeoHubPage';
import { ProductWizardPage } from '../pages/ProductWizardPage';
import { EmployeesPage } from '../pages/EmployeesPage';
import { SettingsPage } from '../pages/SettingsPage';
import { useAuth } from '../context/AuthContext';
import { STAFF_PORTAL_BASENAME } from '../lib/staff-portal';

function TelecallerRoute() {
  const { can } = useAuth();
  return <TelecallerCrmPage canWrite={can('telecaller_crm', 'write')} />;
}

function OperationsRoute() {
  const { can } = useAuth();
  return <OperationsCenterPage canWrite={can('operations', 'write')} />;
}

function LanguageTemplateEditorRoute() {
  const { can } = useAuth();
  return <LanguageTemplateEditorPage canWrite={can('operations', 'write')} />;
}

function BroadcastRoute({ page }: { page: 'dashboard' | 'new' | 'scheduled' | 'sent' | 'templates' | 'analytics' | 'automation' | 'admin' }) {
  const { can } = useAuth();
  const canWrite = can('operations', 'write');
  switch (page) {
    case 'dashboard':
      return <BroadcastDashboardPage canWrite={canWrite} />;
    case 'new':
      return <BroadcastCreatePage canWrite={canWrite} />;
    case 'scheduled':
      return <BroadcastScheduledPage />;
    case 'sent':
      return <BroadcastSentPage />;
    case 'templates':
      return <BroadcastTemplatesPage canWrite={canWrite} />;
    case 'analytics':
      return <BroadcastAnalyticsPage />;
    case 'automation':
      return <BroadcastAutomationPage canWrite={canWrite} />;
    case 'admin':
      return <BroadcastAdminPage canWrite={canWrite} />;
  }
}

function IntelligenceRoute() {
  const { can } = useAuth();
  return <IntelligenceHubPage canWrite={can('intelligence', 'write')} />;
}

function OpportunityRoute() {
  const { can } = useAuth();
  return <OpportunityDashboardPage canWrite={can('intelligence', 'write')} />;
}

function PartnerProgramRoute() {
  const { can } = useAuth();
  return <PartnerProgramHubPage canWrite={can('partner_program', 'write')} />;
}

function AgronomistRoute() {
  const { can } = useAuth();
  return <AgronomistOperationsPage canWrite={can('agronomist', 'write')} />;
}

function AgronomistAiReviewRoute() {
  const { can } = useAuth();
  return <AgronomistHubPage canWrite={can('agronomist', 'write')} />;
}

function VisitCommandCenterRoute() {
  const { can } = useAuth();
  return <VisitCommandCenterPage canWrite={can('agronomist', 'write')} />;
}

function VisitWizardRoute() {
  const { can } = useAuth();
  return <VisitWizardPage canWrite={can('agronomist', 'write')} />;
}

function ApprovalsRoute() {
  const { canApprove, can } = useAuth();
  const canWrite = can('approve_recommendations', 'write') || canApprove;
  return <ApprovalsPage canApprove={canApprove} canWrite={canWrite} />;
}

function SettingsRoute() {
  const { can } = useAuth();
  return <SettingsPage canRead={can('settings', 'read')} canWrite={can('settings', 'write')} />;
}

function EmployeesRoute() {
  const { can } = useAuth();
  const { employeeId } = useParams<{ employeeId?: string }>();
  return (
    <EmployeesPage
      key={employeeId ?? 'list'}
      canWrite={can('settings', 'write')}
    />
  );
}

function CommerceRoute() {
  const { can } = useAuth();
  return <CommerceHubPage canWrite={can('commerce', 'write')} />;
}

function WarehouseRoute() {
  const { can } = useAuth();
  return <WarehouseHubPage canWrite={can('warehouse', 'write')} />;
}

function SeoRoute() {
  const { can } = useAuth();
  return <SeoHubPage canWrite={can('seo', 'write')} />;
}

function ProductWizardRoute() {
  const { can } = useAuth();
  return <ProductWizardPage canWrite={can('commerce', 'write')} />;
}

export const appRouter = createBrowserRouter(
  [
    { path: paths.acceptInvite, element: <AcceptInvitePage /> },
    { path: paths.forgotPassword, element: <ForgotPasswordPage /> },
    { path: paths.resetPassword, element: <ResetPasswordPage /> },
    {
      element: <RequireGuest />,
      children: [{ path: paths.login, element: <LoginPage /> }],
    },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { index: true, element: <RoleHomeRedirect /> },
            {
              path: paths.dashboard,
              element: (
                <ProtectedPage module="dashboard">
                  <DashboardPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.telecaller,
              element: (
                <ProtectedPage module="telecaller_crm">
                  <TelecallerRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.operations,
              element: (
                <ProtectedPage module="operations">
                  <OperationsRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.operationsLanguageTemplate,
              element: (
                <ProtectedPage module="operations">
                  <LanguageTemplateEditorRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.broadcasts,
              element: (
                <ProtectedPage module="operations">
                  <BroadcastRoute page="dashboard" />
                </ProtectedPage>
              ),
            },
            {
              path: paths.broadcastsNew,
              element: (
                <ProtectedPage module="operations">
                  <BroadcastRoute page="new" />
                </ProtectedPage>
              ),
            },
            {
              path: paths.broadcastsScheduled,
              element: (
                <ProtectedPage module="operations">
                  <BroadcastRoute page="scheduled" />
                </ProtectedPage>
              ),
            },
            {
              path: paths.broadcastsSent,
              element: (
                <ProtectedPage module="operations">
                  <BroadcastRoute page="sent" />
                </ProtectedPage>
              ),
            },
            {
              path: paths.broadcastsTemplates,
              element: (
                <ProtectedPage module="operations">
                  <BroadcastRoute page="templates" />
                </ProtectedPage>
              ),
            },
            {
              path: paths.broadcastsAutomation,
              element: (
                <ProtectedPage module="operations">
                  <BroadcastRoute page="automation" />
                </ProtectedPage>
              ),
            },
            {
              path: paths.broadcastsAnalytics,
              element: (
                <ProtectedPage module="operations">
                  <BroadcastRoute page="analytics" />
                </ProtectedPage>
              ),
            },
            {
              path: paths.broadcastsAdmin,
              element: (
                <ProtectedPage module="operations">
                  <BroadcastRoute page="admin" />
                </ProtectedPage>
              ),
            },
            {
              path: paths.intelligence,
              element: (
                <ProtectedPage module="intelligence">
                  <IntelligenceRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.opportunity,
              element: (
                <ProtectedPage module="intelligence">
                  <OpportunityRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.partnerProgram,
              element: (
                <ProtectedPage module="partner_program">
                  <PartnerProgramRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.productGaps,
              element: (
                <ProtectedPage module="intelligence">
                  <ProductGapsPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomist,
              element: (
                <ProtectedPage module="agronomist">
                  <AgronomistRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.executiveCockpit,
              element: (
                <ProtectedPage module="analytics">
                  <ExecutiveCockpitPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.escalationCommand,
              element: (
                <ProtectedPage module="telecaller_crm">
                  <EscalationCommandCenterPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.economicDashboard,
              element: (
                <ProtectedPage module="analytics">
                  <EconomicDashboardPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.weaknessDashboard,
              element: (
                <ProtectedPage module="agronomist">
                  <WeaknessDashboardPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.retrainingOps,
              element: (
                <ProtectedPage module="agronomist">
                  <RetrainingOpsPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.resistanceDashboard,
              element: (
                <ProtectedPage module="intelligence">
                  <ResistanceIntelligencePage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.similarCasesExplorer,
              element: (
                <ProtectedPage module="agronomist">
                  <SimilarCasesExplorerPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.knowledgeExplorer,
              element: (
                <ProtectedPage module="intelligence">
                  <KnowledgeExplorerPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.farmer360,
              element: (
                <ProtectedPage module="intelligence">
                  <Farmer360Page />
                </ProtectedPage>
              ),
            },
            {
              path: paths.communicationHub,
              element: (
                <ProtectedPage module="intelligence">
                  <CommunicationHubPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.communicationHubFarmer,
              element: (
                <ProtectedPage module="intelligence">
                  <CommunicationHubPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.plotIntelligence,
              element: (
                <ProtectedPage module="agronomist">
                  <PlotIntelligencePage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistFarmers,
              element: (
                <ProtectedPage module="agronomist">
                  <AgronomistFarmersPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistVisitCommand,
              element: (
                <ProtectedPage module="agronomist">
                  <VisitCommandCenterRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistAiReview,
              element: (
                <ProtectedPage module="agronomist">
                  <AgronomistAiReviewRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistOutcomeIntelligence,
              element: (
                <ProtectedPage module="agronomist">
                  <OutcomeIntelligencePage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.regionalThreatRadar,
              element: (
                <ProtectedPage module="operations">
                  <RegionalThreatRadarPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistVisit,
              element: (
                <ProtectedPage module="agronomist">
                  <VisitWizardRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistVisitSuccess,
              element: (
                <ProtectedPage module="agronomist">
                  <VisitSuccessPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistVisitDetail,
              element: (
                <ProtectedPage module="agronomist">
                  <VisitDetailPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistRoutes,
              element: (
                <ProtectedPage module="agronomist">
                  <RoutePlannerPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistRouteDetail,
              element: (
                <ProtectedPage module="agronomist">
                  <RouteDetailPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.agronomistMap,
              element: (
                <ProtectedPage module="agronomist">
                  <FarmerMapPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.approvals,
              element: (
                <ProtectedPage module="approve_recommendations">
                  <ApprovalsRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.analytics,
              element: (
                <ProtectedPage module="analytics">
                  <AnalyticsHubPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.commerce,
              element: (
                <ProtectedPage module="commerce">
                  <CommerceRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.commerceQuoteView,
              element: (
                <ProtectedPage module="commerce">
                  <QuoteViewPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.commerceQuoteCheckout,
              element: (
                <ProtectedPage module="commerce">
                  <QuoteCheckoutPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.warehouse,
              element: (
                <ProtectedPage module="warehouse">
                  <WarehouseRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.warehousePrint,
              element: (
                <ProtectedPage module="warehouse">
                  <WarehousePrintPage />
                </ProtectedPage>
              ),
            },
            {
              path: paths.seo,
              element: (
                <ProtectedPage module="seo">
                  <SeoRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.commerceProductNew,
              element: (
                <ProtectedPage module="commerce">
                  <ProductWizardRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.commerceProductEdit,
              element: (
                <ProtectedPage module="commerce">
                  <ProductWizardRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.employees,
              element: (
                <ProtectedPage module="settings">
                  <EmployeesRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.employeeDetail,
              element: (
                <ProtectedPage module="settings">
                  <EmployeesRoute />
                </ProtectedPage>
              ),
            },
            {
              path: paths.settings,
              element: (
                <ProtectedPage module="settings">
                  <SettingsRoute />
                </ProtectedPage>
              ),
            },
          ],
        },
      ],
    },
    { path: '*', element: <Navigate to={`/${paths.dashboard}`} replace /> },
  ],
  { basename: STAFF_PORTAL_BASENAME }
);

export function AppRouter() {
  return <RouterProvider router={appRouter} />;
}
