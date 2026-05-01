const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const req = require("express/lib/request");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
router.use(authenticate);

function formatQuestion(question) {
      return {
            ...question,
            keywords: question.keywords.map((k) => k.name),
            userName: question.user?.name || null,
            user: undefined,
      };
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
                  include: { keywords: true, user: true },
                  orderBy: { id: "asc" },
                  skip,
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
});

router.get("/:id", async (req, res) => {
      const id = Number(req.params.id);
      const question = await prisma.quiz.findUnique({
            include: { keywords: true, user: true },
            where: { id: id },
      });

      if (!question) {
            return res.status(404).json({
                  message: "question not found"
            });
      }
      res.json(formatQuestion(question));
});
router.post("/", async (req, res) => {
      const { question, answer, keywords } = req.body;

      if (!question || !answer) {
            return res.status(400).json({
                  msg:
                        "question and answer are mandatory"
            });
      }

      const keywordsArray = Array.isArray(keywords) ? keywords : [];

      const newQuestion = await prisma.quiz.create({
            data: {
                  user: {
                        connect: { id: req.user.userId }
                  },
                  question: question,
                  answer: answer,
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

router.put("/:id", isOwner, async (req, res) => {
      const id = Number(req.params.id);
      const { question, answer, keywords } = req.body;
      const existingQuestion = await prisma.quiz.findUnique({ where: { id: id } });
      if (!existingQuestion) {
            return res.status(404).json({ message: "Question not found" });
      }

      if (!question || !answer) {
            return res.status(400).json({ msg: "question and answer are mandatory" });
      }

      const keywordsArray = Array.isArray(keywords) ? keywords : [];
      const updatedQuestion = await prisma.quiz.update({
            where: { id: id },
            data: {
                  answer: answer,
                  question: question,
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

module.exports = router;