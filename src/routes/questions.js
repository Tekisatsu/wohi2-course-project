const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const req = require("express/lib/request");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
router.use(authenticate);
const path = require('path');
const multer = require("multer");
const { NotFoundError, ValidationError, ForbiddenError } = require("../lib/errors");
const { z, ZodError } = require("zod");
const errorHandler = require("../middleware/errorHandler");

const QuestionInput = z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
      keywords: z.union([z.string(), z.array(z.string())]).optional(),
});

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
            else cb(new ValidationError("Only image files are allowed"));
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

router.get("/", async (req, res, next) => {
      try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
            const skip = (page - 1) * limit;
            const { keyword } = req.query;

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
                        skip: skip,
                        take: limit,
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
      } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
      try {
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
                  throw new NotFoundError("Question not found");
            }
            res.json(formatQuestion(question));
      }
      catch (err) { next(err); }
});
router.post("/", upload.single("image"), async (req, res, next) => {
      try {
            const data = QuestionInput.parse(req.body);
            const keywordsArray = Array.isArray(data.keywords) ? keywords : [];
            const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
            const newQuestion = await prisma.quiz.create({
                  data: {
                        user: {
                              connect: { id: req.user.userId }
                        },
                        question: data.question,
                        answer: data.answer,
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
      } catch (err) { next(err); }
});

router.put("/:id", upload.single("image"), isOwner, async (req, res) => {
      const id = Number(req.params.id);
      const data = QuestionInput.parse(req.body);
      const existingQuestion = await prisma.quiz.findUnique({ where: { id: id } });
      if (!existingQuestion) {
            throw new NotFoundError("Question not found");
      }
      const keywordsArray = Array.isArray(data.keywords) ? keywords : [];
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const updatedQuestion = await prisma.quiz.update({
            where: { id: id },
            data: {
                  answer: data.answer,
                  question: data.question,
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
            throw new NotFoundError("Question not found");
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
            throw new NotFoundError("Question not found");
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