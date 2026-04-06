const express = require("express");
const router = express.Router();

const questions = require("../data/questions");
const req = require("express/lib/request");
router.get("/", (req, res) => {
      const { keyword } = req.query;
      if (!keyword) {
            return res.json(questions);
      }
      const filteredQuestions = questions.filter(q => q.keywords.includes(keyword.toLocaleLowerCase())
      );
      res.json(filteredQuestions);
});
router.get("/:id", (req, res) => {
      const questionId = Number(req.params.id);
      const question = questions.find(q => q.id === questionId);
      if (!question) {
            return res.status(404).json({ msg: "Question not found" });
      }
      res.json(question);
});

router.post("/", (req, res) => {
      const { question, answer } = req.body;
      if (!question || !answer) {
            return res.status(400).json({ msg: "question or answer missing" });
      }
      const maxId = Math.max(...questions.map(q => q.id), 0);
      const newQuestion = {
            id: questions.length ? maxId + 1 : 1,
            question, answer
      };
      questions.push(newQuestion);
      res.status(201).json(newQuestion);
});
router.put("/:id", (req, res) => {
      const questionId = Number(req.params.id);
      const { question, answer } = req.body;
      const q = questions.find((q) => q.id === questionId);
      if (!q) {
            return res.status(404).json({ msg: "Question not found" });
      }
      if (!question || !answer) {
            return res.json({ msg: "Question or answer missing" });
      }
      q.question = question;
      q.answer = answer;
      res.json(q);
});
router.delete("/:id", (req, res) => {
      const questionId = Number(req.params.id);
      const questionIndex = questions.findIndex((q) => q.id === questionId);
      if (questionIndex === -1) {
            return res.status(404).json({ msg: "Question not found" });
      }
      const deleted = questions.splice(questionIndex, 1);
      res.json({
            msg: "Question deleted",
            question: deleted[0]
      });
});
module.exports = router;