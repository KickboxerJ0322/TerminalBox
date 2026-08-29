import assert from 'node:assert/strict';
import test from 'node:test';

import { HOME_RESET_SCRIPT } from '../src/lab-reset.js';

test('workspace reset preserves the active X11 authorization file', () => {
  assert.match(HOME_RESET_SCRIPT, /! -name \.Xauthority/);
});
