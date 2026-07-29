import { newId } from '../db/client';
import type {
  QnaAdminStatus,
  QnaAnswer,
  QnaPage,
  QnaPublicStatus,
  QnaQuestion,
  QnaQuestionListItem,
  QnaVisibility,
} from '../db/types';

export const QNA_PAGE_SIZE = 20 as const;

interface QuestionRow {
  id: string;
  title: string;
  body: string;
  askerUserId: string | null;
  visibility: QnaVisibility;
  questionRevision: number;
  createdAt: string;
  updatedAt: string;
  answerBody: string | null;
  answeredBy: string | null;
  answerRevision: number | null;
  answerCreatedAt: string | null;
  answerUpdatedAt: string | null;
}

interface ListRow {
  id: string;
  title: string;
  visibility: QnaVisibility;
  questionRevision: number;
  createdAt: string;
  answerRevision: number | null;
  answeredAt: string | null;
  status: 'waiting' | 'answered' | 'hidden';
}

const QUESTION_COLUMNS = `q.id, q.title, q.body, q.asker_user_id as askerUserId,
  q.visibility, q.revision as questionRevision, q.created_at as createdAt,
  q.updated_at as updatedAt, a.body as answerBody, a.answered_by as answeredBy,
  a.revision as answerRevision, a.created_at as answerCreatedAt,
  a.updated_at as answerUpdatedAt`;

const LIST_COLUMNS = `q.id, q.title, q.visibility,
  q.revision as questionRevision, q.created_at as createdAt,
  a.revision as answerRevision, a.updated_at as answeredAt`;

export class QnaNotFoundError extends Error {
  constructor() {
    super('not_found');
  }
}

export class QnaRevisionConflictError extends Error {
  constructor() {
    super('revision_conflict');
  }
}

function mapQuestion(row: QuestionRow): QnaQuestion {
  let answer: QnaAnswer | null = null;
  if (
    row.answerRevision !== null &&
    row.answerBody !== null &&
    row.answeredBy !== null &&
    row.answerCreatedAt !== null &&
    row.answerUpdatedAt !== null
  ) {
    answer = {
      questionId: row.id,
      body: row.answerBody,
      answeredBy: row.answeredBy,
      revision: row.answerRevision,
      createdAt: row.answerCreatedAt,
      updatedAt: row.answerUpdatedAt,
    };
  }
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    askerUserId: row.askerUserId,
    visibility: row.visibility,
    revision: row.questionRevision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    answer,
  };
}

function mapListRow(row: ListRow): QnaQuestionListItem {
  const status =
    row.visibility === 'hidden' ? 'hidden' : row.answerRevision === null ? 'waiting' : 'answered';
  return { ...row, status };
}

function publicStatusSql(status: QnaPublicStatus): string {
  if (status === 'waiting') return 'and a.question_id is null';
  if (status === 'answered') return 'and a.question_id is not null';
  return '';
}

function adminStatusSql(status: QnaAdminStatus): string {
  if (status === 'hidden') return "q.visibility = 'hidden'";
  if (status === 'waiting') return "q.visibility = 'visible' and a.question_id is null";
  return "q.visibility = 'visible' and a.question_id is not null";
}

function adminOrderSql(status: QnaAdminStatus): string {
  if (status === 'waiting') return 'q.created_at asc, q.id asc';
  if (status === 'answered') return 'a.updated_at desc, q.id desc';
  return 'q.created_at desc, q.id desc';
}

function pageResult(
  rows: ListRow[],
  requestedPage: number,
  total: number,
): QnaPage<QnaQuestionListItem> {
  const totalPages = total === 0 ? 1 : Math.ceil(total / QNA_PAGE_SIZE);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  return {
    items: rows.map(mapListRow),
    page,
    pageSize: QNA_PAGE_SIZE,
    total,
    totalPages,
  };
}

export async function listPublicQuestions(
  db: D1Database,
  options: { status: QnaPublicStatus; page: number },
): Promise<QnaPage<QnaQuestionListItem>> {
  const statusSql = publicStatusSql(options.status);
  const count = await db
    .prepare(
      `select count(*) as total from qna_questions q
       left join qna_answers a on a.question_id = q.id
       where q.visibility = 'visible' ${statusSql}`,
    )
    .bind()
    .first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / QNA_PAGE_SIZE);
  const page = Math.min(Math.max(options.page, 1), totalPages);
  const rows = await db
    .prepare(
      `select ${LIST_COLUMNS} from qna_questions q
       left join qna_answers a on a.question_id = q.id
       where q.visibility = 'visible' ${statusSql}
       order by q.created_at desc, q.id desc limit ?1 offset ?2`,
    )
    .bind(QNA_PAGE_SIZE, (page - 1) * QNA_PAGE_SIZE)
    .all<ListRow>();
  return pageResult(rows.results, options.page, total);
}

export async function listAdminQuestions(
  db: D1Database,
  options: { status: QnaAdminStatus; page: number },
): Promise<QnaPage<QnaQuestionListItem>> {
  const where = adminStatusSql(options.status);
  const count = await db
    .prepare(
      `select count(*) as total from qna_questions q
       left join qna_answers a on a.question_id = q.id where ${where}`,
    )
    .first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / QNA_PAGE_SIZE);
  const page = Math.min(Math.max(options.page, 1), totalPages);
  const rows = await db
    .prepare(
      `select ${LIST_COLUMNS} from qna_questions q
       left join qna_answers a on a.question_id = q.id where ${where}
       order by ${adminOrderSql(options.status)} limit ?1 offset ?2`,
    )
    .bind(QNA_PAGE_SIZE, (page - 1) * QNA_PAGE_SIZE)
    .all<ListRow>();
  return pageResult(rows.results, options.page, total);
}

async function getQuestion(
  db: D1Database,
  id: string,
  includeHidden: boolean,
): Promise<QnaQuestion | null> {
  const visible = includeHidden ? '' : "and q.visibility = 'visible'";
  const row = await db
    .prepare(
      `select ${QUESTION_COLUMNS} from qna_questions q
       left join qna_answers a on a.question_id = q.id
       where q.id = ?1 ${visible}`,
    )
    .bind(id)
    .first<QuestionRow>();
  return row ? mapQuestion(row) : null;
}

export function getPublicQuestion(db: D1Database, id: string): Promise<QnaQuestion | null> {
  return getQuestion(db, id, false);
}

export function getAdminQuestion(db: D1Database, id: string): Promise<QnaQuestion | null> {
  return getQuestion(db, id, true);
}

export async function createQuestion(
  db: D1Database,
  input: { title: string; body: string; askerUserId: string | null },
): Promise<QnaQuestion> {
  const id = newId();
  await db
    .prepare(
      `insert into qna_questions (id, title, body, asker_user_id)
       values (?1, ?2, ?3, ?4)`,
    )
    .bind(id, input.title, input.body, input.askerUserId)
    .run();
  const question = await getAdminQuestion(db, id);
  if (!question) throw new Error('createQuestion: insert did not persist');
  return question;
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

async function requireCurrentQuestion(db: D1Database, id: string): Promise<QnaQuestion> {
  const question = await getAdminQuestion(db, id);
  if (!question) throw new QnaNotFoundError();
  return question;
}

export async function upsertOfficialAnswer(
  db: D1Database,
  input: {
    questionId: string;
    body: string;
    actorUserId: string;
    expectedRevision: number;
    requestId: string;
  },
): Promise<QnaAnswer> {
  const current = await requireCurrentQuestion(db, input.questionId);
  const currentRevision = current.answer?.revision ?? 0;
  if (currentRevision !== input.expectedRevision) throw new QnaRevisionConflictError();

  const action = input.expectedRevision === 0 ? 'answer_created' : 'answer_updated';
  const audit = db
    .prepare(
      `insert into qna_audit_events
       (id, question_id, target_kind, target_id, actor_user_id, action,
        before_revision, after_revision, request_id)
       values (?1, ?2, 'answer', ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      newId(),
      input.questionId,
      input.actorUserId,
      action,
      input.expectedRevision,
      input.expectedRevision + 1,
      input.requestId,
    );
  const mutation =
    input.expectedRevision === 0
      ? db
          .prepare(
            `insert into qna_answers (question_id, body, answered_by)
             values (?1, ?2, ?3) returning question_id`,
          )
          .bind(input.questionId, input.body, input.actorUserId)
      : db
          .prepare(
            `update qna_answers set body = ?2, answered_by = ?3,
             revision = revision + 1,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             where question_id = ?1 and revision = ?4 returning question_id`,
          )
          .bind(input.questionId, input.body, input.actorUserId, input.expectedRevision);

  try {
    const results = await db.batch([audit, mutation]);
    if (results[1]?.results.length !== 1) throw new QnaRevisionConflictError();
  } catch (error) {
    if (error instanceof QnaRevisionConflictError || isUniqueConflict(error)) {
      throw new QnaRevisionConflictError();
    }
    throw error;
  }
  const updated = await getAdminQuestion(db, input.questionId);
  if (!updated?.answer) throw new Error('upsertOfficialAnswer: mutation did not persist');
  return updated.answer;
}

export async function setQuestionVisibility(
  db: D1Database,
  input: {
    questionId: string;
    visibility: QnaVisibility;
    actorUserId: string;
    expectedRevision: number;
    requestId: string;
  },
): Promise<QnaQuestion> {
  const current = await requireCurrentQuestion(db, input.questionId);
  if (current.revision !== input.expectedRevision) throw new QnaRevisionConflictError();
  if (current.visibility === input.visibility) return current;

  const action = input.visibility === 'hidden' ? 'question_hidden' : 'question_restored';
  const audit = db
    .prepare(
      `insert into qna_audit_events
       (id, question_id, target_kind, target_id, actor_user_id, action,
        before_revision, after_revision, request_id)
       values (?1, ?2, 'question', ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      newId(),
      input.questionId,
      input.actorUserId,
      action,
      input.expectedRevision,
      input.expectedRevision + 1,
      input.requestId,
    );
  const mutation = db
    .prepare(
      `update qna_questions set visibility = ?2, revision = revision + 1,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       where id = ?1 and revision = ?3 returning id`,
    )
    .bind(input.questionId, input.visibility, input.expectedRevision);

  try {
    const results = await db.batch([audit, mutation]);
    if (results[1]?.results.length !== 1) throw new QnaRevisionConflictError();
  } catch (error) {
    if (error instanceof QnaRevisionConflictError || isUniqueConflict(error)) {
      throw new QnaRevisionConflictError();
    }
    throw error;
  }
  return requireCurrentQuestion(db, input.questionId);
}
