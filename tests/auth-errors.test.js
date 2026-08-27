import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapAuthError } from '../js/auth/errors.js';

test('알려진 오류 3종을 한글로 매핑한다', () => {
  assert.equal(mapAuthError('Invalid login credentials'), '이메일 또는 비밀번호가 올바르지 않아요');
  assert.equal(mapAuthError('User already registered'), '이미 가입된 이메일이에요');
  assert.equal(mapAuthError('Email not confirmed'), '이메일 인증을 완료해 주세요');
});

test('Error 객체의 message도 처리한다', () => {
  assert.equal(mapAuthError(new Error('Invalid login credentials')), '이메일 또는 비밀번호가 올바르지 않아요');
});

test('모르는 메시지는 원문을 그대로 돌려준다', () => {
  assert.equal(mapAuthError('Password should be at least 6 characters'), 'Password should be at least 6 characters');
});

test('비어 있으면 기본 문구', () => {
  assert.equal(mapAuthError(null), '로그인 중 문제가 발생했어요');
  assert.equal(mapAuthError(''), '로그인 중 문제가 발생했어요');
});
