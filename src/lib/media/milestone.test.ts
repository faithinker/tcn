import { describe, expect, it } from 'vitest';

import { milestoneLightboxEntries } from './milestone';

describe('milestoneLightboxEntries', () => {
  it('projects milestone photographs into the shared media viewer contract', () => {
    expect(
      milestoneLightboxEntries([
        {
          src: 'prefounding-meeting-01',
          alt: 'Participants standing together in a conference room',
          caption: 'Participants gathered in the meeting room.',
        },
      ]),
    ).toEqual([
      {
        id: 'prefounding-meeting-01',
        type: 'image',
        src: '/images/history/prefounding-meeting-01.webp',
        alt: 'Participants standing together in a conference room',
        caption: 'Participants gathered in the meeting room.',
      },
    ]);
  });

  it('supports caption-free milestone photographs', () => {
    expect(
      milestoneLightboxEntries([
        {
          src: 'prefounding-meeting-04',
          alt: 'Participants outside the Academy of Korean Studies',
        },
      ]),
    ).toEqual([
      {
        id: 'prefounding-meeting-04',
        type: 'image',
        src: '/images/history/prefounding-meeting-04.webp',
        alt: 'Participants outside the Academy of Korean Studies',
        caption: '',
      },
    ]);
  });
});
