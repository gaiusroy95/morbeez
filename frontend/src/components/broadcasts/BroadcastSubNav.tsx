import { NavLink } from 'react-router-dom';
import { paths, toPath } from '../../lib/routes';

const LINKS = [
  { to: toPath(paths.broadcasts), label: 'Dashboard', end: true },
  { to: toPath(paths.broadcastsNew), label: 'Create' },
  { to: toPath(paths.broadcastsScheduled), label: 'Scheduled' },
  { to: toPath(paths.broadcastsSent), label: 'Sent' },
  { to: toPath(paths.broadcastsTemplates), label: 'Templates' },
  { to: toPath(paths.broadcastsAutomation), label: 'Automation' },
  { to: toPath(paths.broadcastsAnalytics), label: 'Analytics' },
  { to: toPath(paths.broadcastsAdmin), label: 'Admin' },
] as const;

export function BroadcastSubNav() {
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={'end' in link ? link.end : false}
          className={({ isActive }) =>
            `rounded-lg px-3 py-1.5 text-sm font-medium ${
              isActive
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
