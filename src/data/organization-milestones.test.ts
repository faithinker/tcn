import { describe, expect, it } from 'vitest';

import { organizationMilestones } from './organization-milestones';

describe('organizationMilestones', () => {
  it('groups the two dated founding preparation stages and their photographs', () => {
    const milestone = organizationMilestones.find(({ date }) => date === '2024-11-30');

    expect(milestone).toMatchObject({
      dateLabel: 'Nov 2024–Jun 2025',
      title: 'Preparations for the Founding of the Transcultural Network',
      location: '',
    });
    expect(milestone?.stages).toHaveLength(2);
    expect(milestone?.stages?.[0]).toMatchObject({
      date: '2024-11-30',
      title: 'The decision to found TCN',
    });
    expect(milestone?.stages?.[0]?.media.map(({ src }) => src)).toEqual([
      'prefounding-meeting-01',
      'prefounding-meeting-02',
      'prefounding-meeting-04',
    ]);
    expect(milestone?.stages?.[1]).toMatchObject({
      date: '2025-06-17',
      title: 'Practical preparations begin',
    });
    expect(milestone?.stages?.[1]?.media.map(({ src }) => src)).toEqual(['prefounding-meeting-03']);
    expect(milestone?.stages?.flatMap(({ media }) => media.map(({ caption }) => caption))).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});
