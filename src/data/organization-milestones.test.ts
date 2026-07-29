import { describe, expect, it } from 'vitest';

import { organizationMilestones } from './organization-milestones';

describe('organizationMilestones', () => {
  it('records the founding preparation photographs without overstating the date or location', () => {
    const milestone = organizationMilestones.find(({ date }) => date === '2025-06');

    expect(milestone).toMatchObject({
      dateLabel: 'Summer 2025',
      title: 'Preparatory Meeting for the Founding of the Transcultural Network',
      location: '',
    });
    expect(milestone?.media).toHaveLength(3);
    expect(milestone?.media?.map(({ src }) => src)).toEqual([
      'prefounding-meeting-01',
      'prefounding-meeting-02',
      'prefounding-meeting-03',
    ]);
  });
});
