import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequest, getRequests, clearStore, ValidationError, AuthError } from '../src/requests.mjs';

test.beforeEach(() => {
  clearStore();
});

test('create request success returns id, state "Aberto" and created_at; persisted with owner_user_id', () => {
  const token = { sub: 'user-123' };
  const payload = { subject: 'Assunto X', description: 'Descrição X' };
  const res = createRequest(token, payload);

  assert.ok(res && typeof res === 'object');
  assert.ok(typeof res.id === 'string' && res.id.length > 0, 'id should be a non-empty string');
  assert.equal(res.state, 'Aberto');
  assert.ok(typeof res.created_at === 'string' && !Number.isNaN(Date.parse(res.created_at)), 'created_at should be ISO timestamp');

  const stored = getRequests().find(r => r.id === res.id);
  assert.ok(stored, 'record should be persisted in store');
  assert.equal(stored.owner_user_id, token.sub);
  assert.equal(stored.subject, payload.subject);
  assert.equal(stored.description, payload.description);
});

test('validation error when subject is missing or blank', () => {
  const token = { sub: 'user-1' };
  // missing subject
  assert.throws(() => createRequest(token, { description: 'x' }), (err) => {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.code, 'validation_error');
    assert.ok(Array.isArray(err.details));
    const fields = err.details.map(d => d.field);
    assert.ok(fields.includes('subject'));
    return true;
  });

  // blank subject
  assert.throws(() => createRequest(token, { subject: '   ', description: 'y' }), (err) => {
    assert.ok(err instanceof ValidationError);
    const fields = err.details.map(d => d.field);
    assert.ok(fields.includes('subject'));
    return true;
  });
});

test('validation error when description is missing or blank', () => {
  const token = { sub: 'user-2' };
  // missing description
  assert.throws(() => createRequest(token, { subject: 'a' }), (err) => {
    assert.ok(err instanceof ValidationError);
    const fields = err.details.map(d => d.field);
    assert.ok(fields.includes('description'));
    return true;
  });

  // blank description
  assert.throws(() => createRequest(token, { subject: 'a', description: '   ' }), (err) => {
    assert.ok(err instanceof ValidationError);
    const fields = err.details.map(d => d.field);
    assert.ok(fields.includes('description'));
    return true;
  });
});

test('validation error lists both fields when both missing', () => {
  const token = { sub: 'user-3' };
  assert.throws(() => createRequest(token, {}), (err) => {
    assert.ok(err instanceof ValidationError);
    const fields = err.details.map(d => d.field).sort();
    assert.deepEqual(fields, ['description', 'subject']);
    return true;
  });
});

test('unauthenticated attempts throw AuthError with code unauthenticated', () => {
  // null token
  assert.throws(() => createRequest(null, { subject: 'a', description: 'b' }), (err) => {
    assert.ok(err instanceof AuthError);
    assert.equal(err.code, 'unauthenticated');
    return true;
  });

  // token without sub
  assert.throws(() => createRequest({}, { subject: 'a', description: 'b' }), (err) => {
    assert.ok(err instanceof AuthError);
    return true;
  });
});
