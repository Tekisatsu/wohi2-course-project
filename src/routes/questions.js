const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const req = require("express/lib/request");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
router.use(authenticate);
const path = require('path');
const multer = require("multer");

router.use((err, req, res, next) => {
      if (err instanceof multer.MulterError ||
            err?.message === "Only image files are allowed") {
            return res.status(400).json({ msg: err.message });
      }
      next(err);
});

const storage = multer.diskStorage({
      destination: path.join(__dirname, "..", "..", "public", "uploads"),
      filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
      },
});

const upload = multer({
      storage,
      fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith("image/")) cb(null, true);
            else cb(new Error("Only image files are allowed"));
      },
      limits: { fileSize: 5 * 1024 * 1024 },
});

function formatQuestion(question) {
      return {
            ...question,
            date: question.date.toISOString().split("T")[0],
            keywords: question.keywords.map((k) => k.name),
            userName: question.user?.name || null,
            solved: question.attempts ? question.attempts.length > 0 : false,
            user: undefined,
      };
}

function parseKeywords(keywords) {
      if (Array.isArray(keywords)) return keywords;
      if (typeof keywords === "string") {
            return keywords.split(",").map((k) => k.trim()).filter(Boolean);
      }
      return [];
}

router.get("/", async (req, res) => {
      const { keyword, page, limit } = req.query;
      const skip = (page - 1) * limit;

      const where = keyword
            ? { keywords: { some: { name: keyword } } }
            : {};

      const [questions, total] = await Promise.all([
            prisma.quiz.findMany({
                  where,
                  include: {
                        keywords: true, user: true,
                        attempts: {
                              where: {
                                    userId: req.user.userId,
                                    correct: true
                              },
                              take: 1
                        }
                  },
                  orderBy: { id: "asc" },
                  skip: parseInt(skip),
                  take: parseInt(limit),
            }),
            prisma.quiz.count({ where }),
      ]);
      const formatted = questions.map(q => formatQuestion(q));
      res.json({
            data: formatted,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
      });
});

router.get("/:id", async (req, res) => {
      const id = Number(req.params.id);
      const question = await prisma.quiz.findUnique({
            include: {
                  keywords: true, user: true,
                  attempts: {
                        where: {
                              userId: req.user.userId,
                              correct: true
                        },
                        take: 1
                  }
            },
            where: { id: id },
      });

      if (!question) {
            return res.status(404).json({
                  message: "question not found"
            });
      }
      res.json(formatQuestion(question));
});
router.post("/", upload.single("image"), async (req, res) => {
      const { question, answer, keywords } = req.body;

      if (!question || !answer) {
            return res.status(400).json({
                  msg:
                        "question, answer and date are mandatory"
            });
      }

      const keywordsArray = Array.isArray(keywords) ? keywords : [];
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const newQuestion = await prisma.quiz.create({
            data: {
                  user: {
                        connect: { id: req.user.userId }
                  },
                  question: question,
                  answer: answer,
                  imageUrl: imageUrl,
                  keywords: {
                        connectOrCreate: keywordsArray.map((kw) => ({
                              where: { name: kw }, create: { name: kw },
                        })),
                  },
            },
            include: { keywords: true },
      });

      res.status(201).json(formatQuestion(newQuestion));
});

router.put("/:id", upload.single("image"), isOwner, async (req, res) => {
      const id = Number(req.params.id);
      const { question, answer, keywords } = req.body;
      const existingQuestion = await prisma.quiz.findUnique({ where: { id: id } });
      if (!existingQuestion) {
            return res.status(404).json({ message: "Question not found" });
      }

      if (!question || !answer) {
            return res.status(400).json({ msg: "question, answer and date are mandatory" });
      }

      const keywordsArray = Array.isArray(keywords) ? keywords : [];
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const updatedQuestion = await prisma.quiz.update({
            where: { id: id },
            data: {
                  answer: answer,
                  question: question,
                  date: new Date.now(),
                  imageUrl: imageUrl,
                  keywords: {
                        set: [],
                        connectOrCreate: keywordsArray.map((kw) => ({
                              where: { name: kw },
                              create: { name: kw },
                        })),
                  },
            },
      });
      res.json(formatQuestion(formatQuestion(updatedQuestion)));
});
router.delete("/:id", isOwner, async (req, res) => {
      const id = Number(req.params.id);

      const question = await prisma.quiz.findUnique({
            include: { keywords: true, user: true },
            where: { id: id },
      });

      if (!question) {
            return res.status(404).json({ message: "Question not found" });
      }

      await prisma.quiz.delete({ where: { id: id } });

      res.json({
            message: "Question deleted successfully",
            question: formatQuestion(question),
      });
});

router.post("/:id/play", async (req, res) => {
      const questionId = Number(req.params.id);
      const { answer } = req.body;

      const question = await prisma.quiz.findUnique({ where: { id: questionId } });
      if (!question) {
            return res.status(404).json({ msg: "Not found" });
      }

      const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();

      const attempt = await prisma.attempt.create({
            data: {
                  userId: req.user.userId,
                  questionId,
                  submittedAnswer: answer,
                  correct: isCorrect
            },
      });

      res.status(201).json({
            id: attempt.id,
            correct: attempt.correct,
            submittedAnswer: attempt.submittedAnswer,
            correctAnswer: question.answer,
            createdAt: attempt.createdAt
      });
});

module.exports = router;