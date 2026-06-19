import type { MaiosChannel } from '../case/types.js';

export type ChannelProfile = {
  channel: MaiosChannel;
  minCompletenessPct: number;
  minEqsForAutoRecommend: number;
  allowAutoRecommend: boolean;
};

const PROFILES: Record<MaiosChannel, ChannelProfile> = {
  whatsapp: {
    channel: 'whatsapp',
    minCompletenessPct: 15,
    minEqsForAutoRecommend: 70,
    allowAutoRecommend: true,
  },
  field_visit: {
    channel: 'field_visit',
    minCompletenessPct: 40,
    minEqsForAutoRecommend: 60,
    allowAutoRecommend: true,
  },
  telecaller: {
    channel: 'telecaller',
    minCompletenessPct: 10,
    minEqsForAutoRecommend: 100,
    allowAutoRecommend: false,
  },
  api: {
    channel: 'api',
    minCompletenessPct: 20,
    minEqsForAutoRecommend: 70,
    allowAutoRecommend: true,
  },
  web: {
    channel: 'web',
    minCompletenessPct: 20,
    minEqsForAutoRecommend: 70,
    allowAutoRecommend: true,
  },
};

export function getChannelProfile(channel: MaiosChannel): ChannelProfile {
  return PROFILES[channel] ?? PROFILES.whatsapp;
}
