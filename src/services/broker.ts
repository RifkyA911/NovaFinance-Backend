import amqplib, { Connection, Channel } from 'amqplib';
import { sql } from 'drizzle-orm';
import { db } from '../auth/config';
import { getEmbedding, formatTransactionText } from './embedding';

let connection: any = null;
let channel: any = null;
let isConnecting = false;

export const QUEUES = {
  EMBEDDINGS: 'novafinance.embeddings.sync',
  DOCUMENTS_OCR: 'novafinance.documents.ocr',
  AUDIT_EVENTS: 'novafinance.audit.events',
};

export async function initRabbitMQ(): Promise<Channel | null> {
  if (channel) return channel;
  if (isConnecting) return null;

  isConnecting = true;
  const amqpUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  try {
    console.log(`🔌 [RabbitMQ] Connecting to broker at ${amqpUrl.replace(/:[^:]*@/, ':***@')}...`);
    connection = await amqplib.connect(amqpUrl);
    channel = await connection.createChannel();

    // Assert durable queues
    for (const q of Object.values(QUEUES)) {
      await channel.assertQueue(q, { durable: true });
    }

    console.log('✅ [RabbitMQ] Connected & queues asserted successfully!');

    // Start background consumers
    startConsumers(channel);

    connection.on('error', (err: any) => {
      console.error('❌ [RabbitMQ] Connection error:', err.message);
      channel = null;
      connection = null;
    });

    connection.on('close', () => {
      console.warn('⚠️ [RabbitMQ] Connection closed. Will reconnect on next job.');
      channel = null;
      connection = null;
    });

    isConnecting = false;
    return channel;
  } catch (err: any) {
    isConnecting = false;
    console.warn(`⚠️ [RabbitMQ] Could not connect to broker: ${err.message}. Background tasks will run inline.`);
    return null;
  }
}

/**
 * Push an event or job to durable RabbitMQ queue
 */
export async function publishToQueue(queueName: string, data: any): Promise<boolean> {
  try {
    const ch = await initRabbitMQ();
    if (!ch) {
      // Fallback: If broker unavailable, execute immediately inline
      handleInlineFallback(queueName, data);
      return false;
    }
    const message = Buffer.from(JSON.stringify(data));
    return ch.sendToQueue(queueName, message, { persistent: true });
  } catch (err: any) {
    console.error(`[RabbitMQ] Failed to publish to ${queueName}:`, err.message);
    handleInlineFallback(queueName, data);
    return false;
  }
}

/**
 * Handle worker consumers for background queues
 */
function startConsumers(ch: Channel) {
  // 1. Worker for Embedding Sync
  ch.consume(QUEUES.EMBEDDINGS, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      const { transactionId, workspaceId, content } = payload;

      if (transactionId && workspaceId && content) {
        const vector = await getEmbedding(content);
        const vectorStr = `[${vector.join(',')}]`;

        // Upsert into transaction_embeddings
        await db.execute(sql`
          INSERT INTO transaction_embeddings (transaction_id, workspace_id, content, embedding)
          VALUES (${transactionId}, ${workspaceId}, ${content}, ${vectorStr}::vector)
          ON CONFLICT (transaction_id) 
          DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, created_at = NOW();
        `);
      }
      ch.ack(msg);
    } catch (err: any) {
      console.error('[RabbitMQ Worker] Embedding job failed:', err.message);
      ch.nack(msg, false, false); // Don't requeue poison messages
    }
  });

  // 2. Worker for Audit Events
  ch.consume(QUEUES.AUDIT_EVENTS, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      await db.execute(sql`
        INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data, created_at)
        VALUES (${event.workspaceId || null}, ${event.userId || null}, ${event.action}, ${event.entityType}, ${event.entityId || null}, ${JSON.stringify(event.data || {})}, NOW())
      `);
      ch.ack(msg);
    } catch (err: any) {
      console.error('[RabbitMQ Worker] Audit event job failed:', err.message);
      ch.ack(msg);
    }
  });

  console.log('👷 [RabbitMQ Workers] Background consumers active for queues:', Object.values(QUEUES));
}

/**
 * Graceful fallback if RabbitMQ is not reachable
 */
async function handleInlineFallback(queueName: string, data: any) {
  if (queueName === QUEUES.EMBEDDINGS) {
    try {
      const { transactionId, workspaceId, content } = data;
      if (transactionId && workspaceId && content) {
        const vector = await getEmbedding(content);
        const vectorStr = `[${vector.join(',')}]`;
        await db.execute(sql`
          INSERT INTO transaction_embeddings (transaction_id, workspace_id, content, embedding)
          VALUES (${transactionId}, ${workspaceId}, ${content}, ${vectorStr}::vector)
          ON CONFLICT DO NOTHING;
        `);
      }
    } catch (e: any) {
      console.warn('[Inline Fallback] Embedding generation skipped:', e.message);
    }
  }
}

/**
 * Return operational status of broker
 */
export function getBrokerOperationalInfo() {
  return {
    connected: !!channel,
    url: (process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672').replace(/:[^:]*@/, ':***@'),
    managementUi: process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672',
    activeQueues: Object.values(QUEUES),
  };
}
