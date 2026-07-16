import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TelegramUpdateParser } from '../src/modules/telegram/telegram-update.parser';

describe('telegram runtime fixtures', () => {
  const fixtureDir = join(__dirname, 'fixtures', 'telegram-runtime');
  const fixtureNames = readdirSync(fixtureDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  const parser = new TelegramUpdateParser();

  it('keeps all replay fixtures parseable by the Telegram update parser', () => {
    expect(fixtureNames.length).toBeGreaterThanOrEqual(14);

    for (const fixtureName of fixtureNames) {
      const update = JSON.parse(readFileSync(join(fixtureDir, fixtureName), 'utf8')) as unknown;
      const parsed = parser.parse(update);

      expect(parsed, fixtureName).not.toBeNull();
    }
  });

  it('covers the fixture scenarios required by the implementation plan', () => {
    expect(fixtureNames).toEqual(
      expect.arrayContaining([
        '003-task-created.json',
        '004-task-progress.json',
        '005-blocker.json',
        '006-decision.json',
        '007-done.json',
        '008-duplicate-task-created.json',
        '009-edited-progress.json',
        '010-unassigned-task.json',
        '011-username-changed.json',
        '012-user-without-username.json',
        '013-reply-chain.json',
        '014-no-task-conversation.json',
      ]),
    );
  });
});
