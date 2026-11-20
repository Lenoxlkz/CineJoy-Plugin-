import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countScreenNodes,
  formatSdkCommandOutput,
  nextDpadFocus,
  SDK_DEFAULT_ARGS,
  sdkFunctionNeedsArg,
} from './screenHelpers';

test('countScreenNodes counts scaffold, appBar, tabs, and grid items', () => {
  const tree = {
    type: 'scaffold',
    appBar: {
      type: 'appBar',
      leading: { type: 'button' },
      actions: [{ type: 'button' }],
      bottom: {
        type: 'tabs',
        tabs: [{ value: 'trending' }, { value: 'movies' }],
      },
    },
    body: {
      type: 'box',
      children: [
        {
          type: 'titleGrid',
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        },
      ],
    },
  };
  // scaffold (1) + appBar (1) + leading (1) + action (1) + tabs (1 + 2 tabs) + box (1) + titleGrid (1 + 3 items) = 12
  assert.equal(countScreenNodes(tree), 12);
  assert.equal(countScreenNodes(null), 0);
});

test('nextDpadFocus navigates cleanly across appbar, tabs, and grid', () => {
  const opts = { tabsCount: 4, itemsCount: 10, cols: 4, currentTabIndex: 1 };

  assert.deepEqual(nextDpadFocus({ zone: 'appbar', focusedIndex: 0 }, 'down', opts), {
    zone: 'tabs',
    focusedIndex: 1,
  });

  assert.deepEqual(nextDpadFocus({ zone: 'tabs', focusedIndex: 1 }, 'right', opts), {
    zone: 'tabs',
    focusedIndex: 2,
  });

  assert.deepEqual(nextDpadFocus({ zone: 'tabs', focusedIndex: 0 }, 'left', opts), {
    zone: 'tabs',
    focusedIndex: 0,
  });

  assert.deepEqual(nextDpadFocus({ zone: 'tabs', focusedIndex: 2 }, 'down', opts), {
    zone: 'grid',
    focusedIndex: 0,
  });

  assert.deepEqual(nextDpadFocus({ zone: 'grid', focusedIndex: 1 }, 'down', opts), {
    zone: 'grid',
    focusedIndex: 5,
  });

  assert.deepEqual(nextDpadFocus({ zone: 'grid', focusedIndex: 1 }, 'up', opts), {
    zone: 'tabs',
    focusedIndex: 1,
  });

  assert.deepEqual(nextDpadFocus({ zone: 'grid', focusedIndex: 5 }, 'up', opts), {
    zone: 'grid',
    focusedIndex: 1,
  });
});

test('nextDpadFocus does not enter grid when itemsCount is 0', () => {
  const opts = { tabsCount: 4, itemsCount: 0, cols: 4, currentTabIndex: 0 };
  assert.deepEqual(nextDpadFocus({ zone: 'tabs', focusedIndex: 0 }, 'down', opts), {
    zone: 'tabs',
    focusedIndex: 0,
  });
});

test('sdkFunctionNeedsArg and defaults are consistent', () => {
  assert.equal(sdkFunctionNeedsArg('resolve'), true);
  assert.equal(sdkFunctionNeedsArg('search'), true);
  assert.equal(sdkFunctionNeedsArg('episodes'), true);
  assert.equal(sdkFunctionNeedsArg('home'), false);
  assert.equal(sdkFunctionNeedsArg('screen'), false);
  assert.equal(SDK_DEFAULT_ARGS.episodes, 'series:1399');
});

test('formatSdkCommandOutput preserves both stderr diagnostics and stdout JSON', () => {
  assert.equal(formatSdkCommandOutput('{"ok":true}', '[kino.log] test'), '[kino.log] test\n\n{"ok":true}');
  assert.equal(formatSdkCommandOutput('{"ok":true}', ''), '{"ok":true}');
  assert.equal(formatSdkCommandOutput('', 'error line'), 'error line');
  assert.equal(formatSdkCommandOutput('', ''), 'Sin salida');
});
