import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'users.json');
const ONLINE_TIMEOUT = 30 * 1000; // 30 seconds

// Helper to read/write JSON file
function readUsers() {
  if (!fs.existsSync(FILE_PATH)) return {};
  return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
}

function writeUsers(data) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  let users = readUsers();
  const now = Date.now();

  if (req.method === 'POST') {
    const { id } = JSON.parse(req.body);
    if (!id) return res.status(400).json({ message: 'ID required' });

    users[id] = now; // Update last activity
    writeUsers(users);
    return res.status(200).json({ message: 'User updated' });

  } else if (req.method === 'GET') {
    // Count users active in the last 30 seconds
    const activeUsers = Object.values(users).filter(ts => now - ts <= ONLINE_TIMEOUT);
    return res.status(200).json({ usersOnline: activeUsers.length });

  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
