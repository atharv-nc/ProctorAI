import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock database
  const reports: any[] = [];
  const exams: any[] = [
    {
      id: "default-1",
      title: "General AI Knowledge",
      subject: "Computer Science",
      type: "MCQ",
      questions: [
        { id: "q1", text: "What is the primary purpose of an AI Proctoring system?", options: ["To help students", "To ensure exam integrity", "To record videos", "To grade exams"], correctAnswer: 1 },
        { id: "q2", text: "Which technology is commonly used for face detection in browsers?", options: ["OpenCV", "MediaPipe", "TensorFlow", "All of the above"], correctAnswer: 1 },
        { id: "q3", text: "What happens after 3 warnings in this system?", options: ["Nothing", "Warning message", "Auto-submission", "Exam restart"], correctAnswer: 2 }
      ],
      createdAt: Date.now()
    }
  ];

  // API routes
  app.post("/api/reports", (req, res) => {
    const report = { ...req.body, id: reports.length };
    reports.push(report);
    console.log("Report received:", report.student.name);
    res.json({ success: true, id: report.id });
  });

  app.get("/api/reports", (req, res) => {
    res.json(reports);
  });

  app.get("/api/exams", (req, res) => {
    res.json(exams);
  });

  app.post("/api/exams", (req, res) => {
    const exam = { ...req.body, id: `exam-${Date.now()}`, createdAt: Date.now() };
    exams.push(exam);
    res.json({ success: true, exam });
  });

  app.get("/api/reports/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (reports[id]) {
      res.json(reports[id]);
    } else {
      res.status(404).json({ error: "Report not found" });
    }
  });

  app.get("/api/proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });
    try {
      const response = await fetch(url);
      const text = await response.text();
      res.send(text);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch URL" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
