import type { FastifyInstance } from 'fastify';
import { SessionService } from '../services/session.service.js';
import { ValidationService } from '../services/validation.service.js';
import { ReportService } from '../services/report.service.js';
import type { LLMProvider } from '../providers/llm.interface.js';

export function registerSessionRoutes(app: FastifyInstance, llmProvider: LLMProvider): void {
  const sessionService = new SessionService();
  const validationService = new ValidationService(llmProvider);
  const reportService = new ReportService();

  // GET /api/sessions/:sessionId
  app.get('/api/sessions/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const result = await sessionService.getSession(sessionId);
    reply.send(result);
  });

  // POST /api/sessions/:sessionId/validate
  app.post('/api/sessions/:sessionId/validate', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const result = await validationService.validateSession(sessionId);
    reply.send(result);
  });

  // GET /api/sessions/:sessionId/report
  app.get('/api/sessions/:sessionId/report', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const result = await reportService.generateReport(sessionId);
    reply.send(result);
  });
}
