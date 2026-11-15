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

class ForbiddenError extends Error {
  constructor(message = 'forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.code = 'forbidden';
  }
}

class NotFoundError extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'not_found';
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
    resolved_at: null,
    responses: []
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

// New: list requests according to token and optional filters
// opts: { owner: 'me'|'<userId>', state: '<state>', page, limit }
function listRequests(token, opts = {}) {
  if (!token || !token.sub) {
    throw new AuthError();
  }
  const owner = opts.owner ?? 'me';
  const state = opts.state;

  // Helper to create summary view
  const toSummary = (r) => ({ id: r.id, subject: r.subject, state: r.state, created_at: r.created_at });

  // If filtering by state and not by owner, require support_agent role
  if (typeof state === 'string') {
    const roles = Array.isArray(token.roles) ? token.roles : [];
    const isAgent = roles.includes('support_agent');
    if (!isAgent) {
      // For clients, only allow state filtering if it pertains to their own tickets (not global)
      // For simplicity, deny global state queries to non-agents
      throw new ForbiddenError('role support_agent required to list by state');
    }
    // support_agent may list by state across all tickets
    return REQUESTS.filter(r => r.state === state).map(toSummary);
  }

  // Owner-based listing (defaults to the authenticated user)
  if (owner === 'me') {
    return REQUESTS.filter(r => r.owner_user_id === token.sub).map(toSummary);
  }

  // If owner is specific user id, only allow if token is support_agent
  if (owner && owner !== 'me') {
    const roles = Array.isArray(token.roles) ? token.roles : [];
    const isAgent = roles.includes('support_agent');
    if (!isAgent) {
      throw new ForbiddenError('cannot list other users requests');
    }
    return REQUESTS.filter(r => r.owner_user_id === owner).map(toSummary);
  }

  // Fallback: return empty
  return [];
}

// New: get request detail by id with ownership/role checks
function getRequestById(token, id) {
  if (!token || !token.sub) {
    throw new AuthError();
  }
  const rec = REQUESTS.find(r => r.id === id);
  if (!rec) {
    throw new NotFoundError('Pedido não encontrado');
  }
  const roles = Array.isArray(token.roles) ? token.roles : [];
  const isAgent = roles.includes('support_agent');
  if (rec.owner_user_id !== token.sub && !isAgent) {
    throw new ForbiddenError('access denied to this request');
  }
  // Return detailed view including responses
  return {
    id: rec.id,
    subject: rec.subject,
    description: rec.description,
    state: rec.state,
    created_at: rec.created_at,
    updated_at: rec.updated_at,
    resolved_at: rec.resolved_at,
    responses: Array.isArray(rec.responses) ? rec.responses.map(r => ({ author_id: r.author_id, message: r.message, created_at: r.created_at })) : []
  };
}

export {
  createRequest,
  getRequests,
  clearStore,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  listRequests,
  getRequestById
};
