const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const req = require("express/lib/request");

router.get("/", async (req, res) => {
      const questions = await prisma.quiz.findMany({
            orderBy: { id: "asc" },
      });

      res.json(questions);
});

router.get("/:id", async (req, res) => {
      const id = Number(req.params.id);
      const question = await prisma.quiz.findUnique({
            where: { id: id },
      });

      if (!question) {
            return res.status(404).json({
                  message: "Post not found"
            });
      }

      res.json(question);
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
                  question: question,
                  answer: answer,
            },
      });

      res.status(201).json(newQuestion);
});

router.put("/:id", async (req, res) => {
      const id = Number(req.params.id);
      const { question, answer } = req.body;
      const existingQuestion = await prisma.quiz.findUnique({ where: { id: id } });
      if (!existingQuestion) {
            return res.status(404).json({ message: "Question not found" });
      }

      if (!question || !answer) {
            return res.status(400).json({ msg: "question and answer are mandatory" });
      }

      const updatedQuestion = await prisma.post.update({
            where: { id: id },
            data: {
                  answer: answer,
                  question: question,
            },
      });
      res.json(updatedQuestion);
});
router.delete("/:id", async (req, res) => {
      const id = Number(req.params.id);

      const question = await prisma.quiz.findUnique({
            where: { id: id },
      });

      if (!question) {
            return res.status(404).json({ message: "Question not found" });
      }

      await prisma.quiz.delete({ where: { id: id } });

      res.json({
            message: "Question deleted successfully",
            question: question,
      });
});

module.exports = router;