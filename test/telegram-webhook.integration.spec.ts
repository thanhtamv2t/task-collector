import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://telegram_reporter:password@localhost:5432/telegram_reporter';

describe('Telegram webhook -> PostgreSQL', () => {
  let app: INestApplication | null = null;
  let pool: Pool | null = null;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.ADMIN_TELEGRAM_USER_IDS = '42';
    process.env.TELEGRAM_BOT_TOKEN = '';
    process.env.NODE_ENV = 'test';

    pool = new Pool({ connectionString: databaseUrl });
    await applyMigration(pool);
    await resetCollectorTables(pool);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it('registers a group, watches a topic, stores a message, and ignores duplicates', async () => {
    await postTelegramUpdate(setupUpdate()).expect(200).expect({
      ok: true,
      result: 'command_handled',
    });

    await postTelegramUpdate(watchUpdate()).expect(200).expect({
      ok: true,
      result: 'command_handled',
    });

    await postTelegramUpdate(taskMessageUpdate()).expect(200).expect({
      ok: true,
      result: 'stored',
    });

    await postTelegramUpdate(taskMessageUpdate()).expect(200).expect({
      ok: true,
      result: 'duplicate',
    });

    const groupCount = await countRows('telegram_groups');
    const topicCount = await countRows('telegram_topics');
    const userCount = await countRows('telegram_users');
    const messageCount = await countRows('messages');

    expect(groupCount).toBe(1);
    expect(topicCount).toBe(1);
    expect(userCount).toBe(1);
    expect(messageCount).toBe(1);

    const { rows } = await pool.query<{
      text: string;
      telegram_message_id: string;
      raw_payload: unknown;
    }>('select telegram_message_id, text, raw_payload from messages limit 1');

    expect(rows[0]).toMatchObject({
      telegram_message_id: '1002',
      text: 'Alice will finish the webhook integration test today',
    });
    expect(rows[0]?.raw_payload).toBeTruthy();
  });

  it('rejects an invalid Telegram webhook secret', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'wrong-secret')
      .send(taskMessageUpdate())
      .expect(401);
  });

  function postTelegramUpdate(update: unknown): request.Test {
    if (!app) {
      throw new Error('Nest application was not initialized');
    }

    return request(app.getHttpServer())
      .post('/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'test-webhook-secret')
      .send(update);
  }

  async function countRows(tableName: string): Promise<number> {
    if (!pool) {
      throw new Error('PostgreSQL pool was not initialized');
    }

    const { rows } = await pool.query<{ count: string }>(`select count(*) from ${tableName}`);
    return Number(rows[0]?.count ?? 0);
  }
});

async function applyMigration(pool: Pool): Promise<void> {
  const migration = readFileSync(resolve(__dirname, '../drizzle/0000_bootstrap_collector.sql'), 'utf8');
  await pool.query(migration);
}

async function resetCollectorTables(pool: Pool): Promise<void> {
  await pool.query(
    'truncate table messages, telegram_topics, telegram_users, telegram_groups restart identity cascade',
  );
}

function setupUpdate(): unknown {
  return {
    update_id: 1,
    message: {
      message_id: 1000,
      message_thread_id: 7,
      chat: {
        id: -1001234567890,
        type: 'supergroup',
        title: 'Task Test Group',
      },
      from: adminUser(),
      date: 1784110000,
      text: '/setup',
    },
  };
}

function watchUpdate(): unknown {
  return {
    update_id: 2,
    message: {
      message_id: 1001,
      message_thread_id: 7,
      chat: {
        id: -1001234567890,
        type: 'supergroup',
        title: 'Task Test Group',
      },
      from: adminUser(),
      date: 1784110060,
      text: '/watch',
    },
  };
}

function taskMessageUpdate(): unknown {
  return {
    update_id: 3,
    message: {
      message_id: 1002,
      message_thread_id: 7,
      chat: {
        id: -1001234567890,
        type: 'supergroup',
        title: 'Task Test Group',
      },
      from: {
        id: 77,
        is_bot: false,
        first_name: 'Alice',
        username: 'alice',
      },
      date: 1784110120,
      text: 'Alice will finish the webhook integration test today',
      reply_to_message: {
        message_id: 1001,
      },
    },
  };
}

function adminUser(): unknown {
  return {
    id: 42,
    is_bot: false,
    first_name: 'Admin',
    username: 'admin',
  };
}
