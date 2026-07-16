#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const args = parseArgs(process.argv.slice(2));
const filePath = args.file ?? args._[0];

if (!filePath) {
  fail('Usage: npm run telegram:import-export -- result.json [--chat-id=-100...] [--include-empty]');
}

loadEnv(path.resolve(process.cwd(), '.env'));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  fail('DATABASE_URL is required in .env');
}

const exported = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const messages = Array.isArray(exported.messages) ? exported.messages : [];
const telegramChatId = args['chat-id'] ?? inferBotApiChatId(exported);
const includeEmpty = Boolean(args['include-empty']);

if (!telegramChatId) {
  fail('Unable to infer chat id. Re-run with --chat-id=-100...');
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('begin');

    const groupId = await upsertGroup(client, {
      telegramChatId,
      title: exported.name ?? null,
    });

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const message of messages) {
      const text = normalizeText(message.text);
      if (message.type !== 'message' || (!includeEmpty && !text.trim())) {
        skipped += 1;
        continue;
      }

      const userId = await upsertUserFromExport(client, message);
      const result = await client.query(
        `
          insert into messages (
            group_id,
            user_id,
            telegram_message_id,
            reply_to_message_id,
            message_type,
            text,
            raw_payload,
            sent_at,
            processing_status,
            created_at,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'pending', now(), now())
          on conflict on constraint messages_group_message_unique do nothing
          returning id
        `,
        [
          groupId,
          userId,
          String(message.id),
          message.reply_to_message_id ? String(message.reply_to_message_id) : null,
          message.media_type ?? message.type ?? 'message',
          text,
          JSON.stringify({ source: 'telegram_desktop_export', chat: summarizeChat(exported), message }),
          getMessageDate(message),
        ],
      );

      if (result.rowCount === 0) {
        duplicates += 1;
      } else {
        imported += 1;
      }
    }

    await client.query('commit');
    console.log(
      JSON.stringify(
        {
          chat: exported.name,
          telegramChatId,
          total: messages.length,
          imported,
          duplicates,
          skipped,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

async function upsertGroup(client, group) {
  const result = await client.query(
    `
      insert into telegram_groups (telegram_chat_id, title, is_active, timezone, created_at, updated_at)
      values ($1, $2, true, $3, now(), now())
      on conflict (telegram_chat_id)
      do update set title = excluded.title, is_active = true, updated_at = now()
      returning id
    `,
    [group.telegramChatId, group.title, process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh'],
  );
  return result.rows[0].id;
}

async function upsertUserFromExport(client, message) {
  const telegramUserId = normalizeTelegramUserId(message.from_id);
  if (!telegramUserId) {
    return null;
  }

  const result = await client.query(
    `
      insert into telegram_users (
        telegram_user_id,
        display_name,
        is_bot,
        created_at,
        updated_at
      )
      values ($1, $2, false, now(), now())
      on conflict (telegram_user_id)
      do update set display_name = excluded.display_name, updated_at = now()
      returning id
    `,
    [telegramUserId, message.from ?? null],
  );
  return result.rows[0].id;
}

function normalizeText(text) {
  if (typeof text === 'string') {
    return text;
  }

  if (Array.isArray(text)) {
    return text
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        return part?.text ?? '';
      })
      .join('');
  }

  return '';
}

function getMessageDate(message) {
  if (message.date_unixtime) {
    return new Date(Number(message.date_unixtime) * 1000);
  }

  return new Date(message.date);
}

function normalizeTelegramUserId(fromId) {
  if (typeof fromId !== 'string') {
    return null;
  }

  return fromId.startsWith('user') ? fromId.slice(4) : fromId;
}

function inferBotApiChatId(exported) {
  if (exported.type === 'private_supergroup' && exported.id) {
    return `-100${exported.id}`;
  }

  return exported.id ? String(exported.id) : null;
}

function summarizeChat(exported) {
  return {
    id: exported.id,
    type: exported.type,
    name: exported.name,
  };
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    process.env[key] = process.env[key] ?? value;
  }
}

function parseArgs(argv) {
  const parsed = { _: [] };

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      parsed._.push(arg);
      continue;
    }

    const [key, value] = arg.slice(2).split('=', 2);
    parsed[key] = value ?? true;
  }

  return parsed;
}

function fail(message) {
  console.error(`[telegram-import] ${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
