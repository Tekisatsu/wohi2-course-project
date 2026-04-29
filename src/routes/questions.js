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
            userName: question.user?.name || null,
            user: undefined,
      };
}

router.get("/", async (req, res) => {
      const questions = await prisma.quiz.findMany({
            include: { user: true },
            orderBy: { id: "asc" },
      });
      const formatted = questions.map(q => formatQuestion(q));
      res.json(formatQuestion(formatted));
});

router.get("/:id", async (req, res) => {
      const id = Number(req.params.id);
      const question = await prisma.quiz.findUnique({
            include: { user: true },
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
      const { question, answer } = req.body;

      if (!question || !answer) {
            return res.status(400).json({
                  msg:
                        "question and answer are mandatory"
            });
      }

      const newQuestion = await prisma.quiz.create({
            data: {
                  user: {
                        connect: { id: req.user.userId }
                  },
                  question: question,
                  answer: answer,
            },
      });

      res.status(201).json(newQuestion);
});

router.put("/:id", isOwner, async (req, res) => {
      const id = Number(req.params.id);
      const { question, answer } = req.body;
      const existingQuestion = await prisma.quiz.findUnique({ where: { id: id } });
      if (!existingQuestion) {
            return res.status(404).json({ message: "Question not found" });
      }

      if (!question || !answer) {
            return res.status(400).json({ msg: "question and answer are mandatory" });
      }

      const updatedQuestion = await prisma.quiz.update({
            where: { id: id },
            data: {
                  answer: answer,
                  question: question,
            },
      });
      res.json(formatQuestion(updatedQuestion));
});
router.delete("/:id", isOwner, async (req, res) => {
      const id = Number(req.params.id);

      const question = await prisma.quiz.findUnique({
            include: { user: true },
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