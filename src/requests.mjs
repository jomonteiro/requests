// Módulo mínimo para gerir criação de pedidos (in-memory)
// Exporta funções para criar pedidos, aceder ao store e limpar (úteis para testes)

class ValidationError extends Error {
  constructor(details) {
    super('validation error');
    this.name = 'ValidationError';
    this.code = 'validation_error';
    this.details = details;
  }
}

class AuthError extends Error {
  constructor() {
    super('authentication required');
    this.name = 'AuthError';
    this.code = 'unauthenticated';
  }
}

// In-memory store (para demo/tests)
const REQUESTS = [];

// Simple UUIDv4 generator (no deps)
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function _validatePayload(payload) {
  const details = [];
  if (!payload || typeof payload.subject !== 'string' || payload.subject.trim() === '') {
    details.push({ field: 'subject', message: 'required' });
  }
  if (!payload || typeof payload.description !== 'string' || payload.description.trim() === '') {
    details.push({ field: 'description', message: 'required' });
  }
  return details;
}

// token expected to be an object with at least { sub: <userId> }
function createRequest(token, payload) {
  if (!token || !token.sub) {
    throw new AuthError();
  }
  const details = _validatePayload(payload);
  if (details.length > 0) {
    throw new ValidationError(details);
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  const rec = {
    id,
    owner_user_id: token.sub,
    subject: payload.subject,
    description: payload.description,
    state: 'Aberto',
    created_at: now,
    updated_at: now,
    resolved_at: null
  };
  REQUESTS.push(rec);
  return { id: rec.id, state: rec.state, created_at: rec.created_at };
}

function getRequests() {
  // return a shallow copy to avoid external mutation
  return REQUESTS.slice();
}

function clearStore() {
  REQUESTS.length = 0;
}

export { createRequest, getRequests, clearStore, ValidationError, AuthError };
