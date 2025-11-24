import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing user ID' });

  // Add user with current timestamp
  await kv.set(`user:${id}`, Date.now(), { ex: 60 }); // expires in 60 seconds

  // Count active users
  const keys = await kv.keys('user:*');
  const activeCount = keys.length;

  // Fetch or create the webhook message ID
  let messageId = await kv.get('webhookMessageId');

  const content = `Currently active visitors: ${activeCount}`;

  if (!messageId) {
    // Create new webhook message
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await response.json();
    messageId = data.id;
    await kv.set('webhookMessageId', messageId);
  } else {
    // Edit existing webhook message
    await fetch(`${WEBHOOK_URL}/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  }

  res.status(200).json({ success: true, activeUsers: activeCount });
}
