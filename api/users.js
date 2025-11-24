let usersOnline = 0; // Global counter (resets when serverless function restarts)

export default function handler(req, res) {
  if (req.method === 'POST') {
    usersOnline++;
    res.status(200).json({ usersOnline });
  } else if (req.method === 'GET') {
    res.status(200).json({ usersOnline });
  } else if (req.method === 'DELETE') {
    usersOnline = Math.max(usersOnline - 1, 0);
    res.status(200).json({ usersOnline });
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
