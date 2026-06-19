import type { MaiosChannel } from '../case/types.js';
export type ChannelProfile = {
    channel: MaiosChannel;
    minCompletenessPct: number;
    minEqsForAutoRecommend: number;
    allowAutoRecommend: boolean;
};
export declare function getChannelProfile(channel: MaiosChannel): ChannelProfile;
//# sourceMappingURL=channel-profiles.d.ts.map