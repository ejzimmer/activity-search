import type { ProblemResponse } from './types.ts';

export function respondWithProblem(status: number, problem: string): Response {
  const body: ProblemResponse = { problem };
  return Response.json(body, { status });
}
