
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON
app.use(express.json());

// Mock Database (In-memory for demonstration)
// In a real app, this would be connected to MongoDB, PostgreSQL, etc.
let filesDB = [
  { id: '1', filename: 'example.pdf', path: 'uploads/example.pdf' }
];

/**
 * DELETE /api/files/:id
 * Deletes a file from the server and removes its metadata.
 */
app.delete('/api/files/:id', (req: Request, res: Response) => {
  const fileId = req.params.id;

  // 1. Find file metadata in database
  const fileIndex = filesDB.findIndex(f => f.id === fileId);
  
  // Return 404 if not found in database. 
  // The frontend interprets 404 as "already deleted" or "not present" and proceeds.
  if (fileIndex === -1) {
     return res.status(404).json({ error: "File not found" });
  }

  const fileRecord = filesDB[fileIndex];
  // Ensure the uploads directory exists relative to this script
  const filePath = path.resolve(fileRecord.path);

  // 2. Remove file from filesystem
  fs.unlink(filePath, (err) => {
    // If error is not ENOENT (File not found), report it.
    // If file is already missing from disk but in DB, we still want to clear DB.
    if (err && err.code !== 'ENOENT') {
      console.error("Error deleting file from disk:", err);
      return res.status(500).json({ error: "Failed to delete file from storage" });
    }

    // 3. Remove metadata from database
    filesDB.splice(fileIndex, 1);

    // 4. Return success response
    console.log(`Successfully deleted file: ${fileId}`);
    return res.status(200).json({ message: "File deleted successfully" });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
