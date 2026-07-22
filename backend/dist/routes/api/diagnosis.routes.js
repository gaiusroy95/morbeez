import { z } from 'zod';
import { verifyInternalApiKey } from '../../middleware/webhookVerify.js';
import { diagnosisV17Service } from '../../services/diagnosis/diagnosis-v17.service.js';
import { ValidationError } from '../../lib/errors.js';
const contextPackSchema = z
    .object({
    weatherRiskScore: z.number().min(0).max(100).optional(),
    heavyRainLikely: z.boolean().optional(),
    highHeatLikely: z.boolean().optional(),
    highHumidityLikely: z.boolean().optional(),
    soilPh: z.number().optional(),
    soilEc: z.number().optional(),
    dap: z.number().int().min(0).optional(),
})
    .optional();
const startSchema = z.object({
    farmerId: z.string().uuid().optional(),
    phone: z.string().min(10).optional(),
    name: z.string().max(120).optional(),
    cropType: z.string().min(1).max(80).default('ginger'),
    symptomsText: z.string().max(4000).optional(),
    suspectedIssue: z.string().max(200).optional(),
    language: z.enum(['en', 'ml']).default('en'),
    contextPack: contextPackSchema,
    visionLabel: z.string().max(200).optional(),
    visionConfidence: z.number().min(0).max(1).optional(),
    photoCount: z.number().int().min(0).max(12).optional(),
});
const answersSchema = z.object({
    answers: z
        .array(z.object({
        questionId: z.string().max(80).optional(),
        questionText: z.string().min(1).max(500),
        answer: z.string().min(1).max(500),
    }))
        .min(1)
        .max(20),
});
export async function diagnosisRoutes(app) {
    app.addHook('preHandler', verifyInternalApiKey);
    app.post('/api/v1/diagnosis/start', async (request, reply) => {
        const body = startSchema.parse(request.body);
        if (!body.farmerId && !body.phone) {
            throw new ValidationError('Provide farmerId or phone');
        }
        const result = await diagnosisV17Service.start(body);
        return reply.code(201).send({ ok: true, ...result });
    });
    app.post('/api/v1/diagnosis/:sessionId/answers', async (request, reply) => {
        const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(request.params);
        const body = answersSchema.parse(request.body);
        const result = await diagnosisV17Service.submitAnswers(sessionId, body);
        return reply.send({ ok: true, ...result });
    });
    app.get('/api/v1/diagnosis/:sessionId/report', async (request, reply) => {
        const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(request.params);
        const result = await diagnosisV17Service.getReport(sessionId);
        return reply.send({ ok: true, ...result });
    });
}
//# sourceMappingURL=diagnosis.routes.js.map