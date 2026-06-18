import { Btn } from '../../ui';
import type { RecommendationGroupDraft } from '@morbeez/shared';

const DAY_PRESETS = [0, 7, 14, 21];

type Props = {
  groups: RecommendationGroupDraft[];
  onChange: (groups: RecommendationGroupDraft[]) => void;
};

export function VisitApplicationScheduleStep({ groups, onChange }: Props) {
  function setDay(groupIndex: number, day: number) {
    const next = [...groups];
    const group = next[groupIndex];
    if (!group) return;
    next[groupIndex] = { ...group, applicationDay: day, sortOrder: day };
    onChange(next.sort((a, b) => a.applicationDay - b.applicationDay));
  }

  function addGroup(day: number) {
    onChange([
      ...groups,
      {
        localId: `sched-${Date.now()}`,
        applicationType: 'Spray',
        applicationDay: day,
        sortOrder: day,
        materials: [],
      },
    ]);
  }

  return (
    <div className="vw-stack">
      <p className="vw-hint">Schedule follow-up applications across the season (Day 0, 7, 14, 21).</p>
      {groups.map((group, index) => (
        <div key={group.localId} className="vw-issue-card">
          <div className="vw-issue-title">
            Group #{index + 1}: {group.applicationType || 'Application'} — Day {group.applicationDay}
          </div>
          <div className="vw-segmented">
            {DAY_PRESETS.map((day) => (
              <button
                key={day}
                type="button"
                className={['vw-segment', group.applicationDay === day ? 'vw-segment--active' : ''].join(' ')}
                onClick={() => setDay(index, day)}
              >
                Day {day}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {DAY_PRESETS.map((day) => (
          <Btn key={day} variant="secondary" size="sm" onClick={() => addGroup(day)}>
            + Day {day} group
          </Btn>
        ))}
      </div>
    </div>
  );
}
