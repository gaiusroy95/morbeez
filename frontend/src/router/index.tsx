import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
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
import { IntelligenceHubPage } from '../pages/IntelligenceHubPage';
import { ProductGapsPage } from '../pages/ProductGapsPage';
import { OpportunityDashboardPage } from '../pages/OpportunityDashboardPage';
import { AgronomistHubPage } from '../pages/AgronomistHubPage';
import { ApprovalsPage } from '../pages/ApprovalsPage';
import { AnalyticsHubPage } from '../pages/AnalyticsHubPage';
import { CommerceHubPage } from '../pages/CommerceHubPage';
import { QuoteCheckoutPage } from '../pages/QuoteCheckoutPage';
import { QuoteViewPage } from '../pages/QuoteViewPage';
import { WarehouseHubPage } from '../pages/WarehouseHubPage';
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

function IntelligenceRoute() {
  const { can } = useAuth();
  return <IntelligenceHubPage canWrite={can('intelligence', 'write')} />;
}

function OpportunityRoute() {
  const { can } = useAuth();
  return <OpportunityDashboardPage canWrite={can('intelligence', 'write')} />;
}

function AgronomistRoute() {
  const { can } = useAuth();
  return <AgronomistHubPage canWrite={can('agronomist', 'write')} />;
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
  return <EmployeesPage canWrite={can('settings', 'write')} />;
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
