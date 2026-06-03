import type { TrainingEventSource } from '../../domain/ai-training/enums.js';
export type WeatherEventType = 'field_finding' | 'ai_session' | 'recommendation' | 'field_activity' | 'manual';
export type WeatherSnapshotRow = {
    id: string;
    farmerId: string | null;
    blockId: string | null;
    eventType: WeatherEventType;
    eventId: string | null;
    capturedAt: string;
    rainfallMm: number | null;
    rainfallMmForecast: number | null;
    humidityPct: number | null;
    temperatureC: number | null;
    weatherRiskScore: number | null;
    diseaseAlerts: unknown[];
    locationLabel: string | null;
};
export declare const weatherSnapshotService: {
    /** Persist Open-Meteo forecast at event time for AI training correlation. */
    capture(params: {
        farmerId?: string | null;
        blockId?: string | null;
        eventType: WeatherEventType;
        eventId?: string | null;
    }): Promise<{
        snapshotId: string;
        context: Record<string, unknown>;
    } | null>;
    getById(id: string): Promise<WeatherSnapshotRow | null>;
    /** Map event source channel → weather event type */
    mapSourceToEventType(source: TrainingEventSource): WeatherEventType;
    mapReviewSurfaceToEventType(surface: string): WeatherEventType;
    linkSnapshotToEvent(snapshotId: string, eventId: string): Promise<void>;
    /** Resolve weather context for training — reuse finding weather or capture fresh. */
    resolveForTraining(params: {
        farmerId: string;
        blockId?: string | null;
        reviewSurface: string;
        fieldFindingId?: string | null;
        aiSessionId?: string | null;
        linkEventId?: string | null;
    }): Promise<{
        weatherSnapshotId: string | null;
        weatherContext: Record<string, unknown>;
    }>;
};
//# sourceMappingURL=weather-snapshot.service.d.ts.map