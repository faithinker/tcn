import type { APIRoute } from 'astro';
import { getDB } from '../../../../lib/db';
import { handleAdminQuestionMutation } from '../../../../lib/qna/admin-route';
import { parseAnswerPayload } from '../../../../lib/qna/payload';
import { upsertOfficialAnswer } from '../../../../lib/qna/repository';

export const prerender = false;

export const PUT: APIRoute = ({ request, params }) =>
  handleAdminQuestionMutation({
    request,
    questionId: params.id,
    parse: parseAnswerPayload,
    responseKey: 'answer',
    mutate: ({ value, questionId, actorUserId, requestId }) =>
      upsertOfficialAnswer(getDB(), {
        questionId,
        body: value.body,
        actorUserId,
        expectedRevision: value.expectedRevision,
        requestId,
      }),
  });
