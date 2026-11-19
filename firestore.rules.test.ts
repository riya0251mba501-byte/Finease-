import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Static verification suite for FinEase Firestore security rules against the
 * "Dirty Dozen" adversarial invariants defined in security_spec.md.
 */

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
const activeRules = fs.existsSync(rulesPath)
  ? fs.readFileSync(rulesPath, 'utf8')
  : fs.readFileSync(draftPath, 'utf8');

test('Dirty Dozen #1: Self-assigned owner role blocked on user creation', () => {
  assert.match(activeRules, /incoming\(\)\.role == 'customer'/);
  assert.match(activeRules, /incoming\(\)\.role == existing\(\)\.role/);
});

test('Dirty Dozen #2: Shadow update / ghost fields blocked via strict hasOnly blueprints', () => {
  assert.match(activeRules, /data\.keys\(\)\.hasAll\(/);
  assert.match(activeRules, /data\.keys\(\)\.hasOnly\(/);
  assert.match(activeRules, /affectedKeys\(\)\.hasOnly\(/);
});

test('Dirty Dozen #3: Unverified email spoofing blocked via email_verified == true', () => {
  assert.match(activeRules, /request\.auth\.token\.email_verified == true/);
  assert.match(activeRules, /isBootstrappedOwner\(\)/);
});

test('Dirty Dozen #4: Cross-user PII read blocked on users and addresses', () => {
  assert.match(activeRules, /match \/addresses\/\{addressId\}/);
  assert.match(activeRules, /existing\(\)\.userId == request\.auth\.uid \|\| isOwner\(\)/);
});

test('Dirty Dozen #5 & #6: Order total integrity & COD-only payment enforced', () => {
  assert.match(activeRules, /data\.paymentMethod == 'COD'/);
  assert.match(
    activeRules,
    /incoming\(\)\.totalAmount == incoming\(\)\.subtotal - incoming\(\)\.discountAmount \+ incoming\(\)\.deliveryFee/
  );
  assert.match(activeRules, /incoming\(\)\.status == 'placed'/);
});

test('Dirty Dozen #7 & #8: Product price tampering blocked for customers and store managers', () => {
  assert.match(activeRules, /affectedKeys\(\)\.hasOnly\(\['stock', 'minStockThreshold', 'updatedAt'\]\)/);
  assert.match(activeRules, /incoming\(\)\.stock < existing\(\)\.stock/);
});

test('Dirty Dozen #9 & #10: Delivery partner scope & terminal order lock enforced', () => {
  assert.match(activeRules, /existing\(\)\.assignedPartnerId == request\.auth\.uid/);
  assert.match(activeRules, /!\(existing\(\)\.status in \['delivered', 'cancelled'\]\)/);
});

test('Dirty Dozen #11: ID poisoning guard enforced via isValidId', () => {
  assert.match(activeRules, /function isValidId\(id\)/);
  assert.match(activeRules, /id\.size\(\) <= 128/);
});

test('Dirty Dozen #12: Master Gate get() enforced on support ticket messages', () => {
  assert.match(activeRules, /match \/messages\/\{messageId\}/);
  assert.match(activeRules, /get\(\/databases\/\$\(database\)\/documents\/support_tickets\/\$\(ticketId\)\)/);
});

test('Global safety net default-deny and immutable audit/inventory logs present', () => {
  assert.match(activeRules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(activeRules, /match \/audit_logs\/\{logId\}[\s\S]*allow update, delete: if false;/);
  assert.match(activeRules, /match \/inventory_logs\/\{logId\}[\s\S]*allow update, delete: if false;/);
});
