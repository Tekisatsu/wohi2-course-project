const express = require("express");
const router = express.Router();

const questions = require("../data/questions");
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
      const questionId = Number(req.params.questionId);
      const question = questions.find((q) => q.id === questionId);
      if (!question) {
            return res.status(404).json({ msg: "Post not found" });
      }
      res.json(question);
});

module.exports = router;