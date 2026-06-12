/** Daily mandi prices are published around 12:00 IST via staff Operations → Daily prices. */
export const MARKET_PUBLISH_HOUR_IST = 12;

export function istDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

export function istHour(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(date)
  );
}

export function isBeforeMarketPublishTime(date = new Date()): boolean {
  return istHour(date) < MARKET_PUBLISH_HOUR_IST;
}

export type MarketRateDisplay = {
  showPrice: boolean;
  pending: boolean;
  pricePerKg: number | null;
  rateLabelKey: 'currentMarketRate' | 'latestMarketRate';
  updatedOnLabel: string | null;
};

export function resolveMarketRateDisplay(
  input: {
    todayPrice: number | null;
    date: string;
    priceIsToday?: boolean;
  },
  formatUpdatedDate: (isoDate: string) => string
): MarketRateDisplay | null {
  const todayIst = istDateKey();
  const priceIsToday = input.priceIsToday ?? input.date === todayIst;
  const beforePublish = isBeforeMarketPublishTime();

  if (input.todayPrice == null) {
    return {
      showPrice: false,
      pending: beforePublish,
      pricePerKg: null,
      rateLabelKey: 'currentMarketRate',
      updatedOnLabel: null,
    };
  }

  if (!priceIsToday && beforePublish) {
    return {
      showPrice: false,
      pending: true,
      pricePerKg: null,
      rateLabelKey: 'currentMarketRate',
      updatedOnLabel: null,
    };
  }

  if (priceIsToday) {
    return {
      showPrice: true,
      pending: false,
      pricePerKg: input.todayPrice,
      rateLabelKey: 'currentMarketRate',
      updatedOnLabel: null,
    };
  }

  return {
    showPrice: true,
    pending: false,
    pricePerKg: input.todayPrice,
    rateLabelKey: 'latestMarketRate',
    updatedOnLabel: formatUpdatedDate(input.date),
  };
}
