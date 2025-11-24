import fetch from 'node-fetch';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

let webhookMessageId = null;
let activeUsers = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing user ID' });

  // Track user with timestamp
  activeUsers.set(id, Date.now());

  // Remove inactive users older than 60 seconds
  const now = Date.now();
  activeUsers.forEach((ts, key) => { if (now - ts > 60000) activeUsers.delete(key); });

  const content = `Currently active visitors: ${activeUsers.size}`;

  try {
    if (!webhookMessageId) {
      // Send initial webhook message
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      webhookMessageId = data.id;
    } else {
      // Edit existing webhook message
      await fetch(`${WEBHOOK_URL}/messages/${webhookMessageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
    }
    res.status(200).json({ activeUsers: activeUsers.size });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
}
