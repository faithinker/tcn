import type { APIRoute } from 'astro';
import { getDB } from '../../../../lib/db';
import { handleAdminQuestionMutation } from '../../../../lib/qna/admin-route';
import { parseVisibilityPayload } from '../../../../lib/qna/payload';
import { setQuestionVisibility } from '../../../../lib/qna/repository';

export const prerender = false;

export const PATCH: APIRoute = ({ request, params }) =>
  handleAdminQuestionMutation({
    request,
    questionId: params.id,
    parse: parseVisibilityPayload,
    responseKey: 'question',
    mutate: ({ value, questionId, actorUserId, requestId }) =>
      setQuestionVisibility(getDB(), {
        questionId,
        visibility: value.visibility,
        actorUserId,
        expectedRevision: value.expectedRevision,
        requestId,
      }),
  });
