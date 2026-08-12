// University email conventions (FR-AUTH-02): students use a 6-character
// alphanumeric local part @student.sunderland.ac.uk; staff (supervisors,
// admin) use firstname.lastname@sunderland.ac.uk.
const STUDENT_EMAIL_RE = /^[a-z0-9]{6}@student\.sunderland\.ac\.uk$/i
const STAFF_EMAIL_RE = /^[a-z][a-z'-]*\.[a-z][a-z'-]*@sunderland\.ac\.uk$/i

export function isStudentEmail(email: string): boolean {
  return STUDENT_EMAIL_RE.test(email)
}

export function isStaffEmail(email: string): boolean {
  return STAFF_EMAIL_RE.test(email)
}

export function isValidUniversityEmail(email: string): boolean {
  return isStudentEmail(email) || isStaffEmail(email)
}

export function validateDistinctRankedList(ids: number[], expectedLength: number): string | null {
  if (ids.length !== expectedLength) {
    return `Expected exactly ${expectedLength} entries, got ${ids.length}.`
  }
  if (new Set(ids).size !== ids.length) {
    return "Entries must be distinct — duplicates are not allowed."
  }
  return null
}
