// The ask and lookup forms' field names, shared by the browser and the actions.
export const QUESTION_FIELD = "question";
export const QUERY_FIELD = "query";
export const PARAM_FIELD = "param";

// A server action is a public POST endpoint, so a missing or non-text entry
// reads as empty, because a caller can send anything.
function textOf(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// The question as the browser sent it. checkQuestion counts a CR LF pair as one
// character and askRequest sends it as LF, so the text is kept as received.
export function readQuestionFields(formData: FormData): { question: string } {
  return { question: textOf(formData, QUESTION_FIELD) };
}

export function readLookupFields(formData: FormData): { query: string; param: string } {
  return { query: textOf(formData, QUERY_FIELD), param: textOf(formData, PARAM_FIELD) };
}
